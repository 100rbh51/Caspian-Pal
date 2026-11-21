import React, { useState } from 'react';
import { 
  FaHome, 
  FaVideo, 
  FaRegCommentDots, 
  FaSearch, 
  FaRegUser, 
  FaBell, 
  FaShareAlt, 
  FaPlay 
] from 'react-icons/fa';

const WelcomeScreen = ({ userData }) => {
  // 5 tabs ke liye active state manage karne ke liye
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="home-container">
      {/* Top Header with Notification Icon */}
      <div className="header">
        <div className="user-profile">
          <img src={userData?.avatar || "default-avatar.png"} alt="Profile" className="avatar" />
          <div>
            <h3>{userData?.name || "Caspian Pal"}</h3>
            <span className="badge">✔ Verified & Live</span>
          </div>
        </div>
        
        {/* Top Right Notification Icon */}
        <div className="notification-wrapper">
          <FaBell className="notification-icon" />
          <span className="notification-dot"></span>
        </div>
      </div>

      {/* Dynamic Content based on Active Tab */}
      <div className="content-area">
        {activeTab === 'home' && (
          <>
            <div className="welcome-banner">
              <span className="verified-tag">Verified Account</span>
              <h2>Welcome to Caspian Pal App!</h2>
              <p>Your account has been successfully verified via OTP. Enjoy direct broadcasts and updates!</p>
            </div>

            <div className="post-card">
              <div className="post-header">
                <span className="time">Just now</span>
                <FaShareAlt className="share-icon" />
              </div>
              <p className="post-text">
                Namaskar Dosto! 5-Tab navigation aur notification icon successfully setup ho chuke hain. 🔥
              </p>
              <div className="media-box">
                <div className="play-button-overlay">
                  <FaPlay className="play-icon" />
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'reels' && <div className="tab-view">Reels Section (Coming Soon)</div>}
        {activeTab === 'message' && <div className="tab-view">Message / Chat Section</div>}
        {activeTab === 'search' && <div className="tab-view">Search Section</div>}
        {activeTab === 'profile' && <div className="tab-view">Profile Section</div>}
      </div>

      {/* 5-Tab Bottom Navigation Bar (Home, Reels, Message, Search, Profile) */}
      <div className="bottom-nav">
        <div 
          className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
        >
          <FaHome />
          <span>Home</span>
        </div>

        <div 
          className={`nav-item ${activeTab === 'reels' ? 'active' : ''}`}
          onClick={() => setActiveTab('reels')}
        >
          <FaVideo />
          <span>Reels</span>
        </div>

        <div 
          className={`nav-item ${activeTab === 'message' ? 'active' : ''}`}
          onClick={() => setActiveTab('message')}
        >
          <FaRegCommentDots />
          <span>Message</span>
        </div>

        <div 
          className={`nav-item ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          <FaSearch />
          <span>Search</span>
        </div>

        <div 
          className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          <FaRegUser />
          <span>Profile</span>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;