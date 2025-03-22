/* eslint-disable */
import "./App.css";
import { useState } from "react";
import TagSearch from "./TagSearch";

function App() {
  const menu = {
    "Omelet": ["Egg", "Tomato"],
    "Fried Rice": ["Egg", "Rice"],
    "Alio Olio": ["Garlic", "Pasta"],
    "Egg Pasta": ["Egg", "Pasta"]
  };

  const [searchResults, setSearchResults] = useState(Object.keys(menu));

  const allIngredients = Array.from(
    new Set(Object.values(menu).flat())
  );

  const ingredientOptions = allIngredients.map(ing => ({
    value: ing,
    label: ing
  }));

  const handleSearch = (selected) => {
    if (selected.length === 0) {
      setSearchResults(Object.keys(menu));
      return;
    }

    const selectedValues = selected.map(opt => opt.value);

    const matched = Object.entries(menu)
      .filter(([_, ingredients]) =>
        selectedValues.every(val => ingredients.includes(val))
      )
      .map(([name]) => name);

    setSearchResults(matched);
  };

  return (
    <div className="container">
      <h1 className="title">Menu Search</h1>

      <div className="search-section">
        <TagSearch onSearch={handleSearch} options={ingredientOptions} />
      </div>

      <p className="result-count">
        {searchResults.length} of {Object.keys(menu).length} results
      </p>

      <ul className="menu-list">
        {searchResults.length > 0 ? (
          searchResults.map((menuName, idx) => (
            <li key={idx} className="menu-card">
              <div className="menu-name">{menuName}</div>
              <div className="menu-ingredients">
                {menu[menuName].join(", ")}
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
