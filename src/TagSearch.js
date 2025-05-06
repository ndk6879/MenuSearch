import Select from "react-select";
import { useState } from "react";

function TagSearch({ onSearch, options, language, darkMode }) {
  const [selected, setSelected] = useState([]);

  const handleChange = (selectedOptions) => {
    const newSelected = selectedOptions || [];
    setSelected(newSelected);
    onSearch(newSelected); // 선택이 바뀌면 즉시 검색
  };

  const handleReset = () => {
    setSelected([]);
    onSearch([]);
  };

  

  return (
    <div style={{ display: "flex", gap: "10px", width: "100%", maxWidth: "700px" }}>
      <div style={{ flex: 1 }}>
        <Select
          options={options}
          isMulti
          onChange={handleChange}
          value={selected}
          placeholder={language === "kr" ? "메뉴를 검색하세요!" : "Select ingredients!"}
          classNamePrefix="react-select"
          theme={(theme) => ({
            ...theme,
            borderRadius: 6,
            colors: {
              ...theme.colors,
              primary25: darkMode ? "#334155" : "#e2e8f0",   // hover background
              primary: darkMode ? "#3b82f6" : "#2563eb",      // active border
              neutral0: darkMode ? "#1e293b" : "#ffffff",     // input background
              neutral80: darkMode ? "#f1f5f9" : "#1e293b",     // input text
              neutral20: darkMode ? "#475569" : "#cbd5e1",    // border color
              neutral30: darkMode ? "#64748b" : "#94a3b8",    // arrow
            },
          })}
          
          styles={{
            control: (base) => ({
              ...base,
              backgroundColor: darkMode ? "#1e293b" : "#ffffff",
              borderColor: darkMode ? "#475569" : "#cbd5e1",
              color: darkMode ? "#f1f5f9" : "#1e293b",
            }),
            menu: (base) => ({
              ...base,
              backgroundColor: darkMode ? "#1e293b" : "#ffffff",
              color: darkMode ? "#f1f5f9" : "#1e293b",
            }),
            multiValue: (base) => ({
              ...base,
              backgroundColor: darkMode ? "#334155" : "#e2e8f0",
            }),
            multiValueLabel: (base) => ({
              ...base,
              color: darkMode ? "#f1f5f9" : "#1e293b",
            }),
            placeholder: (base) => ({
              ...base,
              color: darkMode ? "#cbd5e1" : "#94a3b8",
            }),
          }}
          
        />
      </div>
      <button onClick={handleReset} className="search-button">Reset</button>
    </div>
  );
}

export default TagSearch;
