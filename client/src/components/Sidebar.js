import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { BsTwitter } from "react-icons/bs";
import { BiHome } from "react-icons/bi";
import { CgProfile } from "react-icons/cg";
import { GrLogout } from "react-icons/gr";
import { AiFillCamera } from "react-icons/ai";
import Popup from "reactjs-popup";
import "reactjs-popup/dist/index.css";
import moment from "moment";
import axios from "axios";
import jwtDecode from "jwt-decode";
import { useToast } from "@chakra-ui/toast";

function Sidebar() {
  const [activeUser, setActiveUser] = useState("");
  const [input, setInput] = useState("");
  const [img, setImg] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const fileInputRef = useRef(null);
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      const user = jwtDecode(token);
      setActiveUser(user.username);
    }
  }, []);

  const handleSidebarTweet = async (e) => {
    e.preventDefault();

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
      formData.append("imageUrl", img);
    }

    try {
      await axios.post("http://localhost:5000/feed", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setInput("");
      setImg("");
      setImageFile(null);
      toast({
        title: "Tweet posted!",
        status: "success",
        position: "top",
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: "Error posting tweet",
        status: "error",
        position: "top",
        isClosable: true,
      });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <div className="sidebar">
      <div className="sidebar-logo" style={{ marginBottom: "2rem" }}>
        <BsTwitter style={{ fontSize: "2rem", color: "#1DA1F2" }} />
      </div>
      <nav className="sidebar-nav" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "1.5rem" }}>
        <Link
          to="/feed"
          className={`sidebar-link${location.pathname === "/feed" ? " active" : ""}`}
          style={{ display: "flex", alignItems: "center", color: "#1DA1F2", fontSize: "1.2rem", gap: "0.7rem" }}
        >
          <BiHome style={{ fontSize: "1.5rem", color: "#1DA1F2" }} />
          <span>Home</span>
        </Link>
        <Link
          to={`/profile/${activeUser}`}
          className={`sidebar-link${location.pathname.startsWith("/profile") ? " active" : ""}`}
          style={{ display: "flex", alignItems: "center", color: "#1DA1F2", fontSize: "1.2rem", gap: "0.7rem" }}
        >
          <CgProfile style={{ fontSize: "1.5rem", color: "#1DA1F2" }} />
          <span>Profile</span>
        </Link>
        <button
          className="sidebar-link"
          onClick={handleLogout}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            color: "#1DA1F2",
            fontSize: "1.2rem",
            gap: "0.7rem"
          }}
        >
          <GrLogout style={{ fontSize: "1.5rem", color: "#1DA1F2" }} />
          <span>Logout</span>
        </button>
      </nav>
      <Popup
        trigger={
          <button className="tweetBtn" style={{ width: "100%", marginTop: "2rem" }}>
            Tweet
          </button>
        }
        modal
        position="center"
      >
        {(close) => (
          <div className="tweet-popup">
            <form
              onSubmit={(e) => {
                handleSidebarTweet(e);
                close();
              }}
              method="post"
              encType="multipart/form-data"
              className="tweet-form"
            >
              <input
                autoFocus
                placeholder="What's happening?"
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
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
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      setImageFile(file);
                      setImg(URL.createObjectURL(file));
                    }}
                  />
                </div>
                <input
                  className="image-input"
                  type="text"
                  placeholder="Enter an image url here"
                  value={imageFile ? "" : img}
                  onChange={(e) => {
                    setImg(e.target.value);
                    setImageFile(null);
                  }}
                />
                <button
                  className={input || img ? "tweetBtn" : "disabled"}
                  disabled={!(input || img)}
                  type="submit"
                >
                  Tweet
                </button>
              </div>
              {img && <img className="tweet-preview" src={img} alt="" />}
            </form>
          </div>
        )}
      </Popup>
    </div>
  );
}

export default Sidebar;