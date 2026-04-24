
import React, { useState, useMemo, useEffect } from "react";
import "./App.css";
import TagSearch from "./TagSearch";
import menuData_kr from "./menuData_kr";
import menuData_en from "./menuData_en";
import { FaBookmark, FaRegBookmark } from "react-icons/fa";
import Modal from "./components/Modal";
import AnalyzePanel from "./components/AnalyzePanel";
import ChefAI from "./components/ChefAI";
import channelProfiles from "./channelData";
import AboutSection from "./components/AboutSection";
import translations from "./i18n";
import chefConfig from "./chefConfig";

const IS_DEV = process.env.NODE_ENV === "development";
const CHEF_FILTER = process.env.REACT_APP_CHEF || null;
const chefProfile = CHEF_FILTER ? chefConfig[CHEF_FILTER] : null;

const InstagramGradientIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
    <defs>
      <radialGradient id="ig-grad-header" cx="30%" cy="107%" r="150%">
        <stop offset="0%" stopColor="#fdf497" />
        <stop offset="5%" stopColor="#fdf497" />
        <stop offset="45%" stopColor="#fd5949" />
        <stop offset="60%" stopColor="#d6249f" />
        <stop offset="90%" stopColor="#285AEB" />
      </radialGradient>
    </defs>
    <rect x="2" y="2" width="20" height="20" rx="5.5" fill="url(#ig-grad-header)" />
    <circle cx="12" cy="12" r="4.6" stroke="white" strokeWidth="1.8" fill="none" />
    <circle cx="17.5" cy="6.5" r="1.2" fill="white" />
  </svg>
);


const YouTubeHeaderIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
    <rect width="24" height="24" rx="5.5" fill="#FF0000"/>
    <path d="M19.6 8.2a2 2 0 0 0-1.4-1.4C16.9 6.5 12 6.5 12 6.5s-4.9 0-6.2.3a2 2 0 0 0-1.4 1.4C4.1 9.5 4.1 12 4.1 12s0 2.5.3 3.8a2 2 0 0 0 1.4 1.4c1.3.3 6.2.3 6.2.3s4.9 0 6.2-.3a2 2 0 0 0 1.4-1.4c.3-1.3.3-3.8.3-3.8s0-2.5-.3-3.8z" fill="white"/>
    <path d="M10.2 14.5V9.5l4.2 2.5-4.2 2.5z" fill="#FF0000"/>
  </svg>
);

