/* App.js */
import React, { useState } from "react";
import "./App.css";
import TagSearch from "./TagSearch";
import menuData from "./menuData";

function extractYouTubeId(url) {
  const match = url.match(/(?:\?v=|\/embed\/|\.be\/|\/v\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

function App() {
  const [searchResults, setSearchResults] = useState(menuData);

  const allIngredients = Array.from(
    new Set(menuData.flatMap((item) => item.ingredients || []))
  );

  const ingredientOptions = allIngredients.map((ing) => ({
    value: ing,
    label: ing,
  })).sort((a, b) => a.label.localeCompare(b.label));

  const handleSearch = (selected) => {
    if (selected.length === 0) {
      setSearchResults(menuData);
      return;
    }

    const selectedValues = selected.map((opt) => opt.value);
    const matched = menuData.filter((item) =>
      selectedValues.every((val) => item.ingredients?.includes(val))
    );

    setSearchResults(matched);
  };

  return (
    <div className="container">
      <h1 className="title">Menu Search</h1>

      <div className="search-section">
        <TagSearch onSearch={handleSearch} options={ingredientOptions} />
      </div>

      <p className="result-count">
        {searchResults.length} of {menuData.length} results
      </p>

      <ul className="menu-list">
        {searchResults.length > 0 ? (
          searchResults.map((item, idx) => (
            <li key={idx} className="menu-card">
              <div className="menu-content">
                {item.url && (
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={`https://img.youtube.com/vi/${extractYouTubeId(item.url)}/0.jpg`}
                      alt="썸네일"
                      className="menu-thumbnail large-thumbnail"
                    />
                  </a>
                )}
                <div className="menu-text">
                  <div className="menu-name">🍽️ {item.name || "이름 없음"}</div>
                  <div className="menu-ingredients">
                    🥕 {item.ingredients?.join(", ") || "재료 정보 없음"}
                  </div>
                  {item.uploader && <div className="menu-uploader">👨‍🍳 {item.uploader}</div>}
                  {item.tip && <div className="menu-tip">💡 {item.tip}</div>}
                </div>
              </div>
            </li>
          ))
        ) : (
          <p className="no-results">No matching menu found.</p>
        )}
      </ul>
    </div>
  );
}

export default App;
