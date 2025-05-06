import React, { useState, useRef } from "react";
import axios from "axios";
import "./App.css";
import TagSearch from "./TagSearch";
import menuData_kr from "./menuData_kr";
import menuData_en from "./menuData_en";
import HeroSection from "./HeroSection";
import { FaGithub, FaInstagram } from "react-icons/fa";

function extractYouTubeId(url) {
  const match = url.match(/(?:\?v=|\/embed\/|\.be\/|\/v\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

function App() {
  const [language, setLanguage] = useState("en");
  const [searchResults, setSearchResults] = useState(menuData_en);
  const [selectedUploader, setSelectedUploader] = useState("all");
  const [darkMode, setDarkMode] = useState(false);

  const currentData = language === "en" ? menuData_en : menuData_kr;

  const allIngredients = Array.from(
    new Set(currentData.flatMap((item) => item.ingredients || []))
  );

  const ingredientOptions = allIngredients
    .map((ing) => ({ value: ing, label: ing }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const handleSearch = async (selected) => {
    if (selected.length === 0) {
      setSearchResults(currentData);
      return;
    }

    const selectedValues = selected.map((opt) => opt.value);

    try {
      const res = await axios.post("/menus/_search", {
        size: 1000,
        query: {
          bool: {
            must: selectedValues.map((val) => ({
              match: { ingredients: val },
            })),
          },
        },
      });

      const results = res.data.hits.hits.map((hit) => hit._source);
      let filtered = results;

      if (selectedUploader !== "all") {
        filtered = filtered.filter((item) => item.uploader === selectedUploader);
      }

      setSearchResults(filtered);
    } catch (error) {
      let fallbackResults = currentData.filter((item) =>
        selectedValues.every((val) => item.ingredients?.includes(val))
      );
      setSearchResults(fallbackResults);
    }
  };

  const handleToggleLanguage = () => {
    const newLang = language === "en" ? "kr" : "en";
    setLanguage(newLang);
    setSearchResults(newLang === "en" ? menuData_en : menuData_kr);
    setSelectedUploader("all");
  };

  const toggleDarkMode = () => setDarkMode((prev) => !prev);
  const searchRef = useRef(null);
  const scrollToSearch = () => searchRef.current?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className={darkMode ? "app dark" : "app light"}>
      {/* 🔥 Header Start */}
      <header className="header">
        {/* 왼쪽: 로고 Findish */}
        <div className="header-left">
          <span className="header-logo">Findish</span>
        </div>

        {/* 오른쪽: 메뉴들 */}
        <div className="header-right">
          <a href="#about" className="header-link">About</a>
          <a href="https://github.com/ndk6879/menu-search" target="_blank" rel="noopener noreferrer">
            <FaGithub size={20} color={darkMode ? "#ccc" : "#333"} />
          </a>
          <a href="https://www.instagram.com/YOUR_ID" target="_blank" rel="noopener noreferrer">
            <FaInstagram size={20} color="#E1306C" />
          </a>
          
          <button onClick={toggleDarkMode} className="search-button">
            {darkMode ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      {/* 🔥 Header End */}

      <HeroSection onScrollToSearch={scrollToSearch} />

      <div className="container" ref={searchRef}>
      <h1 className="title">🍽️ Findish</h1>

        <div className="search-section">
        <button onClick={handleToggleLanguage} className="search-button">
            {language === "en" ? "🇰🇷 KR" : "🇺🇸 EN"}
          </button>
          
          <TagSearch
            onSearch={handleSearch}
            options={ingredientOptions}
            language={language}
            darkMode={darkMode}
          />
          
        </div>

        <p className="result-count">
          {searchResults.length} of {currentData.length} results
        </p>

        <ul className="menu-list grid-list">
          {searchResults.length > 0 ? (
            searchResults.map((item, idx) => (
              <li key={idx} className="menu-card">
                {item.url && (
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={`https://img.youtube.com/vi/${extractYouTubeId(item.url)}/hqdefault.jpg`}
                      alt="thumbnail"
                      className="menu-thumbnail"
                    />
                  </a>
                )}
                <div className="menu-text">
                  <div className="menu-name">🍽️ {item.name || "No Name"}</div>
                  <div className="menu-ingredients">
                    🥕 {item.ingredients?.join(", ") || "No Ingredients Info"}
                  </div>
                </div>
              </li>
            ))
          ) : (
            <p className="no-results">No matching menu found.</p>
          )}
        </ul>
      </div>
    </div>
  );
}

export default App;
