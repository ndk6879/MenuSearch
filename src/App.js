
import React, { useState } from "react";
import "./App.css";
import TagSearch from "./TagSearch";
import menuData_kr from "./menuData_kr";
import menuData_en from "./menuData_en";
import { FaGithub, FaInstagram } from "react-icons/fa";

import Modal from "./components/Modal";
import AnalyzePanel from "./components/AnalyzePanel";


function extractYouTubeId(url) {
  const match = url.match(/(?:\?v=|\/embed\/|\.be\/|\/v\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

const isValidRecipe = (item) =>
  item.name !== "Only 제품 설명 OR 홍보" &&
  item.name !== "건너뜀 - 영상 너무 김" &&
  item.name !== "분석 불가" &&
  !(item.ingredients || []).includes("Only 제품 설명 OR 홍보");

function App() {
  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const [recipeModal, setRecipeModal] = useState(null);

  const [language, setLanguage] = useState("kr");
  const [darkMode, setDarkMode] = useState(false);

  const currentRawData = language === "en" ? menuData_en : menuData_kr;

  const sortedData = [...currentRawData]
    .sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date))
    .map(item => ({
      ...item,
      ingredients: Array.isArray(item.ingredients)
        ? [...item.ingredients].sort()
        : []
    }));

  const validRecipes = sortedData.filter(isValidRecipe);

  const [searchResults, setSearchResults] = useState(sortedData);

  const toggleDarkMode = () => setDarkMode(prev => !prev);

  const ingredientMap = {
    "올리브오일": "올리브 오일",
    "엑스트라 버진 올리브오일": "올리브 오일",
    "올리브 오일": "올리브 오일",
    "식용유": "올리브 오일",
    "포도씨유": "올리브 오일",
    "아보카도 오일": "올리브 오일",
    "아보카도오일": "올리브 오일",
    "콩피오일": "올리브 오일",
    "콩피 오일": "올리브 오일",

    "그린 올리브": "올리브",
    "그린올리브": "올리브",
    "블랙올리브": "올리브",
    "올리브": "올리브",

    "고춧가루": "고춧가루",
    "청양고춧가루": "고춧가루",
    "고추가루": "고춧가루",
    "고운고추가루": "고춧가루",
    "굵은 고추가루": "고춧가루",
    "고운고춧가루": "고춧가루",

    "계란": "계란",
    "감동란": "계란",
    "감 동란": "계란",
    "계란 노른자": "계란",
    "반숙란": "계란",

    "계피": "계피",
    "계피가루": "계피",
    "계피스틱": "계피",

    "닭고기": "닭고기",
    "닭가슴살": "닭고기",
    "닭다리": "닭고기",
    "닭다리살": "닭고기",
    "수비드 닭가슴살": "닭고기",

    "김치": "김치",
    "배추 김치": "김치",
    "배추김치": "김치",
    "신김치": "김치",
    "백김치": "김치",
    "묵은지": "김치",

    "배": "배",
    "갈아만든배": "배",

    "버터": "버터",
    "무염 버터": "버터",
    "무염버터": "버터",
    "기버터": "버터",

    "소고기": "소고기",
    "소고기 갈비살": "소고기",
    "소고기안심": "소고기",
    "양갈비": "소고기",
    "LA갈비": "소고기",
    "꽃등심": "소고기",
    "한우패티": "소고기",
    "토마호크": "소고기",

    "와사비잎": "와사비",
    "와사비플라워": "와사비",
    "와사비": "와사비",

    "전복내장": "전복",
    "전복": "전복",

    "대파": "대파",
    "대파 녹색부분": "대파",
    "대파 흰부분": "대파",

    "양파": "양파",
    "양파분말": "양파",
    "적양파": "양파",

    "돼지고기": "돼지고기",
    "돼지 뒷다리살": "돼지고기",
    "듀록": "돼지고기",
    "돼지 등심": "돼지고기",
    "돼지등갈비": "돼지고기",
    "돼지목살": "돼지고기",
    "드라이에이징 돼지고기": "돼지고기",
    "삼겹살": "돼지고기",
    "목살": "돼지고기",
    "항정살": "돼지고기",

    "파마산 치즈": "파마산 치즈",
    "파마산 치즈 가루": "파마산 치즈",
    "파마산치즈": "파마산 치즈",

    "파프리카": "파프리카",
    "빨간 파프리카": "파프리카",
    "노란 파프리카": "파프리카",
    "미니 파프리카": "파프리카",

    "토마토": "토마토",
    "방울 토마토": "토마토",
    "방울토마토": "토마토",
    "로제 토마토 소스": "토마토",
    "선드라이 토마토": "토마토",
    "썬드라이 토마토": "토마토",
    "컬러방울토마토": "토마토",
    "토마토소스": "토마토",
    "토마토홀": "토마토",

    "파슬리": "파슬리",
    "이탈리안 파슬리": "파슬리",

    "식초": "식초",
    "사과식초": "식초",
    "두배 사과식초": "식초",
    "쉐리식초": "식초",
    "발사믹 식초": "식초",
    "발사믹식초": "식초",
    "화이트 발사믹 식초": "식초",
    "화이트 발사믹식초": "식초",
    "화이트발사믹식초": "식초",
    "화이트 발사믹": "식초",
    "화이트발사믹": "식초",
    "화이트 발사믹 글레이즈": "식초",
    "화이트와인 비니거": "식초",

    "양송이버섯": "양송이 버섯",
    "양송이": "양송이 버섯",
    "양송이 버섯": "양송이 버섯",

    "랍스터": "랍스터",
    "랍스터 테일": "랍스터",

    "무": "무",
    "무우": "무",

    "애플 망고": "애플 망고",
    "애플망고": "애플 망고",

    "만두": "만두",
    "물만두": "만두",
    "왕새우 만두": "만두",
    "냉동만두": "만두",

    "라임": "라임",
    "라임 주스": "라임",
    "라임주스": "라임",
    "라임제스트": "라임",

    "마늘": "마늘",
    "마늘분말": "마늘",
    "마늘종": "마늘",
    "흑마늘": "마늘",

    "연어": "연어",
    "노르웨이 생연어": "연어",

    "바질": "바질",
    "바질잎": "바질",
    "바질 페스토": "바질",
    "바질페스토": "바질",

    "소금": "소금",
    "맛소금": "소금",

    "간장": "간장",
    "국간장": "간장",
    "맛간장": "간장",
    "백간장": "간장",
    "양조간장": "간장",
    "진간장": "간장",

    "밥": "밥",
    "백미": "밥",
    "즉석밥": "밥",
    "통곡물밥": "밥",
    "쌀": "밥",
    "쌀가루": "밥",

    "치즈": "치즈",
    "까망베르 치즈": "치즈",
    "부라타치즈": "치즈",
    "블루치즈": "치즈",
    "크림치즈": "치즈",
    "페타치즈": "치즈",

    "꽃게 코인육수": "코인 육수",
    "디포리 코인육수": "코인 육수",
    "사골 코인육수": "코인 육수",
    "채소 코인육수": "코인 육수",
    "채소육수코인": "코인 육수",
    "사골코인육수": "코인 육수",
    "코인육수사골": "코인 육수",
    "코인육수": "코인 육수",
    "코인 육수": "코인 육수",

    "버섯": "버섯",
    "새송이": "버섯",
    "느타리버섯": "버섯",
    "새송이버섯": "버섯",
    "팽이버섯": "버섯",
    "포르치니 버섯": "버섯",
    "포르치니버섯": "버섯",
    "표고버섯": "버섯",

    "당근": "당근",
    "베이비당근": "당근",

    "생강": "생강",
    "생강가루": "생강",

    "알룰로스": "알룰로스",
    "알루로스": "알룰로스",

    "마요네즈": "마요네즈",
    "비건 마요네즈": "마요네즈",

    "치킨스톡": "치킨스톡",
    "액상 치킨스톡": "치킨스톡",
    "치킨스톡파우더": "치킨스톡",
    "치킨 육수": "치킨스톡",
    "치킨육수": "치킨스톡",

    "깨": "깨",
    "깨소금": "깨",
    "볶은깨": "깨",
    "볶음깨": "깨",

    "아보카도": "아보카도",
    "아보카도 퓨레": "아보카도",
    "아보카도퓨레": "아보카도",

    "빵": "빵",
    "식빵": "빵",
    "통식빵": "빵",
    "버거번": "빵",

    "포도": "포도",
    "청포도": "포도",

    "민트": "민트",
    "민트잎": "민트",

    "명란": "명란",
    "명란젓": "명란",

    "후추": "후추",
    "통후추": "후추",
    "후추 가루": "후추",
    "후추가루": "후추",
    "후춧가루": "후추",

    "트러플 스프레이": "트러플",
    "트러플 페이스트": "트러플",
    "트러플오일": "트러플",
    "트러플": "트러플",

    "후리카케": "후리카케",
    "후리가게": "후리카케",
    "후리카게": "후리카케",
    "후리가케": "후리카케",

    "화이트 와인": "화이트 와인",
    "화이트와인": "화이트 와인",

    "페페론치노": "페페론치노",
    "페퍼론치노": "페페론치노",
    "페퍼로치니": "페페론치노",
    "페퍼크러쉬": "페페론치노",
    "페페론치니": "페페론치노",
    "크러쉬페퍼": "페페론치노",
    "크러쉬드 페퍼": "페페론치노",
    "페퍼로치노": "페페론치노",

    "스파게티면": "파스타",
    "파스타": "파스타",

    "굴소스": "굴소스",
    "우스터소스": "굴소스",
  };

  const reverseIngredientMap = {};
  for (const [variant, base] of Object.entries(ingredientMap)) {
    if (!reverseIngredientMap[base]) {
      reverseIngredientMap[base] = [];
    }
    reverseIngredientMap[base].push(variant);
  }

  const expandToAllVariants = (selectedOptions) => {
    const values = selectedOptions.map(opt => opt.value);
    const result = new Set();
    for (const val of values) {
      if (reverseIngredientMap[val]) {
        reverseIngredientMap[val].forEach(v => result.add(v));
      } else {
        result.add(val);
      }
    }
    return [...result];
  };

  const filterMenusByIngredients = (selected) => {
    return sortedData.filter(menu => {
      const ingredients = menu.ingredients || [];
      const normalizedMenuIngredients = ingredients.map(ing => ingredientMap[ing] || ing);
      const normalizedSelected = selected.map(sel => ingredientMap[sel] || sel);
      return normalizedSelected.every(sel =>
        normalizedMenuIngredients.includes(sel)
      );
    });
  };

  const handleSearch = (selected) => {
    if (selected.length === 0) {
      setSearchResults(sortedData);
      return;
    }
    const normalized = expandToAllVariants(selected);
    const filtered = filterMenusByIngredients(normalized);
    setSearchResults(filtered);
  };

  const allIngredientsRaw = sortedData
    .flatMap((item) => item.ingredients || [])
    .filter((ing) => typeof ing === "string" && ing !== "Only 제품 설명 OR 홍보");

  const normalizedIngredientsSet = new Set();
  const ingredientOptions = [];

  for (const ing of allIngredientsRaw) {
    const normalized = ingredientMap[ing] || ing;
    if (!normalizedIngredientsSet.has(normalized)) {
      normalizedIngredientsSet.add(normalized);
      ingredientOptions.push({ value: normalized, label: normalized });
    }
  }

  ingredientOptions.sort((a, b) => a.label.localeCompare(b.label, "ko"));

  const CHEFS_PICKS = [
    { id: "OF04fVMINVg", url: "https://www.youtube.com/watch?v=OF04fVMINVg" },
    { id: "0kPXAkQKtAY", url: "https://www.youtube.com/watch?v=0kPXAkQKtAY" },
    { id: "QKxViaaB_cQ", url: "https://www.youtube.com/watch?v=QKxViaaB_cQ" },
  ];

  const chefsPicks = CHEFS_PICKS.map(pick => {
    const found = sortedData.find(item => extractYouTubeId(item.url) === pick.id);
    return found || { name: "제목 없음", ingredients: [], url: pick.url };
  });

  const latestDrops = validRecipes.slice(0, 3);

  const filteredResults = searchResults.filter(isValidRecipe);

  const RecipeCard = ({ item }) => {
    const ytId = extractYouTubeId(item.url);
    const normalizedIngredients = [...new Set(
      (item.ingredients || []).map(ing => ingredientMap[ing] || ing)
    )];

    return (
      <li className="menu-card" onClick={() => setRecipeModal(item)}>
        {ytId && (
          <img
            src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
            alt={item.name}
            className="menu-thumbnail"
          />
        )}
        <div className="menu-text">
          <div className="menu-name">{item.name || "No Name"}</div>
          {item.uploader && (
            <div className="menu-uploader">{item.uploader}</div>
          )}
          <div className="ingredient-tags">
            {normalizedIngredients.slice(0, 6).map((ing, i) => (
              <span key={i} className="ingredient-pill">{ing}</span>
            ))}
            {normalizedIngredients.length > 6 && (
              <span className="ingredient-pill ingredient-pill-more">
                +{normalizedIngredients.length - 6}
              </span>
            )}
          </div>
        </div>
      </li>
    );
  };

  const recipeCount = validRecipes.length;

  return (
    <div className={darkMode ? "app dark" : "app light"}>
      <header className="header">
        <div className="header-left">
          <a href="/" className="header-logo">Findish</a>
        </div>
        <div className="header-right">
          <button onClick={() => setAnalyzeOpen(true)} className="header-link">
            Analyze
          </button>
          <a href="#about" className="header-link">About</a>
          <a href="https://github.com/ndk6879/MenuSearch" target="_blank" rel="noopener noreferrer">
            <FaGithub size={18} color={darkMode ? "#999" : "#555"} />
          </a>
          <a href="https://www.instagram.com/andy__yeyo/" target="_blank" rel="noopener noreferrer">
            <FaInstagram size={18} color={darkMode ? "#999" : "#555"} />
          </a>
          <button onClick={toggleDarkMode} className="dark-toggle">
            {darkMode ? "Light" : "Dark"}
          </button>
        </div>
      </header>

      {/* Analyze Modal */}
      <Modal open={analyzeOpen} onClose={() => setAnalyzeOpen(false)} darkMode={darkMode}>
        <AnalyzePanel apiBase="http://localhost:8000" />
      </Modal>

      {/* Recipe Detail Modal */}
      <Modal open={!!recipeModal} onClose={() => setRecipeModal(null)} darkMode={darkMode}>
        {recipeModal && (
          <div className="recipe-modal">
            {extractYouTubeId(recipeModal.url) && (
              <img
                src={`https://img.youtube.com/vi/${extractYouTubeId(recipeModal.url)}/hqdefault.jpg`}
                alt={recipeModal.name}
                className="recipe-modal-thumb"
              />
            )}
            <h2 className="recipe-modal-title">{recipeModal.name}</h2>
            {recipeModal.uploader && (
              <p className="recipe-modal-uploader">{recipeModal.uploader}</p>
            )}
            {recipeModal.source && (
              <p className="recipe-modal-source">{recipeModal.source}</p>
            )}
            <div className="recipe-modal-ingredients">
              {[...new Set((recipeModal.ingredients || []).map(ing => ingredientMap[ing] || ing))].map((ing, i) => (
                <span key={i} className="ingredient-pill">{ing}</span>
              ))}
            </div>
            <div className="recipe-modal-steps">
              <h3>Steps</h3>
              {recipeModal.steps && recipeModal.steps.length > 0 ? (
                <ol>
                  {recipeModal.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              ) : (
                <p className="recipe-modal-no-steps">
                  {language === "en" ? "Recipe coming soon" : "레시피 준비 중"}
                </p>
              )}
            </div>
            {recipeModal.url && (
              <a
                href={recipeModal.url}
                target="_blank"
                rel="noopener noreferrer"
                className="recipe-modal-yt-btn"
              >
                Watch on YouTube
              </a>
            )}
          </div>
        )}
      </Modal>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-badge">{recipeCount}+ Recipes Available</div>
        <h1 className="hero-title">
          Find the perfect recipe<br />based on what you already have
        </h1>
        <p className="hero-subtitle">Transform the way you search recipes</p>
        <div className="hero-search">
          <TagSearch
            onSearch={handleSearch}
            options={ingredientOptions}
            language={language}
            darkMode={darkMode}
          />
        </div>
      </section>

      {/* Chef's Picks */}
      <section className="section">
        <div className="container">
          <h2 className="section-title">Chef's Picks</h2>
          <ul className="menu-list grid-list">
            {chefsPicks.map((item, idx) => (
              <RecipeCard key={`chef-${idx}`} item={item} />
            ))}
          </ul>
        </div>
      </section>

      {/* Latest Drops */}
      <section className="section">
        <div className="container">
          <h2 className="section-title">Latest Drops</h2>
          <ul className="menu-list grid-list">
            {latestDrops.map((item, idx) => (
              <RecipeCard key={`latest-${idx}`} item={item} />
            ))}
          </ul>
        </div>
      </section>

      {/* All Menu */}
      <section className="section">
        <div className="container">
          <h2 className="section-title">All Menu</h2>
          <ul className="menu-list grid-list">
            {filteredResults.length > 0 ? (
              filteredResults.map((item, idx) => (
                <RecipeCard key={`all-${idx}`} item={item} />
              ))
            ) : (
              <p className="no-results">No matching menu found.</p>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}

export default App;
