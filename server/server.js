const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const moment = require("moment");
const cors = require("cors");
const { User, Tweet, Comment } = require("./models/File");
const app = express();
const multer = require("multer");
const path = require("path");




app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use("/images", express.static("images"));
app.use("/tweetImages", express.static("tweetImages"));

// Multer storage for tweet images
const tweetImageStorage = multer.diskStorage({
  destination: "tweetImages",
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});
const tweetImageUpload = multer({
  storage: tweetImageStorage,
  fileFilter: (req, file, cb) => {
    const pattern = /jpg|png|jpeg/;
    if (pattern.test(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb("Error: not a valid file");
    }
  },
});

// Multer storage for avatars
const avatarStorage = multer.diskStorage({
  destination: "images",
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});
const avatarUpload = multer({
  storage: avatarStorage,
  fileFilter: (req, file, cb) => {
    const pattern = /jpg|png|jpeg/;
    if (pattern.test(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb("Error: not a valid file");
    }
  },
});

mongoose.connect("mongodb://127.0.0.1/mernDB", (err) => {
  if (err) console.log(err);
  else console.log("mongodb is connected");
});

// Sign in
app.post("/", (req, res) => {
  const userLogin = req.body;
  User.findOne({ username: userLogin.username }).then((dbUser) => {
    if (!dbUser) {
      return res.json({ status: "error", error: "Invalid login" });
    }
    bcrypt.compare(userLogin.password, dbUser.password).then((isCorrect) => {
      if (isCorrect) {
        const payload = {
          id: dbUser._id,
          username: dbUser.username,
        };
        const token = jwt.sign(payload, "newSecretKey", { expiresIn: 86400 });
        return res.json({ status: "ok", user: token });
      } else {
        return res.json({ status: "error", user: false });
      }
    });
  });
});

// Sign up
app.post("/signup", async (req, res) => {
  const user = req.body;
  const takenUsername = await User.findOne({ username: user.username });

  if (takenUsername) {
    return res.json({ status: "error", error: "username already taken" });
  } else {
    user.password = await bcrypt.hash(req.body.password, 10);

    const dbUser = new User({
      username: user.username.toLowerCase(),
      password: user.password,
      avatar: "initial-avatar.png",
    });

    dbUser.save();
    return res.json({ status: "ok" });
  }
});

// Get feed
app.get("/feed", async (req, res) => {
  const token = req.headers["x-access-token"];
  const tweetsToSkip = req.query.t || 0;

  try {
    const decoded = jwt.verify(token, "newSecretKey");
    const username = decoded.username;
    const user = await User.findOne({ username: username });
    Tweet.find({ isRetweeted: false })
      .populate("postedBy")
      .populate("comments")
      .sort({ createdAt: -1 })
      .skip(tweetsToSkip)
      .limit(20)
      .exec((err, docs) => {
        if (!err) {
          docs.forEach((doc) => {
            doc.likeTweetBtn = doc.likes.includes(username) ? "deeppink" : "black";
            doc.save();
            doc.comments.forEach((docComment) => {
              docComment.likeCommentBtn = docComment.likes.includes(username) ? "deeppink" : "black";
              docComment.save();
            });
            doc.retweetBtn = doc.retweets.includes(username) ? "green" : "black";
          });

          return res.json({
            status: "ok",
            tweets: docs,
            activeUser: user,
          });
        }
      });
  } catch (error) {
    return res.json({ status: "error", error: "Session ended :(" });
  }
});

// Get comments for a tweet
app.get("/feed/comments/:tweetId", (req, res) => {
  Tweet.find({ postedTweetTime: req.params.tweetId })
    .populate("postedBy")
    .populate({
      path: "comments",
      populate: [{ path: "postedBy" }],
    })
    .exec((err, tweet) => {
      if (!err) {
        return res.json({ status: "ok", tweet: tweet });
      } else return res.json({ status: "error", error: "comments not found" });
    });
});

// Compose tweet with image upload (POPULATE postedBy before sending)
app.post("/feed", tweetImageUpload.single("image"), (req, res) => {
  const info = req.body;
  const tweetInfo = JSON.parse(req.body.tweet);

  let imagePath = "";
  if (req.file) {
    imagePath = `/tweetImages/${req.file.filename}`;
  } else if (info.imageUrl) {
    imagePath = info.imageUrl;
  }

  Tweet.create(
    {
      content: tweetInfo.content,
      retweets: [],
      postedTweetTime: moment().format("MMMM Do YYYY, h:mm:ss a"),
      image: imagePath,
    },
    (err, newTweet) => {
      if (!err) {
        User.findOne({ username: tweetInfo.postedBy.username }, (err, doc) => {
          if (!err) {
            newTweet.postedBy = doc._id;
            if (newTweet.postedBy) {
              newTweet.save();
              doc.tweets.unshift(newTweet._id);
              doc.save();
              // Populate postedBy before sending response!
              Tweet.findById(newTweet._id)
                .populate("postedBy")
                .exec((err, populatedTweet) => {
                  return res.json({ status: "ok", tweet: populatedTweet });
                });
            } else
              return res.json({ status: "error", error: "An error occurred" });
          } else
            return res.json({ status: "error", error: "An error occurred" });
        });
      }
    }
  );
});

// Compose comment
app.post("/feed/comment/:tweetId", (req, res) => {
  Comment.create(
    {
      content: req.body.content,
      postedCommentTime: moment().format("MMMM Do YYYY, h:mm:ss a"),
    },
    (err, newComment) => {
      if (!err) {
        Tweet.findOne({ postedTweetTime: req.params.tweetId }, (err, doc) => {
          if (!err) {
            User.findOne(
              { username: req.body.postedBy.username },
              (err, user) => {
                if (!err) {
                  newComment.postedBy = user._id;
                  if (newComment.postedBy) {
                    newComment.save();
                    doc.comments.unshift(newComment._id);
                    doc.save();
                  } else
                    return res.json({
                      status: "error",
                      error: "An error occurred",
                    });
                }
              }
            );

            return res.json({
              comments: doc.comments.length,
              docs: doc.comments,
            });
          } else
            return res.json({ status: "error", error: "An error occurred" });
        });
      }
    }
  );
});

// Retweet
app.route("/post/:userName/retweet/:tweetId").post((req, res) => {
  Tweet.findOne({ postedTweetTime: req.params.tweetId }, (err, doc) => {
    if (!err) {
      if (!doc.retweets.includes(req.params.userName)) {
        Tweet.create(
          {
            content: doc.content,
            postedBy: doc.postedBy,
            likes: doc.likes,
            likeTweetBtn: doc.likeTweetBtn,
            image: doc.image,
            postedTweetTime: doc.postedTweetTime,
            retweetedByUser: req.params.userName,
            isRetweeted: true,
            retweetBtn: "green",
            retweets: [req.params.userName],
          },
          (err, newTweet) => {
            if (!err) {
              User.findOne({ username: req.params.userName }, (err, doc) => {
                if (!err) {
                  doc.tweets.unshift(newTweet._id);
                  doc.save();
                }
              });
            }
          }
        );
        doc.retweets.push(req.params.userName);
        doc.retweetBtn = "green";
        doc.save();
      } else {
        const user = req.params.user;
        Tweet.find({})
          .populate("postedBy")
          .deleteOne(
            {
              "postedBy.username": user,
              content: doc.content,
              isRetweeted: true,
            },
            (err, res) => {
              // deleted
            }
          );
        let indexForRetweets = doc.retweets.indexOf(req.params.userName);
        doc.retweets.splice(indexForRetweets, 1);
        doc.retweetBtn = "black";
        doc.save();
      }
    }
  });
});

// Like tweet
app.route("/post/:userName/like/:tweetId").post((req, res) => {
  Tweet.find({ postedTweetTime: req.params.tweetId }, (err, docs) => {
    docs.forEach((doc) => {
      if (!err) {
        if (!doc.likes.includes(req.params.userName)) {
          doc.likes.push(req.params.userName);
          doc.likeTweetBtn = "deeppink";
          doc.save();
        } else {
          let indexForLikes = doc.likes.indexOf(req.params.userName);
          doc.likes.splice(indexForLikes, 1);
          doc.likeTweetBtn = "black";
          doc.save();
        }
      }
    });
  });
});

// Like comment
app.route("/comment/:userName/like/:commentId").post((req, res) => {
  Comment.findOne({ postedCommentTime: req.params.commentId }, (err, doc) => {
    if (!err) {
      if (!doc.likes.includes(req.params.userName)) {
        doc.likes.push(req.params.userName);
        doc.likeCommentBtn = "deeppink";
        doc.save();
        return res.json({ btnColor: "deeppink", likes: doc.likes.length });
      } else {
        let indexForLikes = doc.likes.indexOf(req.params.userName);
        doc.likes.splice(indexForLikes, 1);
        doc.likeCommentBtn = "black";
        doc.save();
        return res.json({ btnColor: "black", likes: doc.likes.length });
      }
    }
  });
});

// Delete tweet
app.route("/deleteTweet/:tweetId").post((req, res) => {
  Tweet.findOneAndDelete({ postedTweetTime: req.params.tweetId }, (err) => {
    if (!err) {
      return res.json({ status: "ok" });
    }
  });
});

// Delete comment
app.route("/deleteComment/:commentId").post((req, res) => {
  Comment.findOneAndDelete(
    { postedCommentTime: req.params.commentId },
    (err) => {
      if (!err) {
        return res.json({ status: "ok" });
      }
    }
  );
});

// Edit tweet
app.route("/editTweet/:tweetId").post((req, res) => {
  Tweet.findOne({ postedTweetTime: req.params.tweetId }, (err, doc) => {
    doc.content = req.body.content;
    doc.isEdited = true;
    doc.save();
    return res.json({ status: "ok" });
  });
});

// Edit comment
app.route("/editComment/:commentId").post((req, res) => {
  Comment.findOne({ postedCommentTime: req.params.commentId }, (err, doc) => {
    doc.content = req.body.content;
    doc.isEdited = true;
    doc.save();
    return res.json({ status: "ok" });
  });
});

// Upload avatar
app.post("/avatar/:userName", avatarUpload.single("avatar"), (req, res) => {
  User.findOne({ username: req.params.userName }, (err, user) => {
    if (!err) {
      if (req.file) {
        user.avatar = req.file.filename;
        user.save();
        return res.json({ status: "ok", avatar: req.file.filename });
      } else if (req.body.avatar) {
        user.avatar = req.body.avatar;
        user.save();
        return res.json({ status: "ok", avatar: req.body.avatar });
      }
    } else return res.json({ status: "error", error: "Please upload again" });
  });
});

// User profile
app.get("/profile/:userName", async (req, res) => {
  const token = req.headers["x-access-token"];
  try {
    const decoded = jwt.verify(token, "newSecretKey");
    const username = decoded.username;
    User.findOne({ username: req.params.userName })
      .populate({
        path: "tweets",
        populate: [
          { path: "postedBy" },
          { path: "comments", populate: [{ path: "postedBy" }] },
        ],
      })
      .exec((err, doc) => {
        if (!err) {
          doc.followBtn = doc.followers.includes(username) ? "Following" : "Follow";
          doc.tweets.forEach((tweet) => {
            tweet.likeTweetBtn = tweet.likes.includes(username) ? "deeppink" : "black";
            tweet.retweetBtn = tweet.retweets.includes(username) ? "green" : "black";
          });
          return res.json({
            status: "ok",
            tweets: doc.tweets,
            followers: doc.followers.length,
            followBtn: doc.followBtn,
            activeUser: username,
            avatar: doc.avatar,
          });
        }
      });
  } catch (error) {
    return res.json({ status: "error", error: "invalid token" });
  }
});

// Follow/unfollow
app.route("/user/:user/follow/:userName").post((req, res) => {
  User.findOne({ username: req.params.userName }, (err, doc) => {
    if (!err) {
      if (doc.username !== req.params.user) {
        if (!doc.followers.includes(req.params.user)) {
          doc.followers.push(req.params.user);
          doc.followBtn = "Following";
          doc.save();
        } else {
          let indexForUnFollow = doc.followers.indexOf(req.params.user);
          doc.followers.splice(indexForUnFollow, 1);
          doc.followBtn = "Follow";
          doc.save();
        }
        return res.json({
          followers: doc.followers.length,
          followBtn: doc.followBtn,
        });
      }
    }
  });
});

// Search users
app.get("/search/:user", (req, res) => {
  User.find(
    { username: { $regex: `${req.params.user}`, $options: "i" } },
    function (err, docs) {
      if (!err) {
        return res.json({ status: "ok", users: docs });
      } else return res.json({ status: "error", error: err });
    }
  );
});

app.listen("5000", () => {
  console.log("server running on port 5000");
});