// test for commit after fetch

import React, { useState, useRef } from "react";
import axios from "axios";
import "./App.css";
import TagSearch from "./TagSearch";
import menuData_kr from "./menuData_kr";
import menuData_en from "./menuData_en";
import HeroSection from "./HeroSection";
import { FaGithub, FaInstagram } from "react-icons/fa";

import { Carousel } from 'react-responsive-carousel';
import "react-responsive-carousel/lib/styles/carousel.min.css";


function extractYouTubeId(url) {
  const match = url.match(/(?:\?v=|\/embed\/|\.be\/|\/v\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

function App() {
  const [language, setLanguage] = useState("kr");
  const [selectedUploader, setSelectedUploader] = useState("all");
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

  const [searchResults, setSearchResults] = useState(sortedData);

  const searchRef = useRef(null);
  const scrollToSearch = () => {
    if (searchRef.current) {
      const yOffset = -80;
      const y = searchRef.current.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  const toggleDarkMode = () => setDarkMode(prev => !prev);

  // ✅ 1. 정규화 매핑
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

      // 🌱 와사비
  "와사비잎": "와사비",
  "와사비플라워": "와사비",
  "와사비": "와사비",

  // 🐚 전복
  "전복내장": "전복",
  "전복": "전복",


     // 🧄 대파류
  "대파": "대파",
  "대파 녹색부분": "대파",
  "대파 흰부분": "대파",

  // 🧅 양파류
  "양파": "양파",
  "양파분말": "양파",
  "적양파": "양파",

  // 🧈 버터류
  "버터": "버터",
  "무염 버터": "버터",
  "무염버터": "버터",
  "기버터": "버터",

  // 🥩 돼지고기류 (중복 확인 차원에서 다시 포함)
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

  // 🧀 파마산 치즈류
  "파마산 치즈": "파마산 치즈",
  "파마산 치즈 가루": "파마산 치즈",
  "파마산치즈": "파마산 치즈",

  // 🌶️ 파프리카류
  "파프리카": "파프리카",
  "빨간 파프리카": "파프리카",
  "노란 파프리카": "파프리카",
  "미니 파프리카": "파프리카",

  // 🍅 토마토류
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

  // 🧂 식초류
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
  "화이트와인 비니거": "식초", // (식초지만 대부분 대체 가능성 높음)


  "양송이버섯": "양송이 버섯",
  "양송이": "양송이 버섯",
  "양송이 버섯": "양송이 버섯",

  "랍스터": "랍스터",
  "랍스터 테일": "랍스터",

  "무": "무",
  "무우": "무",

  "애플 망고": "애플 망고",
  "애플망고": "애플 망고",
  
  // 🥟 만두류
  "만두": "만두",
  "물만두": "만두",
  "왕새우 만두": "만두",
  "냉동만두": "만두",

  // 🍋 라임류
  "라임": "라임",
  "라임 주스": "라임",
  "라임주스": "라임",
  "라임제스트": "라임",

  // 🧄 마늘류
  "마늘": "마늘",
  "마늘분말": "마늘",
  "마늘종": "마늘",
  "흑마늘": "마늘",

  // 🐟 연어류
  "연어": "연어",
  "노르웨이 생연어": "연어",

  // 🌿 바질류
  "바질": "바질",
  "바질잎": "바질",
  "바질 페스토": "바질",
  "바질페스토": "바질",

  "소금": "소금",
  "맛소금": "소금",

    // 🧂 간장류
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

    // 🧀 치즈류
  "치즈": "치즈",
  "까망베르 치즈": "치즈",
  "부라타치즈": "치즈",
  "블루치즈": "치즈",
  "크림치즈": "치즈",
  "파마산 치즈": "치즈",         // 이미 따로 쓰던 경우엔 병합 주의
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

  // 🍄 버섯류
  "버섯": "버섯",
  "새송이": "버섯",
  "느타리버섯": "버섯",
  "새송이버섯": "버섯",
  "양송이 버섯": "버섯",
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

  // 🥢 참깨류
  "깨": "깨",
  "깨소금": "깨",
  "볶은깨": "깨",
  "볶음깨": "깨",
  
  // 🥑 아보카도류
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

    // 🧂 후추류
    "후추": "후추",
    "통후추": "후추",
    "후추 가루": "후추",
    "후추가루": "후추",
    "후춧가루": "후추",

      // 🍄 트러플
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

  

  // 🌶️ 페페론치노류
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

  // ✅ 2. 역매핑 (대표값 → 변형값 목록)
  const reverseIngredientMap = {};
  for (const [variant, base] of Object.entries(ingredientMap)) {
    if (!reverseIngredientMap[base]) {
      reverseIngredientMap[base] = [];
    }
    reverseIngredientMap[base].push(variant);
  }

  // ✅ 3. 선택한 대표 재료들을 변형값으로 확장
  const expandToAllVariants = (selectedOptions) => {
    const values = selectedOptions.map(opt => opt.value);
    const result = new Set();

    for (const val of values) {
      if (reverseIngredientMap[val]) {
        reverseIngredientMap[val].forEach(v => result.add(v));
      } else {
        result.add(val); // 변형 없는 일반 재료도 포함
      }
    }

    return [...result];
  };

  // ✅ 4. 검색 필터
  const filterMenusByIngredients = (selected) => {
    return sortedData.filter(menu => {
      const ingredients = menu.ingredients || [];
  
      // 메뉴 재료들을 "대표값 기준"으로 정규화
      const normalizedMenuIngredients = ingredients.map(ing => ingredientMap[ing] || ing);
  
      // 선택된 재료도 "대표값 기준"으로 정규화
      const normalizedSelected = selected.map(sel => ingredientMap[sel] || sel);
  
      return normalizedSelected.every(sel =>
        normalizedMenuIngredients.includes(sel)
      );
    });
  };
  
  
  // ✅ 5. 검색 실행
  const handleSearch = (selected) => {
    if (selected.length === 0) {
      setSearchResults(sortedData);
      return;
    }
    const normalized = expandToAllVariants(selected);
    const filtered = filterMenusByIngredients(normalized);
    setSearchResults(filtered);
  };

  // ✅ 6. 드롭다운에 보일 옵션 (대표값만 중복 없이)
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


  ingredientOptions.sort((a, b) => a.label.localeCompare(b.label, "ko")); // 한글 정렬도 대응


  return (
    <div className={darkMode ? "app dark" : "app light"}>
      <header className="header">
        <div className="header-left">
          <a href="/" className="header-logo">🍽️ Findish</a>
        </div>
        <div className="header-right">
          <a href="#about" className="header-link">About</a>
          <a href="https://github.com/ndk6879/MenuSearch" target="_blank" rel="noopener noreferrer">
            <FaGithub size={20} color={darkMode ? "#ccc" : "#333"} />
          </a>
          <a href="https://www.instagram.com/andy__yeyo/" target="_blank" rel="noopener noreferrer">
            <FaInstagram size={20} color="#E1306C" />
          </a>
          <button onClick={toggleDarkMode} className="search-button">
            {darkMode ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      {/* <HeroSection onScrollToSearch={scrollToSearch} /> */}

{/* 🧑‍🍳 Chef's Picks 섹션 */}

<section className="container" style={{ marginTop: "3rem" }}> {/* ✨ margin-top 값 증가 */}
  <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>🧑‍🍳 Chef's Picks</h2>
  <ul className="menu-list grid-list">
    {sortedData
      .filter(item =>
        item.name !== "Only 제품 설명 OR 홍보" &&
        item.name !== "건너김 - 영상 너무 김" &&
        item.name !== "분석 불가" &&
        !(item.ingredients || []).includes("Only 제품 설명 OR 홍보")
      )
      .slice(0, 3)
      .map((item, idx) => (
        <li key={idx} className="menu-card">
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            <img
                  src={`http://img.youtube.com/vi/${extractYouTubeId(item.url)}/hqdefault.jpg`}
                  alt="thumbnail"
              className="menu-thumbnail"
            />
          </a>
          <div className="menu-text">
            <div className="menu-name">🍽️ {item.name}</div>
            <div className="menu-ingredients">🥕 {item.ingredients?.join(", ")}</div>
          </div>
        </li>
      ))}
  </ul>
</section>



{/* 🆕 Latest Drop 섹션 */}

<section className="container" style={{ marginTop: "3rem" }}> {/* ✨ Adjusted margin-top */}
  <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>🆕 Latest Drops</h2>
  <ul className="menu-list grid-list">
    {sortedData
      .filter(item =>
        item.name !== "Only 제품 설명 OR 홍보" &&
        item.name !== "건너김 - 영상 너무 김" &&
        item.name !== "분석 불가" &&
        !(item.ingredients || []).includes("Only 제품 설명 OR 홍보")
      )
      .slice(3, 6)
      .map((item, idx) => (
        <li key={idx} className="menu-card">
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            <img
                  src={`http://img.youtube.com/vi/${extractYouTubeId(item.url)}/hqdefault.jpg`}
                  alt="thumbnail"
              className="menu-thumbnail"
            />
          </a>
          <div className="menu-text">
            <div className="menu-name">🍽️ {item.name}</div>
            <div className="menu-ingredients">🥕 {item.ingredients?.join(", ")}</div>
          </div>
        </li>
      ))}
  </ul>
</section>




{/* ✅ 전체 메뉴 영역: section으로 통일 */}


<section className="container" ref={searchRef} style={{ marginTop: "3rem" }}> {/* ✨ Adjusted margin-top */}
  <div className="all-toolbar">
    <h2 style={{ fontSize: "1.5rem" }}>🍽️ All Menu</h2>
    <div className="tagsearch-wrapper">
    <TagSearch
      onSearch={handleSearch}
      options={ingredientOptions}
      language={language}
      darkMode={darkMode}
    />
  </div>

  </div>

  <ul className="menu-list grid-list">
    {searchResults.length > 0 ? (
      searchResults
        .filter(
          (item) =>
            item.name !== "Only 제품 설명 OR 홍보" &&
            item.name !== "분석 불가" &&
            item.name !== "건너김 - 영상 너무 김" &&
            !(item.ingredients || []).includes("Only 제품 설명 OR 홍보")
        )
        .map((item, idx) => (
          <li key={idx} className="menu-card">
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                                  src={`http://img.youtube.com/vi/${extractYouTubeId(item.url)}/hqdefault.jpg`}

                  alt="thumbnail"
                  className="menu-thumbnail"
                />
              </a>
            )}
            <div className="menu-text">
              <div className="menu-name">
                🍽️ {item.name || "No Name"}
              </div>
              <div className="menu-ingredients">
                🥕 {item.ingredients?.join(", ") || "No Ingredients Info"}
              </div>
            </div>
          </li>
        ))
    ) : (
      <p className="no-results">No matching menu found.</p>
    )}
  </ul>
</section>

    </div>
  );
}

export default App;