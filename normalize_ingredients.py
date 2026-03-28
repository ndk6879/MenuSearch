"""
일회성 스크립트: menuData_kr.js의 재료를 synonymMap 기준으로만 정규화
(parentMap 항목은 건드리지 않음 — 삼겹살, 닭가슴살 등은 그대로 유지)
"""
import os
import json

# ── 동의어만 (표기 통일) ──
SYNONYM_MAP = {
    "올리브오일": "올리브 오일",
    "엑스트라 버진 올리브오일": "올리브 오일",
    "콩피오일": "올리브 오일",
    "콩피 오일": "올리브 오일",

    "그린올리브": "올리브",
    "그린 올리브": "올리브",
    "블랙올리브": "올리브",

    "고추가루": "고춧가루",
    "청양고춧가루": "고춧가루",
    "고운고추가루": "고춧가루",
    "굵은 고추가루": "고춧가루",
    "고운고춧가루": "고춧가루",

    "감동란": "계란",
    "감 동란": "계란",
    "계란 노른자": "계란",
    "반숙란": "계란",

    "계피가루": "계피",
    "계피스틱": "계피",

    "배추 김치": "김치",
    "배추김치": "김치",
    "신김치": "김치",

    "무염 버터": "버터",
    "무염버터": "버터",
    "기버터": "버터",

    "갈아만든배": "배",

    "와사비잎": "와사비",
    "와사비플라워": "와사비",

    "전복내장": "전복",

    "대파 녹색부분": "대파",
    "대파 흰부분": "대파",

    "양파분말": "양파",

    "파마산 치즈 가루": "파마산 치즈",
    "파마산치즈": "파마산 치즈",

    "빨간 파프리카": "파프리카",
    "노란 파프리카": "파프리카",
    "미니 파프리카": "파프리카",

    "방울 토마토": "방울토마토",
    "컬러방울토마토": "방울토마토",
    "선드라이 토마토": "선드라이토마토",
    "썬드라이 토마토": "선드라이토마토",

    "이탈리안 파슬리": "파슬리",

    "사과식초": "식초",
    "두배 사과식초": "식초",
    "쉐리식초": "식초",
    "발사믹식초": "발사믹 식초",
    "화이트 발사믹 식초": "화이트 발사믹",
    "화이트 발사믹식초": "화이트 발사믹",
    "화이트발사믹식초": "화이트 발사믹",
    "화이트발사믹": "화이트 발사믹",
    "화이트 발사믹 글레이즈": "화이트 발사믹",
    "화이트와인 비니거": "화이트 발사믹",

    "양송이버섯": "양송이 버섯",
    "양송이": "양송이 버섯",

    "랍스터 테일": "랍스터",

    "무우": "무",

    "애플망고": "애플 망고",

    "물만두": "만두",
    "왕새우 만두": "만두",
    "냉동만두": "만두",

    "라임 주스": "라임",
    "라임주스": "라임",
    "라임제스트": "라임",

    "마늘분말": "마늘",
    "흑마늘": "마늘",

    "노르웨이 생연어": "연어",

    "바질잎": "바질",

    "맛소금": "소금",

    "맛간장": "간장",
    "양조간장": "간장",
    "진간장": "간장",
    "국간장": "간장",
    "백간장": "간장",

    "백미": "밥",
    "즉석밥": "밥",
    "통곡물밥": "밥",

    "부라타치즈": "부라타 치즈",
    "블루치즈": "블루 치즈",
    "페타치즈": "페타 치즈",

    "꽃게 코인육수": "코인 육수",
    "디포리 코인육수": "코인 육수",
    "사골 코인육수": "코인 육수",
    "채소 코인육수": "코인 육수",
    "채소육수코인": "코인 육수",
    "사골코인육수": "코인 육수",
    "코인육수사골": "코인 육수",
    "코인육수": "코인 육수",

    "새송이버섯": "새송이 버섯",
    "느타리버섯": "느타리 버섯",
    "팽이버섯": "팽이 버섯",
    "포르치니버섯": "포르치니 버섯",
    "표고버섯": "표고 버섯",

    "베이비당근": "당근",

    "생강가루": "생강",

    "알루로스": "알룰로스",

    "비건 마요네즈": "마요네즈",

    "액상 치킨스톡": "치킨스톡",
    "치킨스톡파우더": "치킨스톡",
    "치킨 육수": "치킨스톡",
    "치킨육수": "치킨스톡",

    "깨소금": "깨",
    "볶은깨": "깨",
    "볶음깨": "깨",

    "아보카도 퓨레": "아보카도",
    "아보카도퓨레": "아보카도",

    "통식빵": "식빵",
    "버거번": "빵",

    "청포도": "포도",

    "민트잎": "민트",

    "명란젓": "명란",

    "통후추": "후추",
    "후추 가루": "후추",
    "후추가루": "후추",
    "후춧가루": "후추",

    "트러플 스프레이": "트러플",
    "트러플 페이스트": "트러플",
    "트러플오일": "트러플",

    "후리가게": "후리카케",
    "후리카게": "후리카케",
    "후리가케": "후리카케",

    "화이트와인": "화이트 와인",

    "페퍼론치노": "페페론치노",
    "페퍼로치니": "페페론치노",
    "페퍼크러쉬": "페페론치노",
    "페페론치니": "페페론치노",
    "크러쉬페퍼": "페페론치노",
    "크러쉬드 페퍼": "페페론치노",
    "페퍼로치노": "페페론치노",

    "스파게티면": "파스타",

    "우스터소스": "굴소스",

    "포도씨유": "식용유",
    "아보카도 오일": "식용유",
    "아보카도오일": "식용유",

    "바질페스토": "바질 페스토",

    "로제 토마토 소스": "토마토소스",
}

