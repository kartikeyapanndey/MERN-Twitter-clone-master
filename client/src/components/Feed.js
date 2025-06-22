import React, { useState, useEffect, useRef } from "react";
import Tweet from "./Tweet";
import { useNavigate } from "react-router-dom";
import { AiFillCamera } from "react-icons/ai";
import axios from "axios";
import jwtDecode from "jwt-decode";
import moment from "moment";

function Feed() {
  const [input, setInput] = useState("");
  const [tweets, setTweets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeUser, setActiveUser] = useState("");
  const [userAvatar, setUserAvatar] = useState("");
  const [img, setImg] = useState(""); // For image URL or preview
  const [imageFile, setImageFile] = useState(null); // For file upload
  const [tweetCount, setTweetCount] = useState(20);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const checkInput = input || img;

  // Fetch tweets from backend
  const populateTweets = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      return;
    }
    try {
      const req = await fetch("http://localhost:5000/feed", {
        headers: {
          "x-access-token": token,
        },
      });
      const data = await req.json();
      if (data.status === "ok") {
        setTweets(data.tweets);
        setActiveUser(data.activeUser.username);
        setUserAvatar(data.activeUser.avatar);
      } else {
        setTweets([]);
        setActiveUser("");
        setUserAvatar("");
      }
    } catch (err) {
      setTweets([]);
      setActiveUser("");
      setUserAvatar("");
    } finally {
      setLoading(false);
    }
  };

  // Add more tweets (pagination)
  const addTweets = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    if (!token) {
      return;
    }
    try {
      const req = await fetch(`http://localhost:5000/feed?t=${tweetCount}`, {
        headers: {
          "x-access-token": token,
        },
      });
      const data = await req.json();
      if (data.status === "ok") {
        setTweets((prevTweets) => [...prevTweets, ...data.tweets]);
        setTweetCount((prevValue) => parseInt(prevValue) + 20);
      }
    } catch (err) {
      // Optionally handle error
    }
  };

  // On mount, check token and fetch tweets
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const user = jwtDecode(token);
        if (!user) {
          localStorage.removeItem("token");
          navigate("/");
        } else {
          setLoading(true);
          populateTweets();
        }
      } catch (e) {
        localStorage.removeItem("token");
        navigate("/");
      }
    } else {
      navigate("/");
    }
    // eslint-disable-next-line
  }, []);

  // Handlers for tweet compose
  const handleChange = (e) => setInput(e.target.value);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setImg(URL.createObjectURL(file)); // Only for preview
  };

  const handleImageUrlChange = (e) => {
    setImg(e.target.value);
    setImageFile(null); // Clear file if URL is entered
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/");
      return;
    }

    const tweet = {
      content: input,
      postedBy: {
        username: activeUser,
      },
      image: "",
      likes: [],
      retweets: [],
      comments: [],
      likeTweetBtn: "black",
      postedTweetTime: moment().format("MMMM Do YYYY, h:mm:ss a"),
      tweetId: moment(),
    };

    const formData = new FormData();
    formData.append("tweet", JSON.stringify(tweet));
    if (imageFile) {
      formData.append("image", imageFile);
    } else if (img && !imageFile) {
      formData.append("imageUrl", img); // Only if user entered a URL
    }

    try {
      await axios.post("http://localhost:5000/feed", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          "x-access-token": token,
        },
      });
      setInput("");
      setImg("");
      setImageFile(null);
      setLoading(true);
      setTimeout(() => {
        populateTweets();
      }, 300);
    } catch (error) {
      // Optionally handle error
    }
  };

  // If not authenticated, show a message instead of blank/redirect loop
  if (!localStorage.getItem("token")) {
    return <div style={{ color: "red", textAlign: "center", marginTop: "2rem" }}>Please log in to view your feed.</div>;
  }

  return (
    <div>
      <div className="form-flex">
        <img
          className="tweet-avatar"
          style={{ marginBottom: "0" }}
          src={`http://localhost:5000/images/${userAvatar}`}
          alt="avatar"
        />

        <form
          onSubmit={handleSubmit}
          method="post"
          encType="multipart/form-data"
          action="http://localhost:5000/feed"
          className="tweet-form"
          id="form"
        >
          <input
            autoFocus
            placeholder="What's happening?"
            type="text"
            value={input}
            onChange={handleChange}
          />
          <div className="tweet-flex">
            <div>
              <AiFillCamera
                style={{
                  color: "#1DA1F2",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                }}
                onClick={() => fileInputRef.current.click()}
              />
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                ref={fileInputRef}
                onChange={handleFileChange}
              />
            </div>

            <input
              className="image-input"
              type="text"
              placeholder="Enter an image url here"
              value={imageFile ? "" : img}
              onChange={handleImageUrlChange}
            />

            <button
              className={checkInput ? "tweetBtn" : "disabled"}
              disabled={!checkInput}
              type="submit"
            >
              Tweet
            </button>
          </div>
          {/* Show preview only if there is an image (file or URL) */}
          {img && <img className="tweet-preview" src={img} alt="" />}
        </form>
      </div>

      <div className="tweets">
        <ul className="tweet-list">
          {loading ? (
            <div
              style={{ marginTop: "50px", marginLeft: "250px" }}
              className="loadingio-spinner-rolling-uzhdebhewyj"
            >
              <div className="ldio-gkgg43sozzi">
                <div></div>
              </div>
            </div>
          ) : (
            tweets.map((tweet, idx) => (
              <Tweet
                key={idx}
                updateLoading={setLoading}
                user={activeUser}
                body={tweet}
              />
            ))
          )}
        </ul>
      </div>
      <form className="showMore-form" onSubmit={addTweets}>
        <button className="showMore" type="submit">
          Show more tweets
          </button>
      </form>
    </div>
  );
}

export default Feed;