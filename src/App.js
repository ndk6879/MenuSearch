
import React, { useState } from "react";
import "./App.css";
import TagSearch from "./TagSearch";
import menuData_kr from "./menuData_kr";
import menuData_en from "./menuData_en";
import { FaGithub, FaInstagram } from "react-icons/fa";

import Modal from "./components/Modal";
import AnalyzePanel from "./components/AnalyzePanel";
import ChefAI from "./components/ChefAI";
import channelProfiles from "./channelData";
import AboutSection from "./components/AboutSection";
import translations from "./i18n";


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
  const [activeTab, setActiveTab] = useState("home"); // "home" | "chef"

  const defaultLanguage = navigator.language.startsWith("ko") ? "kr" : "en";
  const [language, setLanguage] = useState(defaultLanguage);
  const t = translations[language];
  const [darkMode, setDarkMode] = useState(false);
  const [searchActive, setSearchActive] = useState(false);

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
    // 레드와인 식초
    "레드와인 비네거": "레드와인 식초",
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
    "다진 마늘": "마늘", "통마늘": "마늘", "생마늘": "마늘",
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
    // 파스타
    "스파게티면": "파스타", "건파스타": "파스타", "생면 파스타": "파스타",
    "숏파스타": "파스타", "파스타 면": "파스타", "파스타 반죽": "파스타",
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

  // autoNormalize → synonymMap 순서로 정규화
  const normalizeIng = (ing) => {
    const auto = autoNormalize(ing);
    return synonymMap[auto] || synonymMap[ing] || auto;
  };

  // 노이즈 재료 필터 (조리 설명 문장 등)
  const isNoisyIngredient = (ing) => {
    if (!ing || ing.length > 25) return true;
    if (/[.。]/.test(ing)) return true;
    if (/준비한다|구워준다|넣는다|볶는다|끓인다|만든다|섞는다|썬다|담는다|자른다|버린다|걸러서|우린다|벗겨|제거한다/.test(ing)) return true;
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
    setSearchActive(selected.length > 0);
    if (selected.length === 0) {
      setSearchResults(sortedData);
      return;
    }
    const filtered = filterMenusByIngredients(selected);
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

  // 상위어(돼지고기, 닭고기 등)도 검색 옵션에 추가
  for (const parent of Object.keys(parentMap)) {
    if (!normalizedIngredientsSet.has(parent)) {
      normalizedIngredientsSet.add(parent);
      ingredientOptions.push({ value: parent, label: parent });
    }
  }

  ingredientOptions.sort((a, b) => a.label.localeCompare(b.label, "ko"));

const [allMenuSort, setAllMenuSort] = useState("name"); // "name" | "date"
  const [selectedChef, setSelectedChef] = useState("all");

  const chefOptions = Array.from(
    new Set(validRecipes.map((r) => r.uploader).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "ko"));

  const filteredResults = searchResults.filter(isValidRecipe).filter((r) =>
    selectedChef === "all" ? true : r.uploader === selectedChef
  );

  const sortedResults = [...filteredResults].sort((a, b) => {
    if (allMenuSort === "name") {
      return (a.name || "").localeCompare(b.name || "", "ko");
    }
    return new Date(b.upload_date) - new Date(a.upload_date);
  });

  const RecipeCard = ({ item }) => {
    const ytId = extractYouTubeId(item.url);
    const normalizedIngredients = [...new Set(
      (item.ingredients || []).map(ing => normalizeIng(ing))
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
            <div className="menu-chef-row">
              <img
                src={channelProfiles[item.uploader] || ""}
                alt={item.uploader}
                className="menu-chef-avatar"
                onError={(e) => { e.target.style.display = "none"; }}
              />
              <span className="menu-uploader">{item.uploader}</span>
            </div>
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
          <button
            onClick={() => setActiveTab(activeTab === "chef" ? "home" : "chef")}
            className={`header-link${activeTab === "chef" ? " header-link-active" : ""}`}
          >
            {t.aiChef}
          </button>
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
          <button onClick={() => setLanguage(language === "kr" ? "en" : "kr")} className="dark-toggle">
            {language === "kr" ? "EN" : "KR"}
          </button>
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
              <div className="recipe-modal-thumb-link playing">
                <iframe
                  className="recipe-modal-iframe"
                  src={`https://www.youtube.com/embed/${extractYouTubeId(recipeModal.url)}?autoplay=0&rel=0`}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  title={recipeModal.name}
                />
              </div>
            )}
            <h2 className="recipe-modal-title">{recipeModal.name}</h2>
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
            <hr className="recipe-modal-divider" />
            <div className="recipe-modal-section">
              <h3 className="recipe-modal-section-title">{t.ingredients}</h3>
              <div className="recipe-modal-ingredients">
                {[...new Set((recipeModal.ingredients || []).map(ing => normalizeIng(ing)))].map((ing, i) => (
                  <span key={i} className="ingredient-pill">{ing}</span>
                ))}
              </div>
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
      ) : (
        <>
          {/* Hero Section */}
          <section className="hero">
            <div className="hero-badge">{t.heroBadge(recipeCount)}</div>
            <h1 className="hero-title">
              {t.heroTitle.split("\n").map((line, i) => (
                <span key={i}>{line}{i === 0 && <br />}</span>
              ))}
            </h1>
            <p className="hero-subtitle">{t.heroSubtitle}</p>
            <div className="hero-search">
              <TagSearch
                onSearch={handleSearch}
                options={ingredientOptions}
                language={language}
                darkMode={darkMode}
              />
            </div>
          </section>

          {/* About Section - 검색 중에는 숨김 */}
          {!searchActive && <AboutSection darkMode={darkMode} language={language} t={t} />}

          {/* All Menu */}
          <section className="section">
            <div className="container">
              <div className="section-header">
                <h2 className="section-title">{t.allRecipes}</h2>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <select
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
                  </select>
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

        </>
      )}
    </div>
  );
}

export default App;
