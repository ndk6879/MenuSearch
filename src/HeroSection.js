// HeroSection.js
import React from "react";
import "./HeroSection.css";

export default function HeroSection({ onScrollToSearch }) {
  return (
    <div className="hero-container">
     
      <div className="hero-content">
        <h1>Transform the way you search recipes</h1>
        <p>Find dishes with just the ingredients you have</p>
        <button onClick={onScrollToSearch}>Get Started</button>
      </div>
    </div>
  );
}
