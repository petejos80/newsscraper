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
var Article = require("./models/Article.js");

var PORT = 3000;

var app = express();

app.use(logger("dev"));

// Body-parser for form submissions
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static("public"));

// // Handlebars configuration
// var exphbs = require("express-handlebars");

// exphbs = require('express-handlebars'),
//   app.engine('hbs', exphbs({defaultLayout: 'main', extname: '.hbs'}));
//   partialsDir: path.join(__dirname, "/views/layouts/partials")
//   app.set('view engine', 'hbs');



// Set Handlebars.
var exphbs = require("express-handlebars");

app.engine("hbs", exphbs({
    defaultLayout: "main",
    extname: '.hbs',
    partialsDir: path.join(__dirname, "/views/layouts/partials")
}));
app.set("view engine", "hbs");



// MongoDB Connection
mongoose.connect("mongodb://localhost/week18Populater");

// Routes

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
  // First, we grab the body of the html with request
  request("https://www.nytimes.com/", function(error, response, html) {
    // Then, we load that into cheerio and save it to $ for a shorthand selector
    var $ = cheerio.load(html);
    // Now, we grab every h2 within an article tag, and do the following:
    $("article").each(function(i, element) {

      // Save an empty result object
      var result = {};

      // Add the title and summary of every link, and save them as properties of the result object
      result.title = $(this).children("h2").text();
      result.summary = $(this).children(".summary").text();
      result.link = $(this).children("h2").children("a").attr("href");

      // Using our Article model, create a new entry
      // This effectively passes the result object to the entry (and the title and link)
      var entry = new Article(result);

      // Now, save that entry to the db
      entry.save(function(err, doc) {
        // Log any errors
        if (err) {
          console.log(err);
        }
        // Or log the doc
        else {
          console.log(doc);
        }
      });

    });
        res.send("Scrape Complete");

  });
});


// Route for getting all Articles from the db
app.get("/articles", function(req, res) {
  // Grab every document in the Articles collection
  db.Article.find({})
    .then(function(dbArticle) {
      // If we were able to successfully find Articles, send them back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for grabbing a specific Article by id, populate it with it's note
app.get("/articles/:id", function(req, res) {
  // Using the id passed in the id parameter, prepare a query that finds the matching one in our db...
  db.Article.findOne({ _id: req.params.id })
    // ..and populate all of the notes associated with it
    .populate("note")
    .then(function(dbArticle) {
      // If we were able to successfully find an Article with the given id, send it back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Route for saving/updating an Article's associated Note
app.post("/articles/:id", function(req, res) {
  // Create a new note and pass the req.body to the entry
  db.Note.create(req.body)
    .then(function(dbNote) {
      // If a Note was created successfully, find one Article with an `_id` equal to `req.params.id`. Update the Article to be associated with the new Note
      // { new: true } tells the query that we want it to return the updated User -- it returns the original by default
      // Since our mongoose query returns a promise, we can chain another `.then` which receives the result of the query
      return db.Article.findOneAndUpdate({ _id: req.params.id }, { note: dbNote._id }, { new: true });
    })
    .then(function(dbArticle) {
      // If we were able to successfully update an Article, send it back to the client
      res.json(dbArticle);
    })
    .catch(function(err) {
      // If an error occurred, send it to the client
      res.json(err);
    });
});

// Save an article
app.post("/articles/save/:id", function(req, res) {
  // Use the article id to find and update its saved boolean
  Article.findOneAndUpdate({ "_id": req.params.id }, { "saved": true})
  // Execute the above query
  .exec(function(err, doc) {
    // Log any errors
    if (err) {
      console.log(err);
    }
    else {
      // Or send the document to the browser
      res.send(doc);
    }
  });
});

// Delete an article
app.post("/articles/delete/:id", function(req, res) {
  // Use the article id to find and update its saved boolean
  Article.findOneAndUpdate({ "_id": req.params.id }, {"saved": false, "notes": []})
  // Execute the above query
  .exec(function(err, doc) {
    // Log any errors
    if (err) {
      console.log(err);
    }
    else {
      // Or send the document to the browser
      res.send(doc);
    }
  });
});

// Create a new note
app.post("/notes/save/:id", function(req, res) {
// Create a new note and pass the req.body to the entry
var newNote = new Note({
body: req.body.text,
article: req.params.id
});
console.log(req.body)
// And save the new note the db
newNote.save(function(error, note) {
// Log any errors
if (error) {
  console.log(error);
}
// Otherwise
else {
  // Use the article id to find and update it's notes
  Article.findOneAndUpdate({ "_id": req.params.id }, {$push: { "notes": note } })
  // Execute the above query
  .exec(function(err) {
    // Log any errors
    if (err) {
      console.log(err);
      res.send(err);
    }
    else {
      // Or send the note to the browser
      res.send(note);
    }
  });
}
});
});

// Delete a note
app.delete("/notes/delete/:note_id/:article_id", function(req, res) {
// Use the note id to find and delete it
Note.findOneAndRemove({ "_id": req.params.note_id }, function(err) {
// Log any errors
if (err) {
  console.log(err);
  res.send(err);
}
else {
  Article.findOneAndUpdate({ "_id": req.params.article_id }, {$pull: {"notes": req.params.note_id}})
   // Execute the above query
    .exec(function(err) {
      // Log any errors
      if (err) {
        console.log(err);
        res.send(err);
      }
      else {
        // Or send the note to the browser
        res.send("Note Deleted");
      }
    });
}
});
});

// Start the server
app.listen(PORT, function() {
  console.log("App running on port " + PORT + "!");
});
