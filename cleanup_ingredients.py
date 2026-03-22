"""
cleanup_ingredients.py
menuData_kr.js 재료 데이터 정리
- 영어 재료명 → 한국어
- 동의어 통일
- 띄어쓰기 통일
- 괄호/설명 제거
- 브랜드명(연두, 다시다)은 유지
"""

import re
import shutil
from datetime import datetime

SRC = "src/menuData_kr.js"
BACKUP = f"src/menuData_kr.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.js"

# ──────────────────────────────────────────────
# 1. 정규화 규칙 (긴 것 먼저)
# ──────────────────────────────────────────────
SYNONYM_MAP = {
    # 영어 → 한국어
    "Cheongyang Chili Pepper": "청양고추",
    "Perilla Leaf Seasoning": "깻잎 양념",
    "Liquid chicken Stock": "닭 육수",
    "Sichuan peppercorns": "사천 후추",
    "Dark Soy Sauce": "간장",
    "Oyster sauce": "굴 소스",
    "Sesame Seeds": "깨",
    "Sesame Oil": "참기름",
    "Sesame oil": "참기름",
    "Cooking Oil": "식용유",
    "Cooking oil": "식용유",
    "Canned Tuna": "참치",
    "Cherry Tomato": "방울토마토",
    "Green onions": "대파",
    "Chili oil": "고추기름",
    "Cooked Rice": "밥",
    "Ground pork": "돼지 다짐육",
    "Doubanjiang": "두반장",
    "Potato starch": "전분",
    "Fregola 파스타": "프레골라 파스타",
    "Black Pepper": "후추",
    "Fond de veau": "퐁드보",
    "Cime di rapa": "치메 디 라파",
    "Allulose": "알룰로스",
    "Orecchiette": "오레끼에떼",
    "Bucatini": "부카티니",
    "Mayonnaise": "마요네즈",
    "Kumquat": "금귤",
    "Cod milt": "명란",
    "Soy Sauce": "간장",
    "Garlic": "마늘",
    "Ginger": "생강",
    "Salmon": "연어",
    "Sugar": "설탕",
    "Water": "물",
    "Salt": "소금",
    "Tofu": "두부",
    "Sake": "청주",
    "Roe": "알",

    # 계란/달걀 통일 → 계란
    "달걀 노른자": "계란 노른자",
    "달걀 흰자": "계란 흰자",
    "삶은 달걀": "삶은 계란",
    "달걀": "계란",

    # 마늘 변형 통일
    "깐마늘": "마늘",
    "간마늘": "마늘",
    "통 마늘": "마늘",
    "통마늘": "마늘",
    "마늘쫑": "마늘종",

    # 오일 변형 통일
    "엑스트라 버진 올리브 오일": "올리브 오일",
    "퓨어 올리브 오일": "올리브 오일",
    "올리타리아 프리엔 오일": "올리브 오일",
    "식물성 오일": "식용유",
    "식물성 기름": "식용유",

    # 치즈 통일
    "파르미지아노 치즈": "파마산 치즈",
    "파르메산 치즈": "파마산 치즈",
    "파르메산": "파마산 치즈",
    "모차렐라 치즈": "모짜렐라 치즈",
    "마스카포네 치즈": "마스카르포네 치즈",
    "그라노파다노 치즈": "그라나 파다노 치즈",
    "아그리폼 그라나 파다노 치즈": "그라나 파다노 치즈",
    "레지아노치즈": "레지아노 치즈",

    # 띄어쓰기 통일
    "굴소스": "굴 소스",
    "토마토소스": "토마토 소스",
    "마라소스": "마라 소스",
    "팽이버섯": "팽이 버섯",
    "조개다시다": "조개 다시다",
    "LA갈비": "LA 갈비",

    # 미원 → MSG
    "미원": "MSG",

    # 오타/표기 통일
    "랍스타": "랍스터",
    "살롯": "샬롯",
    "래디시": "래디쉬",
    "레디시": "래디쉬",
    "사프론": "사프란",
    "샤프론": "사프란",
    "탈리아탈레": "탈리아텔레",
    "딸리아딸레": "탈리아텔레",
    "아라비아따 토마토 소스": "아라비아타 토마토 소스",

    # 쌀밥 → 밥
    "쌀밥": "밥",

    # 소금 변형 통일
    "고운 소금": "소금",
    "굵은 소금": "소금",
    "꽃소금": "소금",

    # 설탕 변형
    "고운 설탕": "설탕",

    # 케첩 통일
    "토마토 케찹": "케첩",
    "토마토케찹": "케첩",
    "토마토 케첩": "케첩",

    # 식초 통일
    "발사믹 비네거": "발사믹 식초",
    "발사믹 비니거": "발사믹 식초",
    "레드 와인 비네거": "레드 와인 식초",
    "사과식초": "사과 식초",
    "와인식초": "와인 식초",

    # 고기 다짐육 통일
    "돼지고기 다짐육": "돼지 다짐육",
    "돼지고기 목살": "목살",
    "돼지 목살": "목살",
    "간 소고기": "소고기 다짐육",
    "다진소고기": "소고기 다짐육",
    "다진 소고기": "소고기 다짐육",

    # 치즈 추가
    "슈레드 모짜렐라": "모짜렐라 치즈",
    "파다노": "그라나 파다노 치즈",
    "그라노파다노": "그라나 파다노 치즈",

    # 깨 통일
    "검은 깨": "검정깨",
    "검정 깨": "검정깨",

    # 버섯/콩/채소 띄어쓰기
    "만가닥버섯": "만가닥 버섯",
    "옥수수콘": "옥수수 콘",
    "그린빈": "그린 빈",
    "궁채장아찌": "궁채 장아찌",

    # 전분 통일
    "전분 가루": "전분",
    "옥수수 전분 가루": "전분",
    "옥수수전분": "전분",
}