FILE_PATH = "src/menuData_kr.js"


def read_menu_data(path):
    import subprocess
    abs_path = os.path.abspath(path)
    node_script = f"""
    const fs = require('fs');
    let text = fs.readFileSync('{abs_path}', 'utf-8');
    text = text.replace(/export\\s+default\\s+\\w+;?/g, '');
    text = text.replace(/const\\s+\\w+\\s*=\\s*/, '');
    const data = eval(text);
    process.stdout.write(JSON.stringify(data));
    """
    result = subprocess.run(
        ["node", "-e", node_script],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        raise RuntimeError(f"Node parse error: {result.stderr}")
    return json.loads(result.stdout)


def normalize(ingredients):
    # 1단계: 각 재료를 개별 변환 (위치 유지)
    converted = [SYNONYM_MAP.get(ing, ing) for ing in ingredients]
    # 2단계: 중복 제거 (순서 유지, 첫 등장만 남김)
    seen = set()
    result = []
    for ing in converted:
        if ing not in seen:
            seen.add(ing)
            result.append(ing)
    return result


def write_menu_data(path, data):
    lines = ["const menuData_kr = [  "]
    for i, item in enumerate(data):
        lines.append(json.dumps(item, ensure_ascii=False, indent=2) + ",")
        if i < len(data) - 1:
            lines.append("")
    lines.append("];")
    lines.append("")
    lines.append("export default menuData_kr;")
    lines.append("")

    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))


def main():
    data = read_menu_data(FILE_PATH)
    total_changes = 0
    recipes_changed = 0

    for item in data:
        old_ings = item.get("ingredients", [])
        new_ings = normalize(old_ings)
        changed = old_ings != new_ings
        if changed:
            recipes_changed += 1
            diffs = [(a, b) for a, b in zip(old_ings, new_ings) if a != b]
            total_changes += len(diffs)
            if len(new_ings) < len(old_ings):
                total_changes += len(old_ings) - len(new_ings)
            print(f"  {item.get('name', '?')}: {[f'{a}→{b}' for a, b in diffs]}")
        item["ingredients"] = new_ings

    print(f"\n{recipes_changed} recipes changed, {total_changes} ingredient renames")
    write_menu_data(FILE_PATH, data)
    print(f"Saved to {FILE_PATH}")


if __name__ == "__main__":
    main()
