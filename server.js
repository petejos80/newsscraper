// ======================================================= CONFIGURATION ======================================================= //

var express = require("express");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");
var path = require("path");


// Tools for Scraping
var request = require("request")
var cheerio = require("cheerio");


// DB Conntection
var db = require("./models");

// Include Article
var Note = require("./models/Note.js");
var Article = require("./models/Article.js");

// Defining the port
var port = process.env.PORT || 8000;

var app = express();

app.use(logger("dev"));

// Body-parser for form submissions
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static("public"));

// Set Handlebars.
var exphbs = require("express-handlebars");

app.engine("hbs", exphbs({
    defaultLayout: "main",
    extname: '.hbs',
    partialsDir: path.join(__dirname, "/views/layouts/partials")
}));
app.set("view engine", "hbs");


// If deployed, use the deployed database. Otherwise use the local newsscraper DB
var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/newsscraper";

// Connect to the Mongo DB
mongoose.Promise = Promise;
mongoose.connect(MONGODB_URI);


// ======================================================= Routes ======================================================= //

// A GET request to render Handlebars
//GET requests to render Handlebars pages
app.get("/", function(req, res) {
  Article.find({"saved": false}, function(error, data) {
    var hbsObject = {
      article: data
    };
    console.log(hbsObject);
    res.render("home", hbsObject);
  });
});

app.get("/saved", function(req, res) {
  Article.find({"saved": true}).populate("notes").exec(function(error, articles) {
    var hbsObject = {
      article: articles
    };
    res.render("saved", hbsObject);
  });
});

// A GET request to scrape the New York Times website
app.get("/scrape", function(req, res) {

  request("https://www.nytimes.com/", function(error, response, html) {

  var $ = cheerio.load(html);

    $("article").each(function(i, element) {

      var result = {};

      // Add properties to each resulting object
      result.title = $(this).children("h2").text();
      result.summary = $(this).children(".summary").text();
      result.link = $(this).children("h2").children("a").attr("href");

      // Create new entry from article model
      var entry = new Article(result);

      // Now, save that entry to the db
      entry.save(function(err, doc) {

        if (err) {
          console.log(err);
        }

        else {
          console.log(doc);
        }
      });

    });
        res.send("Scrape Complete");

  });
});


// Retrieve all articles from DB
app.get("/articles", function(req, res) {

  db.Article.find({})
    .then(function(dbArticle) {

      res.json(dbArticle);
    })
    .catch(function(err) {

      res.json(err);
    });
});

// Grab a specific article by it's ID
app.get("/articles/:id", function(req, res) {
  
  db.Article.findOne({ _id: req.params.id })
    
    .populate("note")
    .then(function(dbArticle) {
      
      res.json(dbArticle);
    })
    .catch(function(err) {
      
      res.json(err);
    });
});

// Route for saving/updating an Article's associated Note
app.post("/articles/:id", function(req, res) {
  
  db.Note.create(req.body)
    .then(function(dbNote) {

      return db.Article.findOneAndUpdate({ _id: req.params.id }, { note: dbNote._id }, { new: true });
    })
    .then(function(dbArticle) {

      res.json(dbArticle);
    })
    .catch(function(err) {

      res.json(err);
    });
});

// Save an article
app.post("/articles/save/:id", function(req, res) {

  Article.findOneAndUpdate({ "_id": req.params.id }, { "saved": true})

  .exec(function(err, doc) {

    if (err) {
      console.log(err);
    }
    else {

      res.send(doc);
    }
  });
});

// Delete an article
app.post("/articles/delete/:id", function(req, res) {

  Article.findOneAndUpdate({ "_id": req.params.id }, {"saved": false, "notes": []})
  
  .exec(function(err, doc) {
    
    if (err) {
      console.log(err);
    }
    else {
      
      res.send(doc);
    }
  });
});

// Create a new note
app.post("/notes/save/:id", function(req, res) {

var newNote = new Note({
  body: req.body.text,
  article: req.params.id
});
console.log(req.body)

newNote.save(function(error, note) {

if (error) {
  console.log(error);
}

else {
  // Update notes by article ID
  Article.findOneAndUpdate({ "_id": req.params.id }, {$push: { "notes": note } })

  .exec(function(err) {

    if (err) {
      console.log(err);
      res.send(err);
    }
    else {

      res.send(note);
    }
  });
}
});
});

// Delete a note
app.delete("/notes/delete/:note_id/:article_id", function(req, res) {

Note.findOneAndRemove({ "_id": req.params.note_id }, function(err) {

if (err) {
  console.log(err);
  res.send(err);
}
else {
  Article.findOneAndUpdate({ "_id": req.params.article_id }, {$pull: {"notes": req.params.note_id}})
   
    .exec(function(err) {
      
      if (err) {
        console.log(err);
        res.send(err);
      }
      else {
        
        res.send("Note Deleted");
      }
    });
}
});
});

// Start the server
app.listen(port, function() {
  console.log("App is running on port " + port);
});