function extractYouTubeId(url) {
  const match = url.match(/(?:\?v=|\/embed\/|\.be\/|\/v\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
  return match ? match[1] : null;
}

const EN_PLURAL_MAP = {
  "eggs": "egg", "egg yolks": "egg yolk",
  "tomatoes": "tomato", "onions": "onion", "green onions": "green onion",
  "mushrooms": "mushroom", "potatoes": "potato", "carrots": "carrot",
  "cloves": "clove", "anchovies": "anchovy", "olives": "olive",
  "capers": "caper", "lemons": "lemon", "limes": "lime",
  "shallots": "shallot", "scallions": "scallion", "peppers": "pepper",
  "bay leaves": "bay leaf", "herbs": "herb", "oysters": "oyster",
};

// 의미상 동일한 영어 재료 통합 맵
const EN_SYNONYM_MAP = {
  // 마늘
  "minced garlic": "garlic", "garlic clove": "garlic",
  // 양파
  "red onion": "onion",
  // 올리브 오일
  "extra virgin olive oil": "olive oil", "pure olive oil": "olive oil",
  // 파르메산
  "parmigiano reggiano cheese": "parmesan cheese",
  "parmigiano-reggiano cheese": "parmesan cheese",
  "reggiano cheese": "parmesan cheese",
  "pecorino romano cheese": "pecorino cheese",
  // 치즈 표기 통일
  "mozzarella": "mozzarella cheese",
  "mascarpone": "mascarpone cheese",
  "ricotta": "ricotta cheese",
  // 파
  "scallion": "green onion",
  // 크림
  "whipping cream": "heavy cream",
  // 토마토 (가공품은 원재료로 통일)
  "whole peeled tomatoes": "tomato", "whole tomatoes": "tomato", "canned tomatoes": "tomato",
  // 소스
  "tabasco sauce": "tabasco", "sriracha sauce": "sriracha",
  // 빵
  "bread slices": "bread",
  // 파스타 → pasta로 통합
  "spaghetti": "pasta", "linguine": "pasta", "spaghettini": "pasta",
  "rigatoni": "pasta", "orecchiette": "pasta", "penne pasta": "pasta", "tagliatelle": "pasta",
  // 올리브 종류 → olive
  "black olives": "olive", "green olives": "olive", "taggiasca olives": "olive",
  // 고추 표기 통일
  "cheongyang chili": "cheongyang chili pepper", "cheongyang pepper": "cheongyang chili pepper",
  "red chili": "red chili pepper",
  "green chili": "green chili pepper",
  "red bell pepper": "bell pepper",
  // 깨
  "black sesame seeds": "sesame seeds",
  // 문어
  "webfoot octopus": "octopus",
};

const isValidRecipe = (item) =>
  item.name !== "Only 제품 설명 OR 홍보" &&
  item.name !== "건너뜀 - 영상 너무 김" &&
  item.name !== "분석 불가" &&
  !(item.ingredients || []).includes("Only 제품 설명 OR 홍보");

function App() {
  const [analyzeOpen, setAnalyzeOpen] = useState(false);
  const [recipeModal, setRecipeModal] = useState(null);
  const [activeTab, setActiveTab] = useState("home"); // "home" | "chef" | "saved"
  const [savedRecipes, setSavedRecipes] = useState(
    () => JSON.parse(localStorage.getItem("savedRecipes") || "[]")
  );

  const defaultLanguage = navigator.language.startsWith("ko") ? "kr" : "en";
  const [language, setLanguage] = useState(defaultLanguage);
  const t = translations[language];
  const [darkMode, setDarkMode] = useState(false);
  const [searchActive, setSearchActive] = useState(false);
  const [modalVideoPlaying, setModalVideoPlaying] = useState(false);

  const CHEF_FILTER = process.env.REACT_APP_CHEF;
  const currentRawData = (language === "en" ? menuData_en : menuData_kr)
    .filter(item => !CHEF_FILTER || item.uploader === CHEF_FILTER);

  const sortedData = [...currentRawData]
    .sort((a, b) => new Date(b.upload_date) - new Date(a.upload_date))
    .map(item => ({
      ...item,
      ingredients: Array.isArray(item.ingredients)
        ? [...item.ingredients].sort()
        : []
    }));

  const validRecipes = sortedData.filter(isValidRecipe);

  const POPULAR_TAG_BLOCKLIST = new Set([
    "소금", "후추", "설탕", "물", "식용유", "올리브 오일", "올리브오일", "올리브유",
    "다진 마늘", "마늘", "간장", "참기름", "들기름", "식초", "고추장", "된장", "쌈장",
    "고춧가루", "깨", "참깨", "후춧가루", "흑후추", "백후추",
    "salt", "pepper", "sugar", "water", "olive oil", "garlic", "soy sauce",
    "black pepper", "white pepper", "sesame oil", "vinegar",
    "파슬리", "바질", "로즈마리", "타임", "오레가노",
  ]);

  const popularTags = useMemo(() => {
    if (!CHEF_FILTER) {
      return language === "kr"
        ? ["계란", "삼겹살", "두부", "연어", "파스타", "새우", "소고기", "김치", "감자", "닭가슴살"]
        : ["Egg", "Pork belly", "Tofu", "Salmon", "Pasta", "Shrimp", "Beef", "Kimchi", "Potato", "Chicken breast"];
    }
    const freq = {};
    validRecipes.forEach(recipe => {
      (recipe.ingredients || []).forEach(ing => {
        const key = ing.replace(/\s*\(.*?\)\s*/g, "").trim();
        if (key && !POPULAR_TAG_BLOCKLIST.has(key)) {
          freq[key] = (freq[key] || 0) + 1;
        }
      });
    });
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name]) => name);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, validRecipes]);

  const [searchResults, setSearchResults] = useState(sortedData);
  const [selectedIngredients, setSelectedIngredients] = useState([]);
  const [searchInputValue, setSearchInputValue] = useState("");

  // 언어 변경 시 검색 결과 및 선택 재료 초기화
  useEffect(() => {
    setSearchResults(sortedData);
    setSelectedIngredients([]);
    setSearchActive(false);
    setSearchInputValue("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const toggleDarkMode = () => setDarkMode(prev => !prev);

  const toggleSave = (url) => {
    setSavedRecipes(prev => {
      const next = prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url];
      localStorage.setItem("savedRecipes", JSON.stringify(next));
      return next;
    });
  };

  // ── 동의어 맵: 같은 재료의 다른 표기 → 검색/표시 통일 ──
  // (cleanup_ingredients.py와 동일한 규칙 유지)
  const synonymMap = {
    // 올리브 오일
    "올리브오일": "올리브 오일", "올리브유": "올리브 오일",
    "엑스트라 버진 올리브오일": "올리브 오일", "엑스트라버진 올리브오일": "올리브 오일",
    "엑스트라버진 올리브 오일": "올리브 오일", "엑스트라버진 오일": "올리브 오일",
    "엑스트라버진 올리브유": "올리브 오일", "엑스트라 버진오일": "올리브 오일",
    "엑스트라버진오일": "올리브 오일", "엑스트라 버진 올리브 오일": "올리브 오일",
    "퓨어 올리브 오일": "올리브 오일", "퓨어올리브오일": "올리브 오일",
    "퓨어올리브유": "올리브 오일", "퓨어 올리브유": "올리브 오일",
    "콩피오일": "올리브 오일", "콩피 오일": "올리브 오일",
    // 올리브 열매
    "그린올리브": "올리브", "그린 올리브": "올리브", "블랙올리브": "올리브",
    "타쟈스카 올리브": "올리브", "패키지 올리브": "올리브",
    // 고춧가루
    "고추가루": "고춧가루", "청양고춧가루": "고춧가루",
    "고운고추가루": "고춧가루", "굵은 고추가루": "고춧가루", "고운고춧가루": "고춧가루",
    // 계란
    "달걀": "계란", "감동란": "계란", "감 동란": "계란",
    "계란 노른자": "계란", "달걀 노른자": "계란", "달걀 (노른자만)": "계란",
    "노른자": "계란", "달걀 흰자": "계란", "반숙란": "계란",
    // 계피
    "계피가루": "계피", "계피스틱": "계피",
    // 김치
    "배추 김치": "김치", "배추김치": "김치", "신김치": "김치",
    // 버터
    "무염 버터": "버터", "무염버터": "버터", "기버터": "버터",
    "가염버터": "버터", "버터(가염)": "버터",
    // 마늘
    "다진 마늘": "마늘", "편마늘": "마늘", "마늘 파우더": "마늘",
    // 대파
    "대파 녹색부분": "대파", "대파 흰부분": "대파", "파": "대파",
    // 양파
    "양파분말": "양파", "적양파": "양파", "보라색 양파": "양파",
    // 파마산 치즈
    "파마산 치즈 가루": "파마산 치즈", "파마산치즈": "파마산 치즈",
    "파마산": "파마산 치즈", "파르메산 치즈": "파마산 치즈", "레지아노 치즈": "파마산 치즈",
    // 파프리카
    "빨간 파프리카": "파프리카", "노란 파프리카": "파프리카",
    "미니 파프리카": "파프리카", "초록 파프리카": "파프리카", "레드파프리카": "파프리카",
    // 방울토마토
    "방울 토마토": "방울토마토", "컬러방울토마토": "방울토마토",
    "달짝이 토마토": "방울토마토", "달짝이토마토": "방울토마토", "무지개 방울토마토": "방울토마토",
    // 선드라이토마토
    "선드라이 토마토": "선드라이토마토", "썬드라이 토마토": "선드라이토마토", "썬드라이토마토": "선드라이토마토",
    // 토마토홀
    "캔 토마토": "토마토홀", "토마토캔": "토마토홀", "홀 토마토 캔": "토마토홀", "무띠 토마토홀": "토마토홀",
    // 토마토퓨레
    "토마토 퓨레": "토마토퓨레", "무띠 토마토퓨레": "토마토퓨레",
    "토마토 페이스트": "토마토퓨레", "토마토페이스트": "토마토퓨레",
    // 토마토소스
    "토마토 소스": "토마토소스", "로제 토마토 소스": "토마토소스",
    // 파슬리
    "이탈리안 파슬리": "파슬리", "다진 파슬리": "파슬리", "파슬리잎": "파슬리",
    // 식초
    "사과식초": "사과 식초", "두배 사과식초": "사과 식초", "쉐리식초": "식초",
    "발사믹식초": "발사믹 식초",
    "발사믹 비네거": "발사믹 식초", "발사믹 비니거": "발사믹 식초",
    "레드 와인 비네거": "레드 와인 식초", "레드와인 비네거": "레드와인 식초",
    "와인식초": "와인 식초",
    // 화이트 발사믹
    "화이트 발사믹 식초": "화이트 발사믹", "화이트 발사믹식초": "화이트 발사믹",
    "화이트발사믹식초": "화이트 발사믹", "화이트발사믹": "화이트 발사믹",
    "화이트 발사믹 글레이즈": "화이트 발사믹", "화이트와인 비니거": "화이트 발사믹",
    "화이트 와인 비네거": "화이트 발사믹", "화이트 와인 비니거": "화이트 발사믹",
    "화이트와인 비네거": "화이트 발사믹", "화이트 와인식초": "화이트 발사믹",
    // 버섯류
    "양송이버섯": "양송이 버섯", "양송이": "양송이 버섯",
    "새송이버섯": "새송이 버섯", "느타리버섯": "느타리 버섯",
    "팽이버섯": "팽이 버섯", "포르치니버섯": "포르치니 버섯",
    "표고버섯": "표고 버섯", "잎새버섯": "잎새 버섯",
    // 랍스터
    "랍스터 테일": "랍스터", "랍스타": "랍스터",
    // 채소 오타/표기
    "살롯": "샬롯",
    "래디시": "래디쉬", "레디시": "래디쉬",
    "사프론": "사프란", "샤프론": "사프란",
    "탈리아탈레": "탈리아텔레", "딸리아딸레": "탈리아텔레",
    "만가닥버섯": "만가닥 버섯",
    "옥수수콘": "옥수수 콘",
    "그린빈": "그린 빈",
    "궁채장아찌": "궁채 장아찌",
    // 무
    "무우": "무",
    // 라임
    "라임 주스": "라임", "라임주스": "라임", "라임제스트": "라임",
    "라임 제스트": "라임", "라임즙": "라임", "라임/레몬 제스트": "라임",
    // 레몬
    "레몬즙": "레몬", "레몬주스": "레몬", "레몬제스트": "레몬",
    "레몬 제스트": "레몬", "레몬껍질": "레몬",
    // 마늘
    "마늘분말": "마늘", "흑마늘": "마늘", "다진마늘": "마늘",
    "통마늘": "마늘", "생마늘": "마늘",
    // 연어
    "노르웨이 생연어": "연어", "껍질 있는 연어": "연어", "껍질 없는 연어": "연어",
    "훈제연어": "연어", "연어 스테이크": "연어", "동원 썸씽스페셜 훈제연어": "연어",
    // 바질
    "바질잎": "바질",
    // 소금
    "맛소금": "소금", "구운 소금": "소금", "죽염": "소금", "샐러리 소금": "소금",
    // 간장
    "맛간장": "간장", "양조간장": "간장", "진간장": "간장",
    "국간장": "간장", "백간장": "간장", "어간장": "간장", "청장(맑은 간장)": "간장",
    // 밥
    "백미": "밥", "즉석밥": "밥", "통곡물밥": "밥", "쌀밥": "밥",
    // 쌀
    "생쌀": "쌀", "불린 쌀": "쌀", "이탈리아 쌀": "쌀", "한국 쌀": "쌀",
    // 메밀가루
    "통메밀가루": "메밀가루",
    // 치즈류
    "부라타치즈": "부라타 치즈", "블루치즈": "블루 치즈", "페타치즈": "페타 치즈",
    "에멘탈치즈": "에멘탈 치즈", "그뤼에르치즈": "그뤼에르 치즈",
    "리코타치즈": "리코타 치즈", "마스카포네치즈": "마스카포네 치즈",
    "마카포네 치즈": "마스카포네 치즈", "마스카포네 크림": "마스카포네 치즈",
    "모짜렐라 슈레드치즈": "모짜렐라 치즈", "프레시 모짜렐라 치즈": "모짜렐라 치즈",
    "슈레드 모짜렐라": "모짜렐라 치즈",
    "폰탈치즈": "폰탈 치즈", "벨큐브치즈": "벨큐브 치즈",
    "파다노": "그라나 파다노 치즈", "그라노파다노": "그라나 파다노 치즈",
    // 코인육수
    "꽃게 코인육수": "코인 육수", "디포리 코인육수": "코인 육수",
    "사골 코인육수": "코인 육수", "채소 코인육수": "코인 육수",
    "채소육수코인": "코인 육수", "사골코인육수": "코인 육수",
    "코인육수사골": "코인 육수", "코인육수": "코인 육수",
    // 당근
    "베이비당근": "당근",
    // 생강
    "생강가루": "생강", "다진 생강": "생강",
    // 알룰로스
    "알루로스": "알룰로스",
    // 마요네즈
    "비건 마요네즈": "마요네즈",
    // 치킨스톡
    "액상 치킨스톡": "치킨스톡", "치킨스톡파우더": "치킨스톡",
    "치킨 육수": "치킨스톡", "치킨육수": "치킨스톡",
    "닭 육수": "치킨스톡", "닭육수": "치킨스톡",
    // 깨
    "깨소금": "깨", "볶은깨": "깨", "볶음깨": "깨",
    "검은깨": "깨", "검정깨": "깨", "참깨": "깨",
    // 아보카도
    "아보카도 퓨레": "아보카도", "아보카도퓨레": "아보카도",
    // 빵
    "통식빵": "식빵", "버거번": "빵",
    // 기타
    "청포도": "포도", "민트잎": "민트", "명란젓": "명란", "갈아만든배": "배",
    "와사비잎": "와사비", "와사비플라워": "와사비", "전복내장": "전복",
    "애플망고": "애플 망고", "물만두": "만두", "왕새우 만두": "만두", "냉동만두": "만두",
    // 후추
    "통후추": "후추", "후추 가루": "후추", "후추가루": "후추",
    "후춧가루": "후추", "흰 후추": "후추", "흰후추": "후추",
    // 트러플
    "트러플 스프레이": "트러플", "트러플 페이스트": "트러플",
    "트러플오일": "트러플", "트러플 오일": "트러플", "화이트 트러플 오일": "트러플",
    // 후리카케
    "후리가게": "후리카케", "후리카게": "후리카케", "후리가케": "후리카케",
    // 와인
    "화이트와인": "화이트 와인", "레드와인": "레드 와인",
    // 페페론치노
    "페퍼론치노": "페페론치노", "페퍼로치니": "페페론치노", "페퍼크러쉬": "페페론치노",
    "페페론치니": "페페론치노", "크러쉬페퍼": "페페론치노",
    "크러쉬드 페퍼": "페페론치노", "페퍼로치노": "페페론치노",
    // 파스타 (종류별 → 파스타 통합)
    "스파게티면": "파스타", "건파스타": "파스타", "생면 파스타": "파스타",
    "숏파스타": "파스타", "파스타 면": "파스타", "파스타 반죽": "파스타",
    "스파게티": "파스타", "스파게티니": "파스타", "리가토니": "파스타",
    "링귀니": "파스타", "탈리아텔레": "파스타", "마팔디네": "파스타",
    "오레끼에떼": "파스타", "펜네 파스타": "파스타",
    // 굴소스
    "우스터소스": "굴소스",
    // 식용유
    "포도씨유": "식용유", "아보카도 오일": "식용유", "아보카도오일": "식용유",
    // 바질 페스토
    "바질페스토": "바질 페스토",
    // 삼겹살
    "K-바비큐 삼겹살": "삼겹살", "국내산 삼겹살": "삼겹살", "미국산 삼겹살": "삼겹살",
    "스페인산 (이베리코) 삼겹살": "삼겹살", "캐나다산 삼겹살": "삼겹살",
    "독일 삼겹살": "삼겹살", "칠레 삼겹살": "삼겹살",
    // 목살
    "목살 스테이크": "목살", "3일 돼지 목살": "목살", "돼지목살": "목살", "돼지 목살": "목살",
    // 돼지고기
    "간 돼지고기": "돼지고기", "돼지고기 등심": "돼지 등심",
    // 닭
    "닭 가슴살": "닭가슴살", "껍질 없는 닭 가슴살": "닭가슴살", "생닭": "닭고기",
    // 케첩
    "토마토 케찹": "케첩", "토마토케찹": "케첩", "토마토 케첩": "케첩",
    // 전분
    "전분 가루": "전분", "옥수수 전분 가루": "전분", "옥수수전분": "전분",
    // 돼지 다짐육
    "돼지고기 다짐육": "돼지 다짐육",
    // 소고기
    "호주산 안심": "안심", "안심 스테이크": "안심", "소고기 안심": "안심",
    "채끝 스테이크": "채끝살", "채끝": "채끝살",
    "등심 스테이크": "소고기 등심", "꽃등심": "소고기 등심",
    "간 소고기": "소고기 다짐육", "다진소고기": "소고기 다짐육", "다진 소고기": "소고기 다짐육",
    "다짐육": "소고기 다짐육", "얇은 소고기": "소고기",
    "한우 우둔": "우둔살",
    // 감자
    "삶은 감자": "감자", "두백감자": "감자", "마리스 파이퍼 감자": "감자",
    // 새우
    "생새우": "새우", "냉동 새우 (적새우살)": "새우", "냉동 새우": "새우",
    // 밀가루
    "일반 밀가루": "밀가루", "프랑스 밀가루 T45": "밀가루",
    // 생크림
    "서울우유 생크림": "생크림", "매일우유 휘핑크림": "생크림",
    // 설탕
    "백설탕": "설탕", "고운 설탕": "설탕", "브라운 설탕": "설탕",
    // 고추
    "청고추": "고추", "홍고추": "고추", "아삭이고추": "고추",
    // 토마토주스
    "토마토 주스": "토마토주스",
    // 셀러리 표기 통일
    "셀러리": "샐러리",
    // 앤초비 표기 통일
    "앤초비": "엔초비",
    // 사프란 표기 통일
    "샤프란": "사프란",
    // 치즈 표기 통일
    "모짜렐라": "모짜렐라 치즈",
    "마스카포네": "마스카포네 치즈", "마스카르포네 치즈": "마스카포네 치즈",
    "리코타": "리코타 치즈",
    // 토마토홀 통일
    "홀 토마토": "토마토홀",
    // 발사믹 통일
    "발사믹": "발사믹 식초",
    // 월계수잎 통일
    "월계수 잎": "월계수잎",
    // 화이트 와인 식초 통일
    "화이트 와인 식초": "화이트 발사믹",
    // 치킨스톡 통일
    "치킨 스톡": "치킨스톡",
    // 올리브유 표기 누락 보완
    "엑스트라 버진 올리브유": "올리브 오일",
    // 돼지 다짐육
    "다진 돼지고기": "돼지 다짐육",
    // 시나몬 → 계피
    "시나몬": "계피",
  };

  // ── 상위어 맵: "돼지고기" 검색 시 삼겹살/목살 등 포함 레시피도 매칭 ──
  // 하지만 삼겹살/목살은 여전히 개별 검색 가능
  const parentMap = {
    "돼지고기": ["삼겹살", "목살", "항정살", "돼지등갈비", "돼지 뒷다리살", "돼지 앞다리살", "돼지 등심", "돼지갈비", "듀록"],
    "닭고기": ["닭가슴살", "닭다리", "닭다리살", "수비드 닭가슴살", "닭발", "닭뼈", "닭간", "토종닭 다리"],
    "소고기": ["소고기 갈비살", "안심", "양갈비", "LA갈비", "소고기 등심", "한우패티", "토마호크", "채끝살", "우둔살", "우삼겹", "떡갈비"],
    "치즈": ["파마산 치즈", "크림치즈", "페타 치즈", "부라타 치즈", "블루 치즈", "까망베르 치즈", "고르곤졸라 치즈", "리코타 치즈", "모짜렐라 치즈", "그뤼에르 치즈", "체다 치즈"],
    "김치": ["묵은지", "백김치"],
    "버섯": ["표고 버섯", "느타리 버섯", "팽이 버섯", "새송이 버섯", "포르치니 버섯", "양송이 버섯"],
    "토마토": ["방울토마토", "선드라이토마토", "토마토소스", "토마토홀"],
    "식초": ["발사믹 식초", "화이트 발사믹"],
    "빵": ["식빵"],
    "파스타": ["스파게티", "링귀네", "펜네", "부카티니", "카펠리니", "탈리아텔레"],
  };

  // ── 패턴 기반 자동 정규화: 산지 접두사 / 용량 제거 ──
  const autoNormalize = (ing) => {
    let s = ing.trim();
    // 산지 접두사 제거: "국내산 삼겹살" → "삼겹살"
    s = s.replace(/^(국내산|미국산|호주산|캐나다산|스페인산|독일산|칠레산|노르웨이산|프랑스산|이탈리아산|뉴질랜드산|중국산)\s+/, "");
    // 끝부분 용량/수량 제거: "돼지 앞다리살 500g" → "돼지 앞다리살"
    s = s.replace(/\s*\d+([./]\d+)?\s*(g|ml|kg|L|l|개|장|큰술|작은술|컵|스푼|tsp|tbsp|T)\s*$/, "");
    return s.trim();
  };

  // autoNormalize → synonymMap 순서로 정규화 (EN 모드는 소문자 + 복수형 통일)
  const normalizeIng = (ing) => {
    if (language === "en") {
      const lower = ing.trim().toLowerCase();
      const depluraled = EN_PLURAL_MAP[lower] || lower;
      return EN_SYNONYM_MAP[depluraled] || EN_SYNONYM_MAP[lower] || depluraled;
    }
    const auto = autoNormalize(ing);
    return synonymMap[auto] || synonymMap[ing] || auto;
  };

  // 드롭다운에서 제외할 기본 재료 (너무 흔해서 검색 의미 없음)
  const EXCLUDED_INGREDIENTS = new Set([
    "소금", "후추", "물", "설탕", "밀가루", "기름", "면수",
    // 육수류
    "육수", "야채 육수", "채소 육수", "조개 육수", "해물 육수",
    // EN
    "salt", "pepper", "water", "sugar", "flour", "oil", "pasta water",
    "cooking oil", "kitchen twine",
  ]);

  // 양념류 정의 — 카드 pill에서 숨기고, 모달에서 "양념 & 소스" 섹션으로 분리 표시
  const SEASONINGS = new Set([
    // ── 기본 양념 ──
    "소금", "후추", "설탕", "밀가루", "기름", "면수",
    // 소금 파생형
    "샐러리 소금",
    // 후추 파생형 (synonymMap에 없는 것)
    "백후추", "핑크 페퍼콘",
    // 설탕 파생형
    "슈가파우더", "아이싱 슈가",

    // ── 기름/오일류 ──
    "올리브 오일", "식용유", "참기름", "들기름", "고추기름", "오리 기름",
    "트러플", "트러플 오일", "화이트 트러플 오일", "오일",

    // ── 발효/간장류 ──
    "간장", "된장", "고추장", "고춧가루", "참치액", "연두", "새우젓", "액젓",

    // ── 술류 ──
    "청주", "미림", "유자청", "청하",

    // ── 식초류 ──
    "식초", "발사믹 식초", "화이트 발사믹", "사과 식초", "와인 식초", "레드와인 식초",
    "화이트 와인 비니거",

    // ── 당류 ──
    "꿀", "조청", "물엿", "올리고당", "매실청", "매실액",

    // ── 소스/드레싱 ──
    "케첩", "마요네즈", "굴소스", "굴 소스", "우스터 소스",
    "타바스코", "타바스코 소스", "스리라차 소스",
    "디종 머스타드", "홀그레인 머스타드",

    // ── 스톡/육수 ──
    "치킨스톡", "치킨 스톡", "코인 육수",
    "야채 육수", "채소 육수", "조개 육수", "해물 육수",

    // ── 건허브/향신료 ──
    "월계수잎", "타임", "로즈마리", "오레가노",
    "차이브", "민트", "파슬리",
    "허브", "양꼬치 시즈닝",
    // ── 고명/장식 ──
    "깨", "흰깨", "검은깨", "통깨",

    // ── 파우더/가루류 ──
    "파프리카 파우더", "파프리카 가루", "스모크 파프리카", "넛맥", "계피", "클로브",

    // ── 기타 조미료 ──
    "전분", "베이킹 파우더", "MSG", "옥수수 전분",

    // ── 드레싱 ──
    "클래식 비네그레트",

    // ── EN equivalents ──
    "salt", "pepper", "sugar", "flour", "oil",
    "olive oil", "sesame oil", "vegetable oil", "perilla oil", "chili oil",
    "truffle", "truffle oil", "white truffle oil",
    "soy sauce", "miso", "gochujang", "red pepper flakes", "fish sauce", "salted shrimp",
    "rice wine", "mirin", "yuja syrup", "cheongha", "sake",
    "vinegar", "balsamic vinegar", "balsamic glaze", "white balsamic", "apple cider vinegar",
    "wine vinegar", "red wine vinegar", "white wine vinegar",
    "honey", "corn syrup", "rice syrup", "oligosaccharide", "plum syrup",
    "ketchup", "mayonnaise", "oyster sauce", "worcestershire sauce", "hot sauce",
    "tabasco", "sriracha", "dijon mustard", "whole grain mustard",
    "chicken stock", "vegetable stock", "seafood stock", "chicken broth", "vegetable broth", "broth", "beef stock",
    "bay leaf", "thyme", "rosemary", "oregano", "chives", "mint", "herb",
    "parsley", "basil", "dill", "cilantro",
    "black pepper", "white pepper", "pink peppercorns", "cayenne pepper",
    "peperoncino", "chili powder", "red pepper powder", "gochugaru",
    "paprika powder", "smoked paprika", "nutmeg", "cinnamon", "clove",
    "curry powder", "celery salt",
    "cornstarch", "starch", "baking powder", "msg",
    "brown sugar", "powdered sugar",
    "classic vinaigrette", "perilla seed powder",
  ]);

  // 노이즈 재료 필터 (조리 설명 문장 등)
  const isNoisyIngredient = (ing) => {
    if (!ing || ing.length > 25) return true;
    if (/[.。]/.test(ing)) return true;
    if (/준비한다|구워준다|넣는다|볶는다|끓인다|만든다|섞는다|썬다|담는다|자른다|버린다|걸러서|우린다|벗겨|제거한다/.test(ing)) return true;
    const key = language === "en" ? ing.trim().toLowerCase() : ing.trim();
    if (EXCLUDED_INGREDIENTS.has(key)) return true;
    return false;
  };

  // 검색 필터: 상위어 선택 시 하위 재료도 매칭, 개별 재료는 정확 매칭
  const filterMenusByIngredients = (selectedOptions) => {
    return sortedData.filter(menu => {
      const ingredients = menu.ingredients || [];
      const normalizedMenuIngredients = ingredients.map(ing => normalizeIng(ing));

      return selectedOptions.every(opt => {
        const val = typeof opt === "string" ? opt : opt.value;
        const normalizedVal = normalizeIng(val);

        if (parentMap[normalizedVal]) {
          // 상위어: 카테고리 자체 OR 하위 재료 중 하나라도 있으면 매칭
          const allVariants = [normalizedVal, ...parentMap[normalizedVal].map(c => normalizeIng(c))];
          return normalizedMenuIngredients.some(mi => allVariants.includes(mi));
        }

        // 일반 재료: 정규화 후 정확 매칭
        return normalizedMenuIngredients.includes(normalizedVal);
      });
    });
  };

  const handleSearch = (selected) => {
    setSelectedIngredients(selected);
    setSearchActive(selected.length > 0);
    if (selected.length > 0 && window.gtag) {
      window.gtag('event', 'search', {
        search_term: selected.map(s => s.value).join(', ')
      });
    }
    if (selected.length === 0) {
      setSearchResults(sortedData);
      return;
    }
    const menuNameSelections = selected.filter(s => s.group === "menu");
    const ingredientSelections = selected.filter(s => s.group === "ingredient");
    const textSelections = selected.filter(s => s.group === "text");

    let filtered = sortedData;
    if (menuNameSelections.length > 0) {
      filtered = filtered.filter(item =>
        menuNameSelections.every(s =>
          (item.name || "").toLowerCase().includes(s.value.toLowerCase())
        )
      );
    }
    if (ingredientSelections.length > 0) {
      filtered = filterMenusByIngredients(ingredientSelections).filter(item =>
        filtered.includes(item)
      );
    }
    if (textSelections.length > 0) {
      filtered = filtered.filter(item =>
        textSelections.every(s => {
          const q = s.value.toLowerCase();
          return (
            (item.name || "").toLowerCase().includes(q) ||
            (item.ingredients || []).some(ing => normalizeIng(ing).toLowerCase().includes(q))
          );
        })
      );
    }
    setSearchResults(filtered);
  };

  const allIngredientsRaw = sortedData
    .flatMap((item) => item.ingredients || [])
    .filter((ing) => typeof ing === "string" && ing !== "Only 제품 설명 OR 홍보");

  // 정규화된 재료별 등장 횟수 집계
  const ingredientFreq = {};
  for (const ing of allIngredientsRaw) {
    if (isNoisyIngredient(ing)) continue;
    const normalized = normalizeIng(ing);
    if (isNoisyIngredient(normalized)) continue;
    ingredientFreq[normalized] = (ingredientFreq[normalized] || 0) + 1;
  }

  const normalizedIngredientsSet = new Set();
  const ingredientOptions = [];

  for (const [normalized, count] of Object.entries(ingredientFreq)) {
    if (count <= 2) continue; // 2회 이하 재료는 드롭다운에서 제외
    if (!normalizedIngredientsSet.has(normalized)) {
      normalizedIngredientsSet.add(normalized);
      ingredientOptions.push({ value: normalized, label: normalized });
    }
  }

  // 상위어(돼지고기, 닭고기 등)는 KR 모드에서만 추가 (EN 모드는 영어 재료로 대체)
  if (language === "kr") {
    for (const parent of Object.keys(parentMap)) {
      if (!normalizedIngredientsSet.has(parent)) {
        normalizedIngredientsSet.add(parent);
        ingredientOptions.push({ value: parent, label: parent });
      }
    }
  }

  ingredientOptions.sort((a, b) => a.label.localeCompare(b.label, "ko"));

  // 메뉴명 옵션 (그룹 분리)
  const menuNameOptions = validRecipes
    .filter(r => r.name && r.name.trim())
    .map(r => ({ value: r.name, label: r.name, group: "menu" }))
    .filter((opt, idx, arr) => arr.findIndex(o => o.value === opt.value) === idx)
    .sort((a, b) => a.label.localeCompare(b.label, "ko"));

  const groupedSearchOptions = [
    {
      label: language === "kr" ? "재료" : "Ingredients",
      options: ingredientOptions.map(o => ({ ...o, group: "ingredient" })),
    },
    {
      label: language === "kr" ? "메뉴" : "Dishes",
      options: menuNameOptions,
    },
  ];

  // 선택된 태그(재료/텍스트)가 있으면, 해당 레시피에서만 드롭다운 옵션 추출
  const availableGroupedOptions = useMemo(() => {
    if (selectedIngredients.length === 0) return groupedSearchOptions;
    const ingSelections = selectedIngredients.filter(s => s.group === "ingredient");
    const textSelections = selectedIngredients.filter(s => s.group === "text");
    if (ingSelections.length === 0 && textSelections.length === 0) return groupedSearchOptions;

    // 재료 태그로 먼저 필터
    let matchingRecipes = ingSelections.length > 0
      ? filterMenusByIngredients(ingSelections)
      : sortedData.filter(isValidRecipe);

    // 텍스트 태그로 추가 필터
    if (textSelections.length > 0) {
      matchingRecipes = matchingRecipes.filter(item =>
        textSelections.every(s => {
          const q = s.value.toLowerCase();
          return (
            (item.name || "").toLowerCase().includes(q) ||
            (item.ingredients || []).some(ing => normalizeIng(ing).toLowerCase().includes(q))
          );
        })
      );
    }

    const available = new Set();
    for (const recipe of matchingRecipes) {
      for (const ing of recipe.ingredients || []) {
        if (isNoisyIngredient(ing)) continue;
        const normalized = normalizeIng(ing);
        if (!isNoisyIngredient(normalized)) available.add(normalized);
      }
    }
    for (const parent of Object.keys(parentMap)) {
      if (parentMap[parent].some(child => available.has(normalizeIng(child)))) {
        available.add(parent);
      }
    }
    const matchingMenuNames = new Set(matchingRecipes.map(r => r.name));
    return [
      {
        label: groupedSearchOptions[0].label,
        options: groupedSearchOptions[0].options.filter(opt => available.has(opt.value)),
      },
      {
        label: groupedSearchOptions[1].label,
        options: groupedSearchOptions[1].options.filter(opt => matchingMenuNames.has(opt.value)),
      },
    ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIngredients]);

const [allMenuSort, setAllMenuSort] = useState("date"); // "name" | "date"
  const [selectedChef, setSelectedChef] = useState("all");

  const chefOptions = Array.from(
    new Set(validRecipes.map((r) => r.uploader).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "ko"));

  // 태그 미선택 + 타이핑 중일 때 라이브 필터링
  const liveFilteredData = useMemo(() => {
    if (searchActive || !searchInputValue.trim()) return null;
    const q = searchInputValue.trim().toLowerCase();
    return sortedData.filter(item =>
      isValidRecipe(item) && (
        (item.name || "").toLowerCase().includes(q) ||
        (item.ingredients || []).some(ing => normalizeIng(ing).toLowerCase().includes(q))
      )
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInputValue, searchActive]);

  const filteredResults = (liveFilteredData || searchResults.filter(isValidRecipe)).filter((r) =>
    selectedChef === "all" ? true : r.uploader === selectedChef
  );

  const sortedResults = [...filteredResults].sort((a, b) => {
    if (allMenuSort === "name") {
      return (a.name || "").localeCompare(b.name || "", "ko");
    }
    return new Date(b.upload_date) - new Date(a.upload_date);
  });

  const selectedIngredientValues = new Set(
    selectedIngredients.map(s => normalizeIng(s.value).toLowerCase())
  );

  const RecipeCard = ({ item }) => {
    const ytId = extractYouTubeId(item.url);
    const allNormalized = [...new Set(
      (item.ingredients || []).map(ing => normalizeIng(ing))
    )];

    // 주재료 vs 양념 분리
    const mainIngs = allNormalized.filter(ing => !SEASONINGS.has(ing));
    const seasoningIngs = allNormalized.filter(ing => SEASONINGS.has(ing));

    // 주재료 중 선택한 것 앞으로
    const highlightedMain = mainIngs.filter(ing => selectedIngredientValues.has(ing.toLowerCase()));
    const restMain = mainIngs.filter(ing => !selectedIngredientValues.has(ing.toLowerCase()));
    const cardIngredients = [...highlightedMain, ...restMain];

    const matchCount = mainIngs.filter(ing => {
      const normalizedIng = normalizeIng(ing);
      return selectedIngredients.filter(s => s.group !== "menu").some(opt => {
        const normalizedVal = normalizeIng(opt.value);
        if (parentMap[normalizedVal]) {
          const allVariants = [normalizedVal, ...parentMap[normalizedVal].map(c => normalizeIng(c))];
          return allVariants.includes(normalizedIng);
        }
        return normalizedIng.toLowerCase() === normalizedVal.toLowerCase();
      });
    }).length;

    const isSaved = savedRecipes.includes(item.url);
    return (
      <li className="menu-card" onClick={() => { setRecipeModal(item); setModalVideoPlaying(false); }}>
        {ytId && (
          <img
            src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
            alt={item.name}
            className="menu-thumbnail"
            loading="lazy"
            decoding="async"
          />
        )}
        {IS_DEV && (
          <button
            className={`menu-card-save-btn${isSaved ? " saved" : ""}`}
            onClick={(e) => { e.stopPropagation(); toggleSave(item.url); }}
            title={isSaved ? (language === "kr" ? "저장 취소" : "Unsave") : (language === "kr" ? "저장하기" : "Save")}
          >
            {isSaved ? <FaBookmark size={14} /> : <FaRegBookmark size={14} />}
          </button>
        )}
        <div className="menu-text">
          <div className="menu-name">{item.name || "No Name"}</div>
          {item.uploader && (
            <div className="menu-chef-row">
              <img
                src={channelProfiles[item.uploader] || ""}
                alt={item.uploader}
                className="menu-chef-avatar"
                onError={(e) => { e.target.style.display = "none"; }}
              />
              <span className="menu-uploader">{item.uploader}</span>
              {matchCount > 0 && (
                <span className="menu-match-badge">{matchCount}/{mainIngs.length}</span>
              )}
            </div>
          )}
          <div className="ingredient-tags">
            {cardIngredients.slice(0, 5).map((ing, i) => {
              const isHighlighted = selectedIngredientValues.has(ing.toLowerCase());
              return (
                <span key={i} className={`ingredient-pill${isHighlighted ? " ingredient-pill-highlight" : ""}`}>
                  {ing}
                </span>
              );
            })}
            {cardIngredients.length > 5 && (
              <span className="ingredient-pill ingredient-pill-more">
                +{cardIngredients.length - 5}
              </span>
            )}
            {seasoningIngs.length > 0 && (
              <span className="ingredient-pill ingredient-pill--seasoning ingredient-pill--seasoning-card">
                {language === "kr" ? `+양념 ${seasoningIngs.length}` : `+Seasonings ${seasoningIngs.length}`}
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
          {IS_DEV && (
            <>
              <button
                onClick={() => setActiveTab(activeTab === "chef" ? "home" : "chef")}
                className={`header-link${activeTab === "chef" ? " header-link-active" : ""}`}
              >
                {t.aiChef}
              </button>
              <button
                onClick={() => setActiveTab(activeTab === "saved" ? "home" : "saved")}
                className={`header-link header-link-saved${activeTab === "saved" ? " header-link-active" : ""}`}
              >
                <FaBookmark size={13} style={{ marginRight: 4, verticalAlign: "middle" }} />
                {savedRecipes.length > 0 && (
                  <span className="saved-count-badge">{savedRecipes.length}</span>
                )}
                {language === "kr" ? "저장됨" : "Saved"}
              </button>
              <button onClick={() => setAnalyzeOpen(true)} className="header-link header-link-desktop">
                Analyze
              </button>
            </>
          )}
          {!chefProfile && <a href="#about" className="header-link header-link-desktop">About</a>}
          {chefProfile ? (
            <>
              <a href={chefProfile.youtubeUrl} target="_blank" rel="noopener noreferrer" className="header-icon-btn" title={`${chefProfile.displayName} 유튜브`}>
                <YouTubeHeaderIcon size={24} />
              </a>
              {chefProfile.instagramUrl && (
                <a href={chefProfile.instagramUrl} target="_blank" rel="noopener noreferrer" className="header-icon-btn" title={`${chefProfile.displayName} 인스타그램`}>
                  <InstagramGradientIcon size={24} />
                </a>
              )}
            </>
          ) : (
            <>
              <a href="mailto:ndk68790@gmail.com" style={{ fontSize: "1.1rem", lineHeight: 1 }}>✉️</a>
              <a href="https://www.instagram.com/andy__yeyo/" target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center" }}>
                <InstagramGradientIcon size={18} />
              </a>
            </>
          )}
          {!chefProfile && (
            <button onClick={() => setLanguage(language === "kr" ? "en" : "kr")} className="dark-toggle">
              {language === "kr" ? "EN" : "KR"}
            </button>
          )}
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
      <Modal open={!!recipeModal} onClose={() => { setRecipeModal(null); setModalVideoPlaying(false); }} darkMode={darkMode}>
        {recipeModal && (
          <div className="recipe-modal">
            <div className="recipe-modal-header">
              <h2 className="recipe-modal-title">{recipeModal.name}</h2>
              {IS_DEV && (
                <button
                  className={`recipe-modal-save-btn${savedRecipes.includes(recipeModal.url) ? " saved" : ""}`}
                  onClick={() => toggleSave(recipeModal.url)}
                  title={savedRecipes.includes(recipeModal.url) ? (language === "kr" ? "저장 취소" : "Unsave") : (language === "kr" ? "저장하기" : "Save")}
                >
                  {savedRecipes.includes(recipeModal.url)
                    ? <><FaBookmark size={14} style={{ marginRight: 5 }} />{language === "kr" ? "저장됨" : "Saved"}</>
                    : <><FaRegBookmark size={14} style={{ marginRight: 5 }} />{language === "kr" ? "저장하기" : "Save"}</>
                  }
                </button>
              )}
            </div>
            <div className="recipe-modal-meta">
              <img
                src={channelProfiles[recipeModal.uploader] || ""}
                alt={recipeModal.uploader}
                className="recipe-modal-avatar"
                onError={(e) => { e.target.style.display = "none"; }}
              />
              <div className="recipe-modal-meta-text">
                {recipeModal.uploader && (
                  <span className="recipe-modal-uploader">{recipeModal.uploader}</span>
                )}
                {recipeModal.upload_date && (
                  <span className="recipe-modal-date">{recipeModal.upload_date}</span>
                )}
              </div>
            </div>
            {extractYouTubeId(recipeModal.url) && (() => {
              const ytId = extractYouTubeId(recipeModal.url);
              return (
                <div style={{ margin: "0 0 16px" }}>
                  {modalVideoPlaying ? (
                    <div className="recipe-modal-thumb-link playing">
                      <iframe
                        className="recipe-modal-iframe"
                        src={`https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`}
                        allow="autoplay; encrypted-media"
                        allowFullScreen
                        loading="lazy"
                        title={recipeModal.name}
                      />
                    </div>
                  ) : (
                    <div
                      className="recipe-modal-thumb-link recipe-modal-thumb-play"
                      onClick={() => setModalVideoPlaying(true)}
                    >
                      <img
                        src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
                        alt={recipeModal.name}
                        className="recipe-modal-iframe"
                        style={{ objectFit: "cover" }}
                      />
                      <div className="recipe-modal-play-overlay">▶</div>
                    </div>
                  )}
                </div>
              );
            })()}
            <div className="recipe-modal-section">
              {(() => {
                const all = [...new Set((recipeModal.ingredients || []).map(ing => normalizeIng(ing)))];
                const mainList = all.filter(ing => !SEASONINGS.has(ing));
                const seasoningList = all.filter(ing => SEASONINGS.has(ing));
                const sortedMain = [
                  ...mainList.filter(ing => selectedIngredientValues.has(ing.toLowerCase())),
                  ...mainList.filter(ing => !selectedIngredientValues.has(ing.toLowerCase())),
                ];
                return (
                  <div className="recipe-modal-ingredients">
                    {sortedMain.length > 0 && (
                      <div className="ingredient-group">
                        <span className="ingredient-group-label">{t.mainIngredients}</span>
                        <div className="ingredient-group-pills">
                          {sortedMain.map((ing, i) => (
                            <span key={i} className={`ingredient-pill${selectedIngredientValues.has(ing.toLowerCase()) ? " ingredient-pill-highlight" : ""}`}>{ing}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {seasoningList.length > 0 && (
                      <div className="ingredient-group">
                        <span className="ingredient-group-label ingredient-group-label--seasoning">{t.seasonings}</span>
                        <div className="ingredient-group-pills">
                          {seasoningList.map((ing, i) => (
                            <span key={`s${i}`} className="ingredient-pill ingredient-pill--seasoning">{ing}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
            <div className="recipe-modal-steps">
              <h3 className="recipe-modal-section-title">{t.steps}</h3>
              {recipeModal.steps && recipeModal.steps.length > 0 ? (
                <ol>
                  {recipeModal.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              ) : (
                <p className="recipe-modal-no-steps">
                  {t.noSteps}
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {activeTab === "chef" ? (
        <ChefAI darkMode={darkMode} />
      ) : activeTab === "saved" ? (
        <div className="saved-tab-container">
          <h2 className="saved-tab-title">
            {language === "kr" ? "저장한 레시피" : "Saved Recipes"}
          </h2>
          {savedRecipes.length === 0 ? (
            <div className="saved-tab-empty">
              <FaRegBookmark size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p>{language === "kr" ? "저장된 레시피가 없습니다." : "No saved recipes yet."}</p>
              <p style={{ fontSize: "0.85rem", opacity: 0.5 }}>
                {language === "kr" ? "레시피 카드의 북마크 버튼을 눌러 저장해보세요." : "Click the bookmark icon on any recipe card to save it."}
              </p>
            </div>
          ) : (
            <ul className="menu-list grid-list">
              {validRecipes
                .filter(item => savedRecipes.includes(item.url))
                .map((item, idx) => (
                  <RecipeCard key={`saved-${idx}`} item={item} />
                ))}
            </ul>
          )}
        </div>
      ) : (
        <>
          {/* Hero Section */}
          <section className="hero">
            {chefProfile ? (
              <div className="chef-hero-identity">
                {channelProfiles[CHEF_FILTER] && (
                  <div className="chef-hero-avatar-ring">
                    <img
                      src={channelProfiles[CHEF_FILTER]}
                      alt={chefProfile.displayName}
                      className="chef-hero-avatar"
                    />
                  </div>
                )}
                <p className="chef-hero-name">{chefProfile.displayName}</p>
                <span className="chef-hero-count">{recipeCount}+ 레시피</span>
              </div>
            ) : (
              <div className="hero-badge">{t.heroBadge(recipeCount)}</div>
            )}
            <h1 className="hero-title">
              {(chefProfile
                ? (language === "kr" ? chefProfile.heroTitle : chefProfile.heroTitleEn)
                : t.heroTitle
              ).split("\n").map((line, i) => (
                <span key={i}>{line}{i === 0 && <br />}</span>
              ))}
            </h1>
            <p className="hero-subtitle">
              {chefProfile
                ? (language === "kr" ? chefProfile.heroSubtitle : chefProfile.heroSubtitleEn)
                : t.heroSubtitle}
            </p>
            <div className="hero-search">
              <TagSearch
                onSearch={handleSearch}
                options={availableGroupedOptions}
                language={language}
                darkMode={darkMode}
                value={selectedIngredients}
                onChange={setSelectedIngredients}
                onInputChange={setSearchInputValue}
              />
            </div>

            {/* 인기 재료 태그 */}
            {!searchActive && !searchInputValue.trim() && (
              <div className="hero-popular">
                <span className="hero-popular-label">
                  {language === "kr" ? "인기" : "Popular"}
                </span>
                {popularTags.map((tag) => {
                  const opt = { value: tag, label: tag, group: "ingredient" };
                  const isSelected = selectedIngredients.some(s => s.value === tag);
                  return (
                    <button
                      key={tag}
                      className={`hero-popular-tag${isSelected ? " selected" : ""}`}
                      onClick={() => {
                        if (isSelected) return;
                        const next = [...selectedIngredients, opt];
                        setSelectedIngredients(next);
                        handleSearch(next);
                      }}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            )}

            {/* 검색 결과 수 */}
            {searchActive && (
              <div className="hero-result-msg">
                {language === "kr"
                  ? `${selectedIngredients.map(s => s.label).join(" + ")}(으)로 만들 수 있는 요리 ${sortedResults.length}가지`
                  : `${sortedResults.length} recipe${sortedResults.length !== 1 ? "s" : ""} with ${selectedIngredients.map(s => s.label).join(" + ")}`}
              </div>
            )}
            {!searchActive && searchInputValue.trim() && liveFilteredData && (
              <div className="hero-result-msg">
                {language === "kr"
                  ? `"${searchInputValue}" 관련 요리 ${sortedResults.length}가지`
                  : `${sortedResults.length} recipe${sortedResults.length !== 1 ? "s" : ""} for "${searchInputValue}"`}
              </div>
            )}

          </section>

          {/* About Section - 검색 중에는 숨김 */}
          {!searchActive && !chefProfile && <AboutSection darkMode={darkMode} language={language} t={t} />}


          {/* All Menu */}
          <section className="section">
            <div className="container">
              <div className="section-header">
                <div>
                  <h2 className="section-title">{t.allRecipes}</h2>
                  {searchActive && (
                    <p className="search-result-count">
                      {language === "kr"
                        ? `${sortedResults.length}개 레시피 발견`
                        : `${sortedResults.length} recipe${sortedResults.length !== 1 ? "s" : ""} found`}
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {!CHEF_FILTER && <select
                    value={selectedChef}
                    onChange={(e) => setSelectedChef(e.target.value)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: `1px solid ${darkMode ? "#444" : "#ddd"}`,
                      background: darkMode ? "#222" : "#fff",
                      color: darkMode ? "#eee" : "#222",
                      fontSize: 13,
                      cursor: "pointer",
                      maxWidth: 160,
                    }}
                  >
                    <option value="all">{t.allChefs}</option>
                    {chefOptions.map((chef) => (
                      <option key={chef} value={chef}>{chef}</option>
                    ))}
                  </select>}
                  <div className="sort-toggle">
                    <button
                      className={`sort-btn ${allMenuSort === "name" ? "active" : ""}`}
                      onClick={() => setAllMenuSort("name")}
                    >
                      {t.nameSort}
                    </button>
                    <button
                      className={`sort-btn ${allMenuSort === "date" ? "active" : ""}`}
                      onClick={() => setAllMenuSort("date")}
                    >
                      {t.dateSort}
                    </button>
                  </div>
                </div>
              </div>
              <ul className="menu-list grid-list">
                {sortedResults.length > 0 ? (
                  sortedResults.map((item, idx) => (
                    <RecipeCard key={`all-${idx}`} item={item} />
                  ))
                ) : (
                  <p className="no-results">{t.noResults}</p>
                )}
              </ul>
            </div>
          </section>

          {/* Footer */}
          <footer className={`site-footer${darkMode ? " dark" : ""}`}>
            <div className="site-footer-inner">
              <span className="site-footer-brand">Findish</span>
              <span className="site-footer-copy">© 2026 Findish. All rights reserved.</span>
              <div className="site-footer-links">
                <a href="https://www.instagram.com/andy__yeyo/" target="_blank" rel="noopener noreferrer">📸 andy_yeyo</a>
                <a href="mailto:ndk68790@gmail.com">✉️ ndk68790@gmail.com</a>
                {!chefProfile && <a href="#about">About</a>}
              </div>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}

export default App;
