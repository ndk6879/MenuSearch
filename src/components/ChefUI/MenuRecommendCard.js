import { useState } from "react";

function getYoutubeId(url) {
  if (!url) return null;
  const m = url.match(/(?:\?v=|\/embed\/|\.be\/|\/v\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export default function MenuRecommendCard({ recipes, darkMode }) {
  const [expanded, setExpanded] = useState(null);
  const [playing, setPlaying] = useState(null);

  return (
    <div className="chef-menu-cards">
      {recipes.map((recipe, i) => {
        const ytId = getYoutubeId(recipe.url);

        return (
          <div key={i} className={`chef-recipe-card${expanded === i ? " expanded" : ""}`}>
            {/* 썸네일 / 인라인 플레이어 */}
            {ytId && (
              playing === i ? (
                <iframe
                  className="chef-recipe-iframe"
                  src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
                  title={recipe.name}
                  frameBorder="0"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              ) : (
                <div className="chef-recipe-thumb-link" onClick={() => setPlaying(i)}>
                  <img
                    src={`https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`}
                    alt={recipe.name}
                    className="chef-recipe-thumb"
                    onError={(e) => { e.target.src = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`; }}
                  />
                  <span className="chef-recipe-thumb-play">▶</span>
                </div>
              )
            )}

            {/* 헤더 */}
            <div className="chef-recipe-card-header" onClick={() => setExpanded(expanded === i ? null : i)}>
              <div>
                <span className="chef-recipe-card-name">{recipe.name}</span>
                {recipe.uploader && (
                  <span className="chef-recipe-uploader">{recipe.uploader}</span>
                )}
              </div>
              <span className="chef-recipe-card-toggle">{expanded === i ? "▲" : "▼"}</span>
            </div>

            {/* 재료 (항상 표시) */}
            {recipe.ingredients?.length > 0 && (
              <div className="chef-recipe-pills">
                {recipe.ingredients.map((ing, j) => (
                  <span key={j} className="ingredient-pill">{ing}</span>
                ))}
              </div>
            )}

            {/* 요리 순서 (펼쳤을 때) */}
            {expanded === i && recipe.steps?.length > 0 && (
              <ol className="chef-recipe-steps-mini">
                {recipe.steps.map((step, j) => (
                  <li key={j}>{step}</li>
                ))}
              </ol>
            )}
          </div>
        );
      })}
    </div>
  );
}
