import React from "react";
import "./HeroSection.css";

function HeroSection({ onScrollToSearch }) {
  return (
    <div className="hero-container">
      <div className="hero-content">
      <h6 className="hero-title">나의 재료로 레시피를 찾아보세요 </h6>
      <p className="hero-subtitle">“하이엔드 요리를 쉽게” — 공격수 셰프</p>
      <button className="hero-button" onClick={onScrollToSearch}> 레시피 찾기</button>

      </div>
    </div>
  );
}

export default HeroSection;
