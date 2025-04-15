/* App.js */
import React, { useState } from "react";
import axios from "axios";
import "./App.css";
import TagSearch from "./TagSearch";
import menuData_kr from "./menuData_kr";
import menuData_en from "./menuData_en";

function extractYouTubeId(url) {
  const match = url.match(/(?:\?v=|\/embed\/|\.be\/|\/v\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

function App() {
  const [language, setLanguage] = useState("en");
  const [searchResults, setSearchResults] = useState(menuData_en);
  const [selectedUploader, setSelectedUploader] = useState("all");

  const currentData = language === "en" ? menuData_en : menuData_kr;

  const allIngredients = Array.from(
    new Set(currentData.flatMap((item) => item.ingredients || []))
  );

  const allUploaders = Array.from(
    new Set(currentData.map((item) => item.uploader).filter(Boolean))
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
      console.error("Elasticsearch search failed, using fallback.", error);
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

  const handleUploaderChange = (e) => {
    const uploader = e.target.value;
    setSelectedUploader(uploader);

    let filtered = currentData;

    if (uploader !== "all") {
      filtered = filtered.filter((item) => item.uploader === uploader);
    }

    setSearchResults(filtered);
  };

  return (
    <div className="container">
      

      <h1 className="title">Menu Search</h1>

      <div className="search-section">
        <button onClick={handleToggleLanguage} className="search-button">
          {language === "en" ? "🇰🇷 KR" : "🇺🇸 EN"}
        </button>

        <TagSearch
          onSearch={handleSearch}
          options={ingredientOptions}
          language={language}
        />

        {/* Optional uploader filter */}
        {/* <select onChange={handleUploaderChange} value={selectedUploader} className="search-button">
          <option value="all">All Uploaders</option>
          {allUploaders.map((uploader) => (
            <option key={uploader} value={uploader}>{uploader}</option>
          ))}
        </select> */}
      </div>

      <p className="result-count">
        {searchResults.length} of {currentData.length} results
      </p>

      <ul className="menu-list grid-list">
        {searchResults.length > 0 ? (
          searchResults.map((item, idx) => (
            <li key={idx} className="menu-card">
              <div className="menu-content">
                {item.url && (
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={`https://img.youtube.com/vi/${extractYouTubeId(item.url)}/0.jpg`}
                      alt="thumbnail"
                      className="menu-thumbnail large-thumbnail"
                    />
                  </a>
                )}
                <div className="menu-text">
                  <div className="menu-name">🍽️ {item.name || "No Name"}</div>
                  <div className="menu-ingredients">
                    🥕 {item.ingredients?.join(", ") || "No Ingredients Info"}
                  </div>
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
