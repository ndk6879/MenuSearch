import Select from "react-select";
import { useState } from "react";

function TagSearch({ onSearch, options, language }) {
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
              primary25: "#334155",   // hover background
              primary: "#3b82f6",      // active border
              neutral0: "#1e293b",     // input background
              neutral80: "#f1f5f9",    // input text
              neutral20: "#475569",    // border color
              neutral30: "#64748b",    // arrow
            },
          })}
          styles={{
            control: (base) => ({
              ...base,
              backgroundColor: "#1e293b",
              borderColor: "#475569",
              color: "#f1f5f9",
            }),
            menu: (base) => ({
              ...base,
              backgroundColor: "#1e293b",
              color: "#f1f5f9",
            }),
            multiValue: (base) => ({
              ...base,
              backgroundColor: "#334155",
            }),
            multiValueLabel: (base) => ({
              ...base,
              color: "#f1f5f9",
            }),
            placeholder: (base) => ({
              ...base,
              color: "#cbd5e1",
            }),
          }}
        />
      </div>
      <button onClick={handleReset} className="search-button">Reset</button>
    </div>
  );
}

export default TagSearch;
