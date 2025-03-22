import Select from "react-select";
import { useState } from "react";

function TagSearch({ onSearch, options }) {
  const [selected, setSelected] = useState([]);

  const handleChange = (selectedOptions) => {
    setSelected(selectedOptions || []);
  };

  const handleSubmit = () => {
    onSearch(selected);
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
          placeholder="Select ingredients..."
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
      <button onClick={handleSubmit} className="search-button">Search</button>
      <button onClick={handleReset} className="search-button">Reset</button>
    </div>
  );
}

export default TagSearch;
