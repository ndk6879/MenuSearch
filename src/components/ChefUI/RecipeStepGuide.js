import { useState } from "react";

export default function RecipeStepGuide({ recipeName, steps, darkMode }) {
  const [current, setCurrent] = useState(0);

  return (
    <div className="chef-stepguide">
      <div className="chef-stepguide-header">
        <span className="chef-stepguide-title">{recipeName} 만들기</span>
        <span className="chef-stepguide-progress">{current + 1} / {steps.length}</span>
      </div>
      <div className="chef-stepguide-cards">
        {steps.map((step, i) => (
          <div
            key={i}
            className={`chef-step-card${i === current ? " active" : i < current ? " done" : ""}`}
            onClick={() => setCurrent(i)}
          >
            <span className="chef-step-num">{i + 1}</span>
            <span className="chef-step-text">{step}</span>
          </div>
        ))}
      </div>
      <div className="chef-stepguide-nav">
        <button
          className="chef-step-btn"
          onClick={() => setCurrent(c => Math.max(0, c - 1))}
          disabled={current === 0}
        >
          이전
        </button>
        <button
          className="chef-step-btn primary"
          onClick={() => setCurrent(c => Math.min(steps.length - 1, c + 1))}
          disabled={current === steps.length - 1}
        >
          다음 단계
        </button>
      </div>
    </div>
  );
}