# ──────────────────────────────────────────────
# 2. 괄호/슬래시 설명 제거
# ──────────────────────────────────────────────
BRACKET_OVERRIDES = {
    "관찰레 (또는 판체타, 베이컨)": "관찰레",
    "치즈 (꽁떼/에멘탈/고다)": "치즈",
    "허브(타임)": "타임",
    "연두 코인육수(한우맛)": "연두 코인육수",
    "비셀리 (완두콩)": "완두콩",
    "나랏미 (흑갱)": "흑미",
    "리코타 크림치즈": "리코타 치즈",
}

def normalize(ing):
    ing = ing.strip()
    if ing in BRACKET_OVERRIDES:
        return BRACKET_OVERRIDES[ing]
    if ing in SYNONYM_MAP:
        return SYNONYM_MAP[ing]
    # 처리 안 된 괄호 제거
    ing = re.sub(r'\s*[\(（][^)）]*[\)）]', '', ing).strip()
    return ing

# ──────────────────────────────────────────────
# 3. 실행
# ──────────────────────────────────────────────
shutil.copy(SRC, BACKUP)
print(f"✅ 백업: {BACKUP}")

with open(SRC, encoding="utf-8") as f:
    content = f.read()

change_log = {}

def replace_ingredient(m):
    original = m.group(1)
    normalized = normalize(original)
    if normalized != original:
        change_log[original] = normalized
    return f'"{normalized}"'

def process_ingredients_block(m):
    block = m.group(0)
    return re.sub(r'"([^"]+)"', replace_ingredient, block)

new_content = re.sub(
    r'"ingredients":\s*\[.*?\]',
    process_ingredients_block,
    content,
    flags=re.DOTALL
)

with open(SRC, "w", encoding="utf-8") as f:
    f.write(new_content)

print(f"\n📝 고유 변경 종류: {len(change_log)}개\n")
for orig, new in sorted(change_log.items()):
    print(f"  '{orig}' → '{new}'")
print(f"\n✅ 완료 → {SRC}")
