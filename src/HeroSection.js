import React from "react";
import "./HeroSection.css";

function HeroSection({ onScrollToSearch }) {
  return (
    <div className="hero-container">
      <div className="hero-content">
        <h1 className="hero-title">Transform the way you search recipes</h1>
        <p className="hero-subtitle">Find the perfect recipe based on what you already have</p>
        <button className="hero-button">Search Recipes</button>
      </div>

    </div>
  );
}

export default HeroSection;
