import Select from "react-select";
import { useState } from "react";

function TagSearch({ onSearch, options, language, darkMode }) {
  const [selected, setSelected] = useState([]);

  const handleChange = (selectedOptions) => {
    const newSelected = selectedOptions || [];
    setSelected(newSelected);
    onSearch(newSelected);
  };

  const handleReset = () => {
    setSelected([]);
    onSearch([]);
  };

  return (
    <div style={{ display: "flex", gap: "8px", width: "100%" }}>
      <div style={{ flex: 1 }}>
        <Select
          options={options}
          isMulti
          onChange={handleChange}
          value={selected}
          placeholder={language === 'en' ? 'Search ingredients...' : '재료를 검색하세요...'}
          classNamePrefix="react-select"
          menuShouldScrollIntoView={false}
          theme={(theme) => ({
            ...theme,
            borderRadius: 10,
            colors: {
              ...theme.colors,
              primary25: darkMode ? "#252525" : "#f4f4f4",
              primary: darkMode ? "#555" : "#111",
              neutral0: darkMode ? "#1a1a1a" : "#ffffff",
              neutral80: darkMode ? "#eee" : "#111",
              neutral20: darkMode ? "#333" : "#e0e0e0",
              neutral30: darkMode ? "#444" : "#ccc",
            },
          })}
          styles={{
            control: (base, state) => ({
              ...base,
              minHeight: '44px',
              backgroundColor: darkMode ? "#1a1a1a" : "#ffffff",
              borderColor: state.isFocused
                ? (darkMode ? "#555" : "#999")
                : (darkMode ? "#333" : "#e0e0e0"),
              boxShadow: state.isFocused
                ? `0 0 0 1px ${darkMode ? "#555" : "#999"}`
                : "0 1px 3px rgba(0,0,0,0.04)",
              borderRadius: '10px',
              fontSize: '0.9rem',
              '&:hover': {
                borderColor: darkMode ? "#444" : "#bbb",
              },
            }),
            menu: (base) => ({
              ...base,
              backgroundColor: darkMode ? "#1a1a1a" : "#ffffff",
              border: `1px solid ${darkMode ? "#333" : "#e0e0e0"}`,
              borderRadius: '10px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              overflow: 'hidden',
            }),
            option: (base, state) => ({
              ...base,
              fontSize: '0.85rem',
              backgroundColor: state.isFocused
                ? (darkMode ? "#252525" : "#f4f4f4")
                : "transparent",
              color: darkMode ? "#eee" : "#111",
              '&:active': {
                backgroundColor: darkMode ? "#333" : "#e8e8e8",
              },
            }),
            multiValue: (base) => ({
              ...base,
              backgroundColor: darkMode ? "#252525" : "#f0f0f0",
              borderRadius: '6px',
            }),
            multiValueLabel: (base) => ({
              ...base,
              color: darkMode ? "#ddd" : "#333",
              fontSize: '0.82rem',
              fontWeight: 500,
            }),
            multiValueRemove: (base) => ({
              ...base,
              color: darkMode ? "#888" : "#999",
              borderRadius: '0 6px 6px 0',
              '&:hover': {
                backgroundColor: darkMode ? "#333" : "#e0e0e0",
                color: darkMode ? "#eee" : "#111",
              },
            }),
            placeholder: (base) => ({
              ...base,
              color: darkMode ? "#666" : "#aaa",
              fontSize: '0.9rem',
            }),
            input: (base) => ({
              ...base,
              color: darkMode ? "#eee" : "#111",
            }),
          }}
        />
      </div>
      {selected.length > 0 && (
        <button
          onClick={handleReset}
          className="dark-toggle"
          style={{ whiteSpace: 'nowrap' }}
        >
          Reset
        </button>
      )}
    </div>
  );
}

export default TagSearch;
