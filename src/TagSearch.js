import React, { useState } from "react";
import CreatableSelect from "react-select/creatable";

const INGREDIENT_COLOR = { light: { bg: "#f0f0f0", text: "#333" }, dark: { bg: "#252525", text: "#ddd" } };
const MENU_COLOR       = { light: { bg: "#e8f0fe", text: "#1a56db" }, dark: { bg: "#1a2540", text: "#6fa3f7" } };
const TEXT_COLOR       = { light: { bg: "#fef3c7", text: "#92400e" }, dark: { bg: "#2a1f00", text: "#f59e0b" } };

function getColors(group) {
  if (group === "menu") return MENU_COLOR;
  if (group === "text") return TEXT_COLOR;
  return INGREDIENT_COLOR;
}

function TagSearch({ onSearch, options, language, darkMode, value, onChange, onInputChange }) {
  const selected = value || [];
  const [inputValue, setInputValue] = useState("");

  const handleChange = (selectedOptions) => {
    const newSelected = selectedOptions || [];
    onChange(newSelected);
    onSearch(newSelected);
  };

  const handleCreate = (inputVal) => {
    const newTag = { value: inputVal.trim(), label: inputVal.trim(), group: "text" };
    const newSelected = [...selected, newTag];
    setInputValue("");
    if (onInputChange) onInputChange("");
    onChange(newSelected);
    onSearch(newSelected);
  };

  const handleReset = () => {
    onChange([]);
    onSearch([]);
    setInputValue("");
    if (onInputChange) onInputChange("");
  };

  const handleInputChange = (val, { action }) => {
    if (action === "input-blur" || action === "menu-close") return;
    setInputValue(val);
    if (onInputChange) onInputChange(val);
  };

  const formatGroupLabel = (group) => {
    const isMenu = group.label === "메뉴" || group.label === "Dishes";
    const filteredCount = inputValue.trim()
      ? group.options.filter(opt => opt.label.toLowerCase().includes(inputValue.toLowerCase())).length
      : group.options.length;
    return (
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: "4px 0 2px",
        fontSize: "0.7rem",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: isMenu ? (darkMode ? "#6fa3f7" : "#1a56db") : (darkMode ? "#aaa" : "#555"),
        borderTop: `1px solid ${darkMode ? "#2a2a2a" : "#f0f0f0"}`,
      }}>
        <span>{isMenu ? "🍽" : "🥕"}</span>
        <span>{group.label}</span>
        <span style={{ fontWeight: 400, opacity: 0.6 }}>({filteredCount})</span>
      </div>
    );
  };

  const formatOptionLabel = (opt) => {
    const isMenu = opt.group === "menu";
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <span style={{
          width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
          background: isMenu
            ? (darkMode ? "#6fa3f7" : "#1a56db")
            : (darkMode ? "#888" : "#bbb"),
        }} />
        <span>{opt.label}</span>
      </div>
    );
  };

  const formatCreateLabel = (inputVal) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
      color: darkMode ? "#f59e0b" : "#92400e", fontSize: "0.85rem" }}>
      <span>🔍</span>
      <span>{language === "en" ? `Search "${inputVal}"` : `"${inputVal}" 검색`}</span>
    </div>
  );

  const isValidNewOption = (inputVal) => inputVal.trim().length > 0;

  return (
    <div style={{ display: "flex", gap: "8px", width: "100%" }}>
      <div style={{ flex: 1 }}>
        <CreatableSelect
          options={options}
          isMulti
          onChange={handleChange}
          onCreateOption={handleCreate}
          value={selected}
          inputValue={inputValue}
          onInputChange={handleInputChange}
          formatCreateLabel={formatCreateLabel}
          isValidNewOption={isValidNewOption}
          createOptionPosition="first"
          placeholder={language === 'en' ? 'e.g. egg, onion, pork...' : '예) 계란, 양파, 돼지고기...'}
          classNamePrefix="react-select"
          menuShouldScrollIntoView={false}
          formatGroupLabel={formatGroupLabel}
          formatOptionLabel={formatOptionLabel}
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
            groupHeading: (base) => ({
              ...base,
              padding: "6px 12px 4px",
              marginBottom: 0,
              textAlign: 'center',
            }),
            option: (base, state) => ({
              ...base,
              fontSize: '0.85rem',
              textAlign: 'center',
              backgroundColor: state.isFocused
                ? (darkMode ? "#252525" : "#f4f4f4")
                : "transparent",
              color: darkMode ? "#eee" : "#111",
              '&:active': {
                backgroundColor: darkMode ? "#333" : "#e8e8e8",
              },
            }),
            multiValue: (base, { data }) => {
              const colors = getColors(data.group);
              return {
                ...base,
                backgroundColor: darkMode ? colors.dark.bg : colors.light.bg,
                borderRadius: '999px',
                display: 'inline-flex',
                alignItems: 'center',
                maxWidth: '160px',
              };
            },
            multiValueLabel: (base, { data }) => {
              const colors = getColors(data.group);
              return {
                ...base,
                color: darkMode ? colors.dark.text : colors.light.text,
                fontSize: '0.82rem',
                fontWeight: 500,
                paddingLeft: '10px',
                paddingRight: '4px',
                textAlign: 'center',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              };
            },
            multiValueRemove: (base, { data }) => {
              const colors = getColors(data.group);
              return {
                ...base,
                color: darkMode ? colors.dark.text : colors.light.text,
                opacity: 0.6,
                borderRadius: '0 999px 999px 0',
                paddingRight: '6px',
                '&:hover': {
                  backgroundColor: darkMode ? "#333" : "#e0e0e0",
                  color: darkMode ? "#eee" : "#111",
                  opacity: 1,
                },
              };
            },
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
      {(selected.length > 0 || inputValue.trim()) && (
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
