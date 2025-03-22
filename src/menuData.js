const menuData = [
    {
        name: "회 카르파초",
        url: "https://www.youtube.com/watch?v=Bhq0ApL-Un0",
        uploader: "공격수셰프",
        tip: "",
        ingredients: ["유자폰즈", "쉐리식초", "설탕", "라임", "청양고추", "대파", "다진 마늘", "무"]
    },      

    {
        name: "버섯스테이크 라면",
        url: "https://www.youtube.com/watch?v=R0N3mTYFOEM",
        uploader: "공격수셰프",
        tip: "쉽고 맛있고 플레이팅도 예쁨. 씹레전드..",
        ingredients: ["오징어짬뽕", "짜파게티", "쪽파", "스테이크", "팽이버섯"]
    },
      
    {
        name: "고든램지 셰프의 첫 미슐랭 3스타를 만든 생선 요리",
        url: "https://www.youtube.com/watch?v=7UVXlMM8WzA",
        uploader: "맛수령",
        tip: "사랑하는 사람을 위해 특별한 날 요리했다 나 혼자 먹고싶어지는 맛. 사랑하는 사람이 화나서 뺏어먹다 그 사람도 혼자 먹고싶어지는 맛",
        ingredients: ["참돔", "감자", "버터", "생크림", "샬롯", "딜"]
    }, 
      
    {
        name: "스페인 대구요리 with 바칼라+아이올리소스",
        url: "https://www.youtube.com/watch?v=_ioVzN12z4A",
        uploader: "맛수령",
        tip: "한국인 입맛에도 딱 맞는 스페인 대구 요리",
        ingredients: ["토마토", "대구살", "마늘", "올리브유", "마요네즈", "레몬", "파프리카 가루"]
      },
      
    {
      name: "피자모음",
      url: "https://www.youtube.com/shorts/ghX3BZrGpkg",
      uploader: "만원요리최씨남매",
      tip: "미국에서 또띠아 활용해 한국식 피자 먹을수 있을듯",
      ingredients: []
    },
    {
      name: "아보카도 샌드위치",
      url: "https://www.youtube.com/watch?v=MreM6pizwKM",
      uploader: "공격수셰프",
      tip: "",
      ingredients: ["브레드", "버터", "아보카도오일", "마늘", "타임", "새우", "계란", "아보카도", "마요네즈", "설탕", "쪽파"],
    },
    {
        name: "최현석 봉골레 수제비",
        url: "https://youtube.com/watch?v=NS8Gk8P-nAM",
        uploader: "낭만돼지 김준현",
        tip: "세상에서 가장 위대한 셰프는 자연이다. 셰프는 자연의 재료들을 재배열할 뿐",
        ingredients: ["마늘", "봉골레", "수제비", "올리브오일", "버터", "파슬리"]
    },
    {
        name: "마라크림새우스튜",
        url: "https://youtube.com/watch?v=NS8Gk8P-nAM",
        uploader: "낭만돼지 김준현",
        tip: "익숙함을 특별함으로 만드는 것",
        ingredients: ["대하새우", "마늘", "마라크림", "파슬리"]
    },
    {
        name: "항정살 콩피 & 매콤한 사과잼",
        url: "https://www.youtube.com/watch?v=hr2o5AqvJj0&t=729s",
        uploader: "공격수셰프",
        tip: "달콤한 사과잼과 고소한 항정살의 조합이 훌륭함",
        ingredients: [
          "항정살", "생수", "스타아니스", "마늘", "통후추", "소금", "꿀",
          "올리브오일", "월계수잎",
          "버터", "사과", "양파", "건포도", "생강", "페퍼크러쉬", "계피스틱", "쉐리식초", "알룰로스", "쪽파"
        ]
      },      
      
      
    {
      name: "화이트라구파스타",
      url: "https://www.youtube.com/watch?v=BpnkEJ7Oyos",
      uploader: "",
      tip: "",
    },
    {
      name: "감귤마요 새우튀김",
      url: "https://youtube.com/watch?v=eMzG2QEEPQQ",
      uploader: "",
      tip: "",
    },
    {
      name: "감귤 닭스테이크",
      url: "https://www.youtube.com/watch?v=H4TGm0L_E7",
      uploader: "",
      tip: "",
    },
    {
      name: "감귤 관자",
      url: "https://www.youtube.com/watch?v=9Pi-qt_9YU0",
      uploader: "",
      tip: "",
    },
    {
      name: "라구파스타",
      url: "https://www.youtube.com/watch?v=IizsoHay4SM",
      uploader: "",
      tip: "",
    },
    {
      name: "관자 버섯요리",
      url: "https://www.youtube.com/watch?v=9Pi-qt_9YU0",
      uploader: "",
      tip: "",
    },
    {
      name: "항정살 라면",
      url: "https://www.youtube.com/watch?v=JnD9ZAYIFZ",
      uploader: "",
      tip: "",
    },
    {
      name: "육식맨 버섯스테이크",
      url: "https://www.youtube.com/watch?v=RE-4LOMTSBU",
      uploader: "육식맨",
      tip: "",
    },
    {
      name: "토마토스프",
      url: "https://www.youtube.com/watch?v=qDF_6HLIY6o&t=316s",
      uploader: "",
      tip: "",
    },
    {
      name: "스테이크",
      url: "https://www.youtube.com/watch?v=X95NHDmx0bI",
      uploader: "",
      tip: "",
    },
    {
      name: "토마토",
      url: "https://www.youtube.com/shorts/1eaz1uFwjZU",
      uploader: "",
      tip: "",
    },
    {
      name: "후추 스테이크",
      url: "https://www.youtube.com/watch?v=WNiS9a9qTqs",
      uploader: "",
      tip: "",
    },
    {
      name: "황금볶음밥",
      url: "https://www.youtube.com/watch?v=AMIC2tmNlGk",
      uploader: "공쉪",
      tip: "개쉬워보임",
    },
    {
        name: "차이브 양갈비",
        url: "https://www.youtube.com/watch?v=eABvwP012Nc",
        uploader: "육식맨",
        tip: "개추",
      },
      {
        name: "마르코 화이트 쉐프 명언",
        url: "https://www.bookey.app/quote-author/marco-pierre-white",
        uploader: "Marco Pierre White",
        tip: "요리는 즐거워야 한다, 아니라면 그냥 나가서 사먹는 걸 권장한다. / 그리 완벽할 필요 없다, 아니어도 충분히 특별하다.",
      },
      {
        name: "양갈비 + 양고기스테이크",
        url: "https://youtube.com/watch?v=L9vTdyl8CWI",
        uploader: "강레오",
        tip: "",
      },
      {
        name: "술안주",
        url: "https://www.youtube.com/shorts/IVMx-RDDhuY",
        uploader: "",
        tip: "쉽고 맛있어보임",
      },
      {
        name: "고든렘지 샌드위치",
        url: "https://www.youtube.com/shorts/smIOeJRexWI",
        uploader: "고든렘지",
        tip: "개쉽고 맛잇어보임",
      },
      {
        name: "꼬리곰탕",
        url: "https://www.youtube.com/watch?v=UyhrOajdpQU",
        uploader: "아하부장",
        tip: "MSG없이 가능",
      },
      {
        name: "꼬리수육",
        url: "https://www.youtube.com/watch?v=IV_fNz4ojlI",
        uploader: "육식맨",
        tip: "",
      },
      {
        name: "프렌치토스트",
        url: "https://www.youtube.com/shorts/GplGY_ExQFs",
        uploader: "",
        tip: "쉽고 맛있어보임",
      },
      {
        name: "프렌치토스트2",
        url: "https://www.youtube.com/shorts/zGijEP_KKdY",
        uploader: "",
        tip: "쉽고 맛있어보임",
      },
      {
        name: "커리부어스트 (독일음식)",
        url: "https://www.youtube.com/watch?v=U7cujPVrudw",
        uploader: "",
        tip: "쉽고 맛있어보임",
      },
      {
        name: "마제소바",
        url: "https://www.youtube.com/shorts/YoU9hquQ22o",
        uploader: "",
        tip: "",
      },
      {
        name: "스테이크 타르타르",
        url: "https://www.youtube.com/shorts/YIACyktyCY8",
        uploader: "",
        tip: "",
      },
      {
        name: "라따뚜이",
        url: "https://www.youtube.com/shorts/uJZSviosysM",
        uploader: "",
        tip: "",
      },
      {
        name: "탄탄면",
        url: "https://www.youtube.com/watch?v=8RWnsvjxIRU",
        uploader: "",
        tip: "",
      },
      {
        name: "라따뚜이",
        url: "https://www.youtube.com/watch?v=FdbU7-kSQ2A&t=16s",
        uploader: "강레오",
        tip: "",
      },
      {
        name: "오리고기 + 버섯",
        url: "https://www.youtube.com/watch?v=SqJx9EgG_kQ",
        uploader: "강레오",
        tip: "",
      },
      {
        name: "광어튀김",
        url: "https://www.youtube.com/watch?v=KzUTBj0kK0Q",
        uploader: "강레오",
        tip: "",
      },
      {
        name: "독돔구이 + 토마토 살사",
        url: "https://www.youtube.com/watch?v=pK6aVCb4X3c",
        uploader: "강레오",
        tip: "",
      },
      {
        name: "토마토 계란 부추 제육볶음",
        url: "https://www.youtube.com/watch?v=LOW4oXLYu64",
        uploader: "강레오",
        tip: "",
      },
      {
        name: "지중해식 생선구이",
        url: "https://www.youtube.com/watch?v=umLY_6nOuOE",
        uploader: "강레오",
        tip: "엄청 맛있대",
      },
      {
        name: "토마토 해장 라면",
        url: "https://www.youtube.com/watch?v=lIAye5iO7FY",
        uploader: "강레오",
        tip: "개맛있대",
      },
      {
        name: "쌀 생선구이",
        url: "https://www.youtube.com/watch?v=haX9oH9ojEE",
        uploader: "",
        tip: "ㅈㄴ쉬워보임",
      },
      {
        name: "가자미 감바스",
        url: "https://www.youtube.com/watch?v=ZU246sO-uno",
        uploader: "",
        tip: "",
      },
      {
        name: "꿀대구 마요",
        url: "https://www.youtube.com/watch?v=_ioVzN12z4A&t=429s",
        uploader: "맛수령",
        tip: "",
      },
      {
        name: "참돔 감자 요리",
        url: "https://www.youtube.com/watch?v=7UVXlMM8WzA",
        uploader: "맛수령",
        tip: "",
      },
      {
        name: "토마토 검정 파스타",
        url: "https://www.youtube.com/watch?v=qJN5cu-x-B4",
        uploader: "공격수셰프",
        tip: "",
      },
      {
        name: "토마토 김장",
        url: "https://www.youtube.com/watch?v=iaTscMN2FNE",
        uploader: "",
        tip: "",
      },
      {
        name: "항정살",
        url: "https://www.youtube.com/shorts/X0ijVGo0v4Q",
        uploader: "밥김국",
        tip: "",
      },
      {
        name: "버터 파스타",
        url: "https://www.youtube.com/watch?v=iKaLAnPZGyM",
        uploader: "맛동무",
        tip: "",
      },
      {
        name: "돼지고기 스테이크",
        url: "https://www.youtube.com/watch?v=CVyniN--dDE",
        uploader: "강레오",
        tip: "",
      },
      {
        name: "전복 파스타",
        url: "https://www.youtube.com/watch?v=-AjoAl9SeWw",
        uploader: "",
        tip: "",
      },
      {
        name: "클라우티 = 체리 디저트",
        url: "https://www.youtube.com/watch?v=7-NXoPYmO3c",
        uploader: "강레오",
        tip: "노오븐",
      },
      {
        name: "에그베네딕트",
        url: "https://www.youtube.com/watch?v=3UKlryG_riE",
        uploader: "강레오",
        tip: "",
      },
      {
        name: "진짜사나이 후식",
        url: "https://www.youtube.com/watch?v=bujZkYFGzGU",
        uploader: "",
        tip: "우리나라 과자. 아이스크림 같은 걸로 다양한 디저트 가능. 세계적 경쟁력 있을지도!",
      },
      {
        name: "버터 & 푸딩 브레드",
        url: "https://www.youtube.com/watch?v=R2ysLQYxqt",
        uploader: "강레오",
        tip: "",
      },
      {
        name: "연어사비체",
        url: "https://www.youtube.com/watch?v=Yk8QtDuFo9A",
        uploader: "맛수령",
        tip: "정말 쉬움",
      },
      {
        name: "병어세비체",
        url: "https://www.youtube.com/watch?v=uyGI3hLpzMc",
        uploader: "강레오",
        tip: "병어는 흰살이고 비린내 거의 없음",
      },
      {
        name: "연어 크리스피 스테이크",
        url: "https://www.youtube.com/watch?v=uMWIQXm-FpY",
        uploader: "공격수셰프",
        tip: "맛있어보임",
      },
      {
        name: "김치 파스타",
        url: "https://www.youtube.com/watch?v=6epy51dKxaQ",
        uploader: "공격수셰프",
        tip: "개맛있어보임. 대파에 하트모양 서비스 ><",
      },
      {
        name: "스페인 계란 오믈렛",
        url: "https://www.youtube.com/watch?v=xssPQ7fS7PI",
        uploader: "강레오",
        tip: "",
      },
      {
        name: "토마토 부라타치즈 샐러드",
        url: "https://www.youtube.com/shorts/nCHzy54eGWs",
        uploader: "",
        tip: "",
      },
      {
        name: "키위 카르파치오",
        url: "https://www.youtube.com/shorts/ohDIcCXIteY",
        uploader: "공솊",
        tip: "개개개개개개쉬움 ㄷㄷ",
      },
      {
        name: "세상에서 제일 쉬운 고급 연어콩피 요리",
        url: "https://www.youtube.com/watch?v=2S393ovRVrM",
        uploader: "강레오",
        tip: "맛있고 세상 간단하고 쉬운거같음",
      },
      {
        name: "양 스테이크",
        url: "https://www.youtube.com/watch?v=L9vTdyl8CWI",
        uploader: "강레오",
        tip: "너무쉽고 맛있어보임..",
      },
      {
        name: "연어콩피 및 브런치",
        url: "https://www.youtube.com/watch?v=0N9-mpDBzxM",
        uploader: "",
        tip: "쉽고 개맛있어보임",
      },
      {
        name: "토마토김치고기스튜",
        url: "https://www.youtube.com/watch?v=jyfdFs_894c",
        uploader: "공격수셰프",
        tip: "쉽고 개맛도리로 보임..",
      },
      {
        name: "닭다리 스테이크",
        url: "https://www.youtube.com/watch?v=P1ID52sPl_c",
        uploader: "맛수령",
        tip: "개쉽고 맛있어보임",
      },
      {
        name: "홀캔토마토 파스타 강의",
        url: "https://youtube.com/watch?v=FnOxV_6EXgs",
        uploader: "맛수령",
        tip: "",
      },
      {
        name: "연어섞은밥",
        url: "https://www.youtube.com/watch?v=U2PyiSXAlrs",
        uploader: "최강록",
        tip: "개개개개쉬움",
      },
      {
        name: "배추스테이크",
        url: "https://www.youtube.com/watch?v=MnC46BncM18",
        uploader: "셰프호윤",
        tip: "졸라 맛있고 간단하고 몸에 좋아보이고 고급스러워보임",
      },
      {
        name: "크림랍스터",
        url: "https://www.youtube.com/shorts/IVPbxQHr9zc",
        uploader: "공격수셰프",
        tip: "",
      },
      {
        name: "크림고기양송이버섯스튜",
        url: "https://www.youtube.com/watch?v=FjArRPBN7iQ&t=10s",
        uploader: "강레오",
        tip: "",
      },
      {
        name: "버섯루꼴라양파고기샐러드",
        url: "https://www.youtube.com/watch?v=SqJx9EgG_kQ&t=46s",
        uploader: "강레오",
        tip: "",
      },
      {
        name: "시금치파스타",
        url: "https://www.youtube.com/shorts/zNfd-IOzulU",
        uploader: "",
        tip: "",
      },
      {
        name: "시금치토마토양파그릭요거트피자",
        url: "https://youtube.com/shorts/rN1N-Fj3n9Y",
        uploader: "",
        tip: "",
      },
      {
        name: "봉골레 수제비 & 마라크림새우",
        url: "https://www.youtube.com/watch?v=NS8Gk8P-nAM",
        uploader: "",
        tip: "레시피가 조올라 쉽고 맛있어보임. 최고의 요리사는 자연이다. 우리는 그저 재배치할 뿐. 익숙함을 특별하게 만드는 거.",
      },
      {
        name: "",
        url: "https://www.youtube.com/watch?v=0O03sStIUVk&list=LL&index=1",
        uploader: "",
        tip: "ㅈㄴ쉽고 맛있어보임",
      },
      {
        name: "과일칵테일",
        url: "https://www.youtube.com/shorts/6O6jBeucKko",
        uploader: "",
        tip: "",
      },

  ];
  export default menuData;
