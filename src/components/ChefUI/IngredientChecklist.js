import { useState } from "react";

export default function IngredientChecklist({ recipeName, ingredients, darkMode }) {
  const [checked, setChecked] = useState({});

  const toggle = (i) => setChecked(prev => ({ ...prev, [i]: !prev[i] }));
  const checkedCount = Object.values(checked).filter(Boolean).length;

  return (
    <div className="chef-checklist">
      <div className="chef-checklist-header">
        <span className="chef-checklist-title">{recipeName} 재료</span>
        <span className="chef-checklist-count">{checkedCount}/{ingredients.length}</span>
      </div>
      <ul className="chef-checklist-list">
        {ingredients.map((ing, i) => (
          <li
            key={i}
            className={`chef-checklist-item${checked[i] ? " done" : ""}`}
            onClick={() => toggle(i)}
          >
            <span className="chef-checklist-check">{checked[i] ? "✓" : ""}</span>
            <span className="chef-checklist-ing">{ing}</span>
          </li>
        ))}
      </ul>
      {checkedCount === ingredients.length && ingredients.length > 0 && (
        <p className="chef-checklist-complete">재료 준비 완료!</p>
      )}
    </div>
  );
}
