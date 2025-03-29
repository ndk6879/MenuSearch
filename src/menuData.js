const menuData = [
    
    {
        name: "Pepper Steak",
        url: "https://www.youtube.com/watch?v=WNiS9a9qTqs",
        uploader: "Kang Leo",
        tip: "A dish where the spiciness of pepper enhances the flavor of the steak. The taste may vary depending on the type of pepper used.",
        ingredients: ["beef tenderloin", "whole black pepper", "olive oil", "salt", "butter"]
    },
    
    {
        name: "Gordon Ramsay’s Michelin-Starred Fish",
        url: "https://www.youtube.com/watch?v=7UVXlMM8WzA",
        uploader: "Masuryoeng",
        tip: "A dish so delicious, it was meant for a loved one on a special day—but you'll end up wanting it all to yourself. Even your loved one will want it all after a bite.",
        ingredients: ["red seabream", "potato", "butter", "heavy cream", "shallot", "dill"]
    },
    

    
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
      ingredients: ["브레드", "버터", "아보카도오일", "마늘", "타임", "새우", "계란", "아보카도", "마요네즈", "설탕", "쪽파"]
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
        ingredients: ["항정살", "생수", "스타아니스", "마늘", "통후추", "소금", "꿀", "올리브오일", "월계수잎", "버터", "사과", "양파", "건포도", "생강", "페퍼크러쉬", "계피스틱", "쉐리식초", "알룰로스", "쪽파"]
    },      

    {
        name: "항정살 라면볶음",
        url: "https://www.youtube.com/watch?v=JnD9ZAYIFZQ",
        uploader: "공격수셰프",
        tip: "고급 라볶이 스타일. 개맛도리로 보임..",
        ingredients: ["고운고춧가루", "파프리카 파우더", "진간장", "설탕", "멸치액젓", "라면", "라면스프", "생수", "건새우", "양배추", "양파", "쪽파", "대파", "깐마늘", "청양고추"]
    },
    {
        name: "화이트라구파스타",
        url: "https://www.youtube.com/watch?v=BpnkEJ7Oyos",
        uploader: "공격수셰프",
        tip: "",
        ingredients: ["다진 돼지고기", "다진마늘", "다진 셀러리", "대파", "통후추", "화이트 와인", "코인육수", "생수", "스파게티", "양송이 스프", "무염버터"]
    },    {
        name: "감귤마요 새우튀김",
        url: "https://youtube.com/watch?v=eMzG2QEEPQQ",
        uploader: "공격수 셰프",
        tip: "새우는 튀김옷을 입혀 튀길 때 꼬리 부분을 잡고 튀기면 모양이 예쁘게 나옵니다. 팽이버섯은 너무 오래 튀기면 질겨지므로 살짝만 튀겨주세요. 소스는 취향에 따라 라임 주스나 마요네즈 양을 조절하시면 됩니다.",
        ingredients: ["새우", "팽이버섯", "감자 전분", "달걀 흰자", "식용유", "소금", "감귤 마멀레이드", "다진 마늘", "마요네즈", "라임 주스", "상추", "라임", "후추"]
    },
    {
        name: "감귤 닭스테이크",
        url: "https://www.youtube.com/watch?v=H4TGm0L_E7",
        uploader: "강레오",
        tip: "감귤의 상큼함과 닭고기의 담백함이 조화로운 스테이크. 감귤 소스가 닭고기의 느끼함을 잡아줍니다.",
        ingredients: ["닭다리살", "감귤", "양파", "마늘", "올리브 오일", "소금", "후추", "로즈마리"]
    },
    {
        name: "감귤 관자",
        url: "https://www.youtube.com/watch?v=9Pi-qt_9YU0",
        uploader: "강레오",
        tip: "감귤의 달콤함과 관자의 쫄깃함이 잘 어울리는 요리. 감귤 소스는 관자의 풍미를 더욱 살려줍니다.",
        ingredients: ["관자", "감귤", "양파", "마늘", "올리브 오일", "소금", "후추", "화이트 와인"]
    },
    {
        name: "라구파스타",
        url: "https://www.youtube.com/watch?v=IizsoHay4SM",
        uploader: "강레오",
        tip: "풍부한 고기 맛과 토마토소스의 깊은 맛이 어우러진 라구 파스타. 오랜 시간 끓여 깊은 맛을 내는 것이 특징입니다.",
        ingredients: ["소고기", "돼지고기", "양파", "당근", "셀러리", "토마토 페이스트", "토마토 홀", "레드 와인", "파스타", "파르미지아노 레지아노 치즈"]
    },
    {
        name: "관자 버섯요리",
        url: "https://www.youtube.com/watch?v=9Pi-qt_9YU0",
        uploader: "강레오",
        tip: "관자와 다양한 버섯의 풍미가 어우러진 요리. 버섯의 종류에 따라 다양한 맛을 즐길 수 있습니다.",
        ingredients: ["관자", "새송이버섯", "표고버섯", "양송이버섯", "마늘", "올리브 오일", "소금", "후추", "화이트 와인"]
    },
    {
        name: "항정살 라면",
        url: "https://www.youtube.com/watch?v=JnD9ZAYIFZ",
        uploader: "밥김국",
        tip: "항정살의 쫄깃함과 라면의 매콤함이 조화로운 요리. 항정살을 굽고 라면에 넣어 풍부한 맛을 더합니다.",
        ingredients: ["라면", "항정살", "양파", "대파", "청양고추", "마늘", "고춧가루", "간장", "설탕"]
    },
    {
        name: "토마토스프",
        url: "https://www.youtube.com/watch?v=qDF_6HLIY6o&t=316s",
        uploader: "강레오",
        tip: "토마토의 신선함과 다양한 채소의 풍미가 어우러진 스프. 따뜻하게 먹으면 더욱 좋습니다.",
        ingredients: ["토마토", "양파", "당근", "셀러리", "마늘", "토마토 페이스트", "올리브 오일", "소금", "후추", "바질"]
    },
    {
        name: "스테이크",
        url: "https://www.youtube.com/watch?v=X95NHDmx0bI",
        uploader: "강레오",
        tip: "소고기의 풍부한 맛을 즐길 수 있는 스테이크. 굽는 정도에 따라 다양한 맛과 식감을 즐길 수 있습니다.",
        ingredients: ["소고기 등심", "올리브 오일", "소금", "후추", "로즈마리", "타임"]
    },
    {
        name: "토마토",
        url: "https://www.youtube.com/shorts/1eaz1uFwjZU",
        uploader: "강레오",
        tip: "다양한 토마토 요리에 활용할 수 있는 기본 정보.",
        ingredients: ["토마토"]
    },

    {
        name: "양갈비 + 양고기스테이크",
        url: "https://youtube.com/watch?v=L9vTdyl8CWI",
        uploader: "강레오",
        tip: "양고기 특유의 풍미를 즐길 수 있는 요리. 양갈비와 양고기 스테이크 두 가지를 한 번에 즐길 수 있습니다.",
        ingredients: ["양갈비", "양고기 스테이크", "올리브 오일", "소금", "후추", "로즈마리", "타임", "마늘"]
    },
    {
        name: "술안주",
        url: "https://www.youtube.com/shorts/IVMx-RDDhuY",
        uploader: "강레오",
        tip: "간단하면서도 맛있는 술안주 레시피. 다양한 재료를 활용하여 만들 수 있습니다.",
        ingredients: ["닭다리살", "양파", "마늘", "고추", "간장", "설탕", "고춧가루"]
    },
    {
        name: "고든렘지 샌드위치",
        url: "https://www.youtube.com/shorts/smIOeJRexWI",
        uploader: "고든 램지",
        tip: "고든 램지의 특별한 샌드위치 레시피. 신선한 재료와 특별한 소스가 특징입니다.",
        ingredients: ["바게트 빵", "닭가슴살", "베이컨", "양상추", "토마토", "마요네즈", "머스타드"]
    },
    {
        name: "꼬리곰탕",
        url: "https://www.youtube.com/watch?v=UyhrOajdpQU",
        uploader: "아하부장",
        tip: "깊고 진한 국물 맛이 일품인 꼬리곰탕. 오랜 시간 끓여 깊은 맛을 냅니다.",
        ingredients: ["소꼬리", "무", "대파", "마늘", "생강", "소금", "후추"]
    },
    {
        name: "꼬리수육",
        url: "https://www.youtube.com/watch?v=IV_fNz4ojlI",
        uploader: "육식맨",
        tip: "부드럽고 쫄깃한 식감이 일품인 꼬리수육. 특별한 소스와 함께 즐기면 더욱 맛있습니다.",
        ingredients: ["소꼬리", "대파", "생강", "마늘", "간장", "설탕", "맛술"]
    },
    {
        name: "프렌치토스트",
        url: "https://www.youtube.com/shorts/GplGY_ExQFs",
        uploader: "강레오",
        tip: "달콤하고 부드러운 프렌치토스트. 아침 식사나 브런치로 좋습니다.",
        ingredients: ["식빵", "달걀", "우유", "설탕", "버터", "시나몬 가루"]
    },
    {
        name: "프렌치토스트2",
        url: "https://www.youtube.com/shorts/zGijEP_KKdY",
        uploader: "강레오",
        tip: "프렌치토스트의 다양한 변형 레시피. 다양한 토핑과 함께 즐길 수 있습니다.",
        ingredients: ["식빵", "달걀", "우유", "설탕", "버터", "베리", "메이플 시럽"]
    },
    {
        name: "커리부어스트 (독일음식)",
        url: "https://www.youtube.com/watch?v=U7cujPVrudw",
        uploader: "",
        tip: "맥주와 완벽하게 어울리는 독일식 길거리 음식인 커리부어스트 레시피를 소개합니다.\n\n커리부어스트를 만드는 방법은 다음과 같습니다.\n* 잘게 썬 양파를 기름에 볶다가 카레, 케첩, 식초, 설탕을 넣어 소스를 만듭니다 [00:00:01].\n* 소세지를 데친 후 칼집을 내서 구워줍니다 [00:00:31].\n* 소세지 위에 소스를 뿌리고 감자튀김과 함께 제공합니다 [00:00:44].\n\n커리부어스트를 만드는 데 필요한 재료는 다음과 같습니다.\n* 양파 [00:00:01]\n* 카레 [00:00:17]\n* 케첩 [00:00:24]\n* 식초 [00:00:31]\n* 설탕 [00:00:31]\n* 소세지 [00:00:31]\n* 감자튀김 (선택 사항) [00:00:51]",
        ingredients: ["양파", "카레", "케첩", "식초", "설탕", "소세지", "감자튀김"]
    },
    {
        name: "마제소바",
        url: "https://www.youtube.com/shorts/YoU9hquQ22o",
        uploader: "",
        tip: "비벼 먹는 일본식 국수 요리. 다양한 토핑을 얹어 즐길 수 있습니다.",
        ingredients: ["라멘", "돼지고기", "양파", "파", "마늘", "생강", "간장", "미림", "깨", "참기름"]
    },
    {
        name: "스테이크 타르타르",
        url: "https://www.youtube.com/shorts/YIACyktyCY8",
        uploader: "",
        tip: "생고기를 얇게 썰어 만든 프랑스식 요리. 빵이나 크래커와 함께 즐깁니다.",
        ingredients: ["소고기 안심", "양파", "딜", "파슬리", "겨자", "레몬즙", "올리브 오일", "소금", "후추"]
    },
    {
        name: "라따뚜이",
        url: "https://www.youtube.com/shorts/uJZSviosysM",
        uploader: "",
        tip: "프랑스식 야채 스튜. 다양한 채소를 넣어 만들 수 있습니다.",
        ingredients: ["토마토", "가지", "애호박", "양파", "마늘", "올리브 오일", "소금", "후추", "허브"]
    },
    {
        name: "탄탄면",
        url: "https://www.youtube.com/watch?v=8RWnsvjxIRU",
        uploader: "",
        tip: "매콤한 맛이 특징인 일본식 라멘. 땅콩 소스와 고기 다짐육을 얹어 먹습니다.",
        ingredients: ["라면", "땅콩 소스", "고기 다짐육", "파", "숙주", "시금치", "깨", "참기름"]
    },
    {
        name: "라따뚜이",
        url: "https://www.youtube.com/watch?v=FdbU7-kSQ2A&t=16s",
        uploader: "강레오",
        tip: "프랑스식 야채 스튜. 다양한 채소를 넣어 만들 수 있습니다.",
        ingredients: ["토마토", "가지", "애호박", "양파", "마늘", "올리브 오일", "소금", "후추", "허브"]
    },
    {
        name: "오리고기 + 버섯",
        url: "https://www.youtube.com/watch?v=SqJx9EgG_kQ",
        uploader: "강레오",
        tip: "오리고기와 버섯의 조화로운 맛을 즐길 수 있는 요리. 버섯의 종류에 따라 다양한 맛을 즐길 수 있습니다.",
        ingredients: ["오리고기", "버섯", "양파", "마늘", "올리브 오일", "소금", "후추", "로즈마리"]
    },
    {
        name: "광어튀김",
        url: "https://www.youtube.com/watch?v=KzUTBj0kK0Q",
        uploader: "강레오",
        tip: "바삭하고 촉촉한 광어튀김. 튀김옷의 비율이 중요합니다.",
        ingredients: ["광어", "밀가루", "녹말", "달걀", "맥주", "소금", "후추"]
    },
    {
        name: "독돔구이 + 토마토 살사",
        url: "https://www.youtube.com/watch?v=pK6aVCb4X3c",
        uploader: "강레오",
        tip: "독특한 맛과 식감을 가진 독돔구이. 토마토 살사와 함께 즐기면 더욱 맛있습니다.",
        ingredients: ["독돔", "토마토", "양파", "마늘", "고추", "올리브 오일", "소금", "후추", "레몬즙"]
    },
    {
        name: "토마토 계란 부추 제육볶음",
        url: "https://www.youtube.com/watch?v=LOW4oXLYu64",
        uploader: "강레오",
        tip: "매콤하고 칼칼한 맛이 일품인 제육볶음. 밥과 함께 먹으면 더욱 맛있습니다.",
        ingredients: ["돼지고기", "양파", "대파", "부추", "고추장", "간장", "마늘", "설탕", "참기름"]
    },
    {
        name: "지중해식 생선구이",
        url: "https://www.youtube.com/watch?v=umLY_6nOuOE",
        uploader: "강레오",
        tip: "신선한 해산물과 다양한 채소를 곁들인 지중해식 생선구이. 건강하고 맛있는 식사입니다.",
        ingredients: ["연어", "새우", "오징어", "가지", "애호박", "양파", "마늘", "올리브 오일", "소금", "후추", "레몬즙"]
    },
    {
        name: "토마토 해장 라면",
        url: "https://www.youtube.com/watch?v=lIAye5iO7FY",
        uploader: "강레오",
        tip: "얼큰하고 시원한 맛이 일품인 토마토 해장 라면. 속풀이에 좋습니다.",
        ingredients: ["라면", "토마토", "콩나물", "파", "마늘", "고춧가루", "간장", "설탕"]
    },
    {
        name: "쌀 생선구이",
        url: "https://www.youtube.com/watch?v=haX9oH9ojEE",
        uploader: "",
        tip: "쌀가루를 묻혀 튀긴 생선구이. 바삭하고 고소한 맛이 일품입니다.",
        ingredients: ["생선", "쌀가루", "밀가루", "달걀", "소금", "후추"]
    },
    {
        name: "가자미 감바스",
        url: "https://www.youtube.com/watch?v=ZU246sO-uno",
        uploader: "",
        tip: "가자미와 새우를 곁들인 스페인식 요리. 올리브 오일과 마늘을 듬뿍 넣어 맛을 냅니다.",
        ingredients: ["가자미", "새우", "마늘", "올리브 오일", "소금", "후추", "레몬즙"]
    },
    {
        name: "꿀대구 마요",
        url: "https://www.youtube.com/watch?v=_ioVzN12z4A&t=429s",
        uploader: "맛수령",
        tip: "달콤하고 고소한 맛이 일품인 꿀대구 마요. 맥주와 함께 즐기면 더욱 좋습니다. 대구에 마요네즈와 꿀을 발라 구워 풍부한 맛을 냅니다.",
        ingredients: ["대구", "마요네즈", "꿀", "레몬즙", "파슬리", "소금", "후추"]
    },

    
    {
        name: "토마토 검정 파스타",
        url: "https://www.youtube.com/watch?v=qJN5cu-x-B4",
        uploader: "공격수셰프",
        tip: "검은색 면과 토마토소스의 조화가 독특한 파스타. 신선한 해산물을 곁들여 풍부한 맛을 냅니다.",
        ingredients: ["검은색 면", "토마토", "새우", "홍합", "마늘", "올리브 오일", "소금", "후추", "바질"]
    },
    {
        name: "토마토 김장",
        url: "https://www.youtube.com/watch?v=iaTscMN2FNE",
        uploader: "",
        tip: "토마토를 활용한 독특한 김치. 토마토의 상큼함과 김치의 매콤함이 조화롭게 어우러집니다.",
        ingredients: ["토마토", "배추", "양파", "마늘", "고춧가루", "액젓", "설탕", "소금"]
    },
    {
        name: "항정살",
        url: "https://www.youtube.com/shorts/X0ijVGo0v4Q",
        uploader: "밥김국",
        tip: "항정살의 쫄깃함과 고소함을 즐길 수 있는 요리. 다양한 방법으로 조리하여 즐길 수 있습니다.",
        ingredients: ["항정살", "소금", "후추", "허브"]
    },
    {
        name: "버터 파스타",
        url: "https://www.youtube.com/watch?v=iKaLAnPZGyM",
        uploader: "맛동무",
        tip: "버터의 풍미가 가득한 파스타. 간단하면서도 고급스러운 맛을 냅니다.",
        ingredients: ["파스타 면", "버터", "마늘", "파르미지아노 레지아노 치즈", "소금", "후추"]
    },
    {
        name: "돼지고기 스테이크",
        url: "https://www.youtube.com/watch?v=CVyniN--dDE",
        uploader: "강레오",
        tip: "돼지고기의 풍부한 맛을 즐길 수 있는 스테이크. 굽는 정도에 따라 다양한 맛과 식감을 즐길 수 있습니다.",
        ingredients: ["돼지고기 목살", "올리브 오일", "소금", "후추", "로즈마리", "타임", "마늘"]
    },
    {
        name: "전복 파스타",
        url: "https://www.youtube.com/watch?v=-AjoAl9SeWw",
        uploader: "",
        tip: "전복의 쫄깃함과 풍부한 해산물 맛을 즐길 수 있는 파스타. 특별한 날에 어울리는 고급스러운 요리입니다.",
        ingredients: ["파스타 면", "전복", "새우", "홍합", "마늘", "올리브 오일", "화이트 와인", "소금", "후추"]
    },
    {
        name: "클라우티 = 체리 디저트",
        url: "https://www.youtube.com/watch?v=7-NXoPYmO3c",
        uploader: "강레오",
        tip: "노오븐",
        ingredients: ["체리", "밀가루", "달걀", "우유", "설탕", "버터", "아몬드 슬라이스"]
    },
    {
        name: "에그베네딕트",
        url: "https://www.youtube.com/watch?v=3UKlryG_riE",
        uploader: "강레오",
        tip: "부드러운 수란과 잉글리시 머핀, 홀랜다이즈 소스의 조화가 일품인 브런치 메뉴입니다.",
        ingredients: ["잉글리시 머핀", "달걀", "베이컨", "시금치", "홀랜다이즈 소스"]
    },
    {
        name: "진짜사나이 후식",
        url: "https://www.youtube.com/watch?v=bujZkYFGzGU",
        uploader: "",
        tip: "우리나라 과자. 아이스크림 같은 걸로 다양한 디저트 가능. 세계적 경쟁력 있을지도!",
        ingredients: ["우리나라 과자", "아이스크림", "과일", "초콜릿"]
    },
    {
        name: "버터 & 푸딩 브레드",
        url: "https://www.youtube.com/watch?v=R2ysLQYxqt",
        uploader: "강레오",
        tip: "버터와 푸딩의 부드러운 조화가 일품인 빵. 따뜻하게 먹으면 더욱 맛있습니다.",
        ingredients: ["식빵", "버터", "푸딩", "달걀", "우유", "설탕", "시나몬 가루"]
    },
    {
        name: "연어사비체",
        url: "https://www.youtube.com/watch?v=Yk8QtDuFo9A",
        uploader: "맛수령",
        tip: "정말 쉬움",
        ingredients: ["연어", "양파", "고수", "라임 주스", "올리브 오일", "소금", "후추"]
    },
    {
        name: "병어세비체",
        url: "https://www.youtube.com/watch?v=uyGI3hLpzMc",
        uploader: "강레오",
        tip: "병어는 흰살이고 비린내 거의 없음",
        ingredients: ["병어", "양파", "고수", "라임 주스", "올리브 오일", "소금", "후추"]
    },
    {
        name: "연어 크리스피 스테이크",
        url: "https://www.youtube.com/watch?v=uMWIQXm-FpY",
        uploader: "공격수셰프",
        tip: "맛있어보임",
        ingredients: ["연어", "밀가루", "달걀", "빵가루", "올리브 오일", "소금", "후추", "소스"]
    },
    {
        name: "김치 파스타",
        url: "https://www.youtube.com/watch?v=6epy51dKxaQ",
        uploader: "공격수셰프",
        tip: "개맛있어보임. 대파에 하트모양 서비스 ><",
        ingredients: ["파스타 면", "김치", "돼지고기", "양파", "마늘", "고춧가루", "간장", "참기름"]
    },
    {
        name: "스페인 계란 오믈렛",
        url: "https://www.youtube.com/watch?v=xssPQ7fS7PI",
        uploader: "강레오",
        tip: "다양한 채소와 함께 즐기는 스페인식 계란 오믈렛. 푸짐하고 건강한 한 끼 식사입니다.",
        ingredients: ["달걀", "감자", "양파", "파프리카", "올리브 오일", "소금", "후추"]
    },
    {
        name: "토마토 부라타치즈 샐러드",
        url: "https://www.youtube.com/shorts/nCHzy54eGWs",
        uploader: "",
        tip: "신선한 토마토와 부드러운 부라타 치즈의 조화가 일품인 샐러드입니다.",
        ingredients: ["토마토", "부라타 치즈", "바질", "올리브 오일", "소금", "후추"]
    },
    {
        name: "키위 카르파치오",
        url: "https://www.youtube.com/shorts/ohDIcCXIteY",
        uploader: "공솊",
        tip: "개개개개개개쉬움 ㄷㄷ",
        ingredients: ["키위", "올리브 오일", "레몬즙", "소금", "후추", "루꼴라"]
    },
    {
        name: "세상에서 제일 쉬운 고급 연어콩피 요리",
        url: "https://www.youtube.com/watch?v=2S393ovRVrM",
        uploader: "강레오",
        tip: "맛있고 세상 간단하고 쉬운거같음",
        ingredients: ["연어", "올리브 오일", "허브", "소금", "후추"]
    },
    {
        name: "양 스테이크",
        url: "https://www.youtube.com/watch?v=L9vTdyl8CWI",
        uploader: "강레오",
        tip: "너무쉽고 맛있어보임..",
        ingredients: ["양고기", "올리브 오일", "로즈마리", "타임", "마늘", "소금", "후추"]
    },
    {
        name: "연어콩피 및 브런치",
        url: "https://www.youtube.com/watch?v=0N9-mpDBzxM",
        uploader: "",
        tip: "쉽고 개맛있어보임",
        ingredients: ["연어", "올리브 오일", "허브", "달걀", "빵", "채소"]
    },
    {
        name: "토마토김치고기스튜",
        url: "https://www.youtube.com/watch?v=jyfdFs_894c",
        uploader: "공격수셰프",
        tip: "쉽고 개맛도리로 보임..",
        ingredients: ["토마토", "김치", "돼지고기", "양파", "마늘", "고춧가루", "간장", "설탕"]
    },
    {
        name: "닭다리 스테이크",
        url: "https://www.youtube.com/watch?v=P1ID52sPl_c",
        uploader: "맛수령",
        tip: "개쉽고 맛있어보임",
        ingredients: ["닭다리", "올리브 오일", "소금", "후추", "허브"]
    },
    {
        name: "홀캔토마토 파스타 강의",
        url: "https://youtube.com/watch?v=FnOxV_6EXgs",
        uploader: "맛수령",
        tip: "홀캔 토마토를 활용한 파스타 레시피 강의 영상입니다.",
        ingredients: ["홀캔 토마토", "파스타 면", "마늘", "올리브 오일", "소금", "후추"]
    },
    {
        name: "연어섞은밥",
        url: "https://www.youtube.com/watch?v=U2PyiSXAlrs",
        uploader: "최강록",
        tip: "개개개개쉬움",
        ingredients: ["연어", "밥", "간장", "참기름", "김"]
    },
    {
        name: "배추스테이크",
        url: "https://www.youtube.com/watch?v=MnC46BncM18",
        uploader: "셰프호윤",
        tip: "졸라 맛있고 간단하고 몸에 좋아보이고 고급스러워보임",
        ingredients: ["배추", "버터", "마늘", "올리브 오일", "소금", "후추", "치즈"]
    },
    {
        name: "크림랍스터",
        url: "https://www.youtube.com/shorts/IVPbxQHr9zc",
        uploader: "공격수셰프",
        tip: "고급스러운 랍스터 요리를 크림 소스와 함께 즐길 수 있습니다.",
        ingredients: ["랍스터", "생크림", "마늘", "양파", "화이트 와인", "파슬리"]
    },
    {
        name: "크림고기양송이버섯스튜",
        url: "https://www.youtube.com/watch?v=FjArRPBN7iQ&t=10s",
        uploader: "강레오",
        tip: "부드러운 크림 소스와 고기, 버섯의 풍미가 어우러진 스튜입니다.",
        ingredients: ["소고기", "양송이버섯", "양파", "마늘", "생크림", "화이트 와인", "파슬리"]
    },
    {
        name: "버섯루꼴라양파고기샐러드",
        url: "https://www.youtube.com/watch?v=SqJx9EgG_kQ&t=46s",
        uploader: "강레오",
        tip: "다양한 버섯과 루꼴라, 양파, 고기를 함께 즐길 수 있는 샐러드입니다.",
        ingredients: ["소고기", "버섯", "루꼴라", "양파", "올리브 오일", "발사믹 식초"]
    },
    {
        name: "시금치파스타",
        url: "https://www.youtube.com/shorts/zNfd-IOzulU",
        uploader: "",
        tip: "시금치의 신선함과 파스타의 조화가 일품인 요리입니다.",
        ingredients: ["파스타 면", "시금치", "마늘", "올리브 오일", "파르미지아노 레지아노 치즈"]
    },
    {
        name: "시금치토마토양파그릭요거트피자",
        url: "https://youtube.com/shorts/rN1N-Fj3n9Y",
        uploader: "",
        tip: "건강한 재료를 활용한 특별한 피자 레시피입니다.",
        ingredients: ["또띠아", "시금치", "토마토", "양파", "그릭 요거트", "치즈"]
    },
    {
        name: "봉골레 수제비 & 마라크림새우",
        url: "https://www.youtube.com/watch?v=NS8Gk8P-nAM",
        "uploader": "",
        tip: "레시피가 조올라 쉽고 맛있어보임 최고의 요리사는 자연이다. 우리는 그저 재배치할 뿐. 익숙함을 특별하게 만드는 거.",
        ingredients: ["수제비", "바지락", "새우", "마늘", "올리브 오일", "마라 소스", "생크림"]
    },
    {
        name: "미국인의 일본식 라멘",
        url: "https://www.youtube.com/watch?v=0O03sStIUVk&list=LL&index=1",
        uploader: "",
        tip: "ㅈㄴ쉽고 맛있어보임",
        ingredients: ["재료 정보가 없습니다."]
    },
    {
        name: "과일 칵테일",
        url: "https://www.youtube.com/shorts/6O6jBeucKko",
        uploader: "어쿠스틱 드링크",
        tip: "다양한 과일을 활용한 상큼한 칵테일 레시피입니다.",
        ingredients: ["과일", "탄산수", "술"]
    }
  ];
  export default menuData;
