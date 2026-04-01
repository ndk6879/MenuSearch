const translations = {
  kr: {
    // Header
    aiChef: "AI 셰프",

    // Hero
    heroBadge: (n) => `${n}+ 레시피`,
    heroTitle: "가지고 있는 재료로\n만들 수 있는 레시피 찾기",
    heroSubtitle: "나의 재료로 셰프들의 레시피를 따라해보세요!",

    // Sections
    allRecipes: "전체 메뉴",
    nameSort: "이름순",
    dateSort: "최신순",
    allChefs: "셰프 전체",
    noResults: "검색 결과가 없습니다.",

    // Modal
    ingredients: "재료",
    mainIngredients: "주재료",
    seasonings: "양념 & 소스",
    steps: "Steps",
    noSteps: "레시피 준비 중",

    // About
    aboutEyebrow: "Findish의 시작",
    aboutTitle: "남은 재료 어떻게 하지?\n그 고민에서 시작했어요.",
    aboutBody: `뭘 해먹을지 모르겠고, 같은 요리는 질리고, 어떤 다른 요리가 가능한지 궁금하고.\n이런 고민과 문제에서 Findish가 시작됐습니다.\n남은 재료로, 오늘 식사를 해결해 보세요!`,
    featuresLabel: "주요 기능",
    features: [
      {
        icon: "🥬",
        title: "재료 기반 검색",
        desc: "냉장고에 있는 재료만 입력하면 만들 수 있는 요리를 바로 찾아줍니다. 레시피 사이트를 뒤질 필요 없어요!",
      },
      {
        icon: "🎬",
        title: "유튜브 셰프 레시피",
        desc: "전문 셰프 유튜버들의 영상을 AI로 분석해 재료와 순서를 정리했습니다. 영상을 보며 따라 만들 수 있어요!",
      },
      {
        icon: "🤖",
        title: "AI 셰프 — Coming Soon",
        desc: "어떤 재료가 있는지 말하면 AI 셰프가 요리를 추천하고 레시피를 알려드립니다. 곧 만나보실 수 있어요!",
        comingSoon: true,
      },
    ],
    contactLabel: "문의하기",
    contactTitle: "불편한 점이나 추가됐으면 하는 레시피가 있나요?",
    contactBody:
      "서비스 이용 중 불편한 점, 원하는 기능, 추천하고 싶은 유튜버가 있다면 언제든 알려주세요. 더\u00A0나은 Findish를 만드는 데 큰 도움이 됩니다.",
  },

  en: {
    // Header
    aiChef: "AI Chef",

    // Hero
    heroBadge: (n) => `${n}+ Recipes`,
    heroTitle: "Find recipes with\nwhat's already in your fridge",
    heroSubtitle: "Follow chef recipes using your own ingredients!",

    // Sections
    allRecipes: "All Recipes",
    nameSort: "A-Z",
    dateSort: "Latest",
    allChefs: "All Chefs",
    noResults: "No matching menu found.",

    // Modal
    ingredients: "Ingredients",
    mainIngredients: "Main Ingredients",
    seasonings: "Seasonings & Sauces",
    steps: "Steps",
    noSteps: "Recipe coming soon",

    // About
    aboutEyebrow: "How Findish started",
    aboutTitle: "What do I do with these leftovers?\nThat question started it all.",
    aboutBody: `Not sure what to cook, tired of the same meals, wondering what else is even possible.\nThat's where Findish started.\nUse what you have, and solve today's meal!`,
    featuresLabel: "Key Features",
    features: [
      {
        icon: "🥬",
        title: "Ingredient-based Search",
        desc: "Just enter what you have in the fridge and we'll find recipes you can actually make — no extra shopping needed!",
      },
      {
        icon: "🎬",
        title: "YouTube Chef Recipes",
        desc: "We use AI to analyze videos from professional chef YouTubers and extract ingredients and step-by-step instructions. Follow along with the video!",
      },
      {
        icon: "🤖",
        title: "AI Chef — Coming Soon",
        desc: "Tell the AI Chef what ingredients you have and get personalized recipe recommendations. Coming soon!",
        comingSoon: true,
      },
    ],
    contactLabel: "Contact",
    contactTitle: "Have feedback or a recipe you'd like to see?",
    contactBody:
      "If you find any issues, have feature requests, or want to suggest a YouTube chef to add — we'd love to hear from you.",
  },
};

export default translations;
