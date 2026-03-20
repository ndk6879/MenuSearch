# api_server.py
import os
from dotenv import load_dotenv
load_dotenv()

from flask import Flask, request, jsonify
from flask_cors import CORS
from youtube_automation import (
    analyze_one_video,
    append_to_js,
    remove_from_js,
    initialize_js_file_if_needed,
    finalize_js_file,
    get_existing_urls,
)
from youtube_fetch import resolve_channel_id, get_video_list

app = Flask(__name__)

# ──────────────────────────────────────────────
# 재료 정규화 (저장 시 자동 정리)
# ──────────────────────────────────────────────
import re as _re

_SYNONYM_MAP = {
    # 오일류
    "올리브유": "올리브 오일", "올리브오일": "올리브 오일", "엑스트라버진 올리브오일": "올리브 오일",
    "엑스트라버진 올리브유": "올리브 오일", "참기름": "참기름", "들기름": "들기름",
    "식용유": "식용유", "포도씨유": "포도씨유", "카놀라유": "카놀라유",
    # 간장류
    "진간장": "간장", "국간장": "국간장", "양조간장": "간장", "조선간장": "국간장",
    # 식초류
    "발사믹식초": "발사믹 식초", "화이트발사믹": "화이트 발사믹",
    # 술류
    "청주": "청주", "미림": "미림", "미린": "미림", "맛술": "미림",
    # 가루류
    "밀가루": "밀가루", "중력분": "밀가루", "박력분": "박력분", "강력분": "강력분",
    "전분": "전분", "감자전분": "전분", "옥수수전분": "전분", "녹말가루": "전분",
    "빵가루": "빵가루",
    # 설탕/당류
    "백설탕": "설탕", "흑설탕": "흑설탕", "황설탕": "설탕", "물엿": "물엿",
    "꿀": "꿀", "올리고당": "올리고당",
    # 소금류
    "꽃소금": "소금", "천일염": "소금", "맛소금": "소금", "굵은소금": "굵은소금",
    # 버터/크림
    "무염버터": "버터", "유염버터": "버터", "발효버터": "버터",
    "생크림": "생크림", "휘핑크림": "생크림", "헤비크림": "생크림",
    # 치즈류
    "파마산치즈": "파마산 치즈", "파르메산치즈": "파마산 치즈", "파르미지아노": "파마산 치즈",
    "모짜렐라치즈": "모짜렐라 치즈", "모차렐라치즈": "모짜렐라 치즈", "모차렐라": "모짜렐라 치즈",
    "크림치즈": "크림 치즈",
    # 육류
    "삼겹살": "삼겹살", "국내산 삼겹살": "삼겹살", "목살": "목살",
    "닭가슴살": "닭가슴살", "닭 가슴살": "닭가슴살",
    "소고기": "소고기", "한우": "소고기",
    # 해산물
    "새우살": "새우", "냉동새우": "새우", "칵테일새우": "새우",
    "연어": "연어", "껍질 있는 연어": "연어", "껍질 없는 연어": "연어",
    "껍질있는연어": "연어", "껍질없는연어": "연어",
    "오징어": "오징어", "냉동오징어": "오징어",
    "참치": "참치", "참치캔": "참치캔",
    "바지락": "바지락", "바지락살": "바지락",
    # 채소류
    "대파": "대파", "쪽파": "쪽파", "실파": "쪽파",
    "양파": "양파", "적양파": "적양파", "자색양파": "적양파",
    "마늘": "마늘", "다진마늘": "다진 마늘", "편마늘": "마늘",
    "생강": "생강", "다진생강": "생강",
    "고추": "고추", "청양고추": "청양고추", "홍고추": "홍고추", "풋고추": "풋고추",
    "방울토마토": "방울토마토", "체리토마토": "방울토마토",
    "호박": "호박", "애호박": "애호박", "단호박": "단호박", "주키니호박": "애호박",
    "감자": "감자", "고구마": "고구마",
    "당근": "당근", "브로콜리": "브로콜리", "양배추": "양배추",
    "상추": "상추", "깻잎": "깻잎", "시금치": "시금치", "부추": "부추",
    # 버섯류
    "새송이버섯": "새송이버섯", "느타리버섯": "느타리버섯",
    "팽이버섯": "팽이버섯", "표고버섯": "표고버섯", "양송이버섯": "양송이버섯",
    # 소스/페이스트
    "고추장": "고추장", "된장": "된장", "쌈장": "쌈장",
    "고춧가루": "고춧가루", "후추": "후추", "후춧가루": "후추",
    "굴소스": "굴소스", "두반장": "두반장", "춘장": "춘장",
    "토마토소스": "토마토소스", "케찹": "케첩", "케챱": "케첩",
    "마요네즈": "마요네즈", "머스타드": "머스타드",
    "스리라차": "스리라차 소스", "스리라차소스": "스리라차 소스",
    # 유제품
    "우유": "우유", "두유": "두유", "플레인요거트": "플레인 요거트", "그릭요거트": "그릭 요거트",
    # 계란
    "계란": "달걀", "달걀": "달걀", "메추리알": "메추리알",
    # 두부/콩
    "두부": "두부", "순두부": "순두부", "연두부": "연두부",
    # 면/곡물
    "소면": "소면", "중면": "중면", "우동면": "우동면",
    "스파게티면": "스파게티", "파스타면": "파스타",
    # 통조림/가공
    "참치캔": "참치캔", "콘": "옥수수", "스위트콘": "옥수수",
    # 향신료
    "월계수잎": "월계수잎", "로즈마리": "로즈마리", "타임": "타임",
    "바질": "바질", "파슬리": "파슬리", "오레가노": "오레가노",
    "커민": "커민", "파프리카가루": "파프리카 가루",
}

_ORIGIN_PREFIXES = (
    "국내산", "미국산", "호주산", "캐나다산", "스페인산",
    "독일산", "칠레산", "노르웨이산", "프랑스산", "이탈리아산",
    "뉴질랜드산", "중국산",
)
_QTY_SUFFIX = _re.compile(
    r'\s*\d+([./]\d+)?\s*(g|ml|kg|L|l|개|장|큰술|작은술|컵|스푼|tsp|tbsp|T)\s*$'
)
_NOISY_VERBS = ("볶", "끓", "넣", "섞", "뿌", "썰", "다져", "으깨", "절여", "재워")


def _auto_normalize(ing: str) -> str:
    s = ing.strip()
    for prefix in _ORIGIN_PREFIXES:
        if s.startswith(prefix + " ") or s.startswith(prefix + "\u00a0"):
            s = s[len(prefix):].strip()
            break
    s = _QTY_SUFFIX.sub("", s).strip()
    return s


def _normalize_ing(ing: str) -> str:
    auto = _auto_normalize(ing)
    return _SYNONYM_MAP.get(auto) or _SYNONYM_MAP.get(ing) or auto


def _is_noisy(ing: str) -> bool:
    if len(ing) > 25:
        return True
    if "." in ing or "," in ing:
        return True
    return any(v in ing for v in _NOISY_VERBS)


def _clean_ingredients(ingredients: list) -> list:
    seen = set()
    result = []
    for ing in ingredients:
        if not ing or not isinstance(ing, str):
            continue
        if _is_noisy(ing):
            continue
        normalized = _normalize_ing(ing.strip())
        if normalized and normalized not in seen:
            seen.add(normalized)
            result.append(normalized)
    return result


# 프론트 로컬 CORS 허용
CORS(app, resources={
    r"/*": {"origins": ["http://localhost:3000", "http://127.0.0.1:3000"]}
})

# ✅ 절대경로 기반으로 menuData_kr.js 지정
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SAVE_PATH = os.path.join(BASE_DIR, "src", "menuData_kr.js")


# ✅ 결과만 반환 (저장 X)
@app.post("/analyze")
def analyze():
    url = (request.get_json() or {}).get("url", "").strip()
    if not url:
        return jsonify({"ok": False, "error": "url이 비어 있습니다."}), 400

    out = analyze_one_video(url)
    # out 구조: {"ok": bool, "result": {...}} 또는 {"ok": False, "error": "..."}
    return jsonify(out), (200 if out.get("ok") else 400)


# ✅ 결과 + menuData_kr.js 저장
@app.post("/analyze-save")
def analyze_and_save():
    url = (request.get_json() or {}).get("url", "").strip()
    if not url:
        return jsonify({"ok": False, "error": "url이 비어 있습니다.", "saved": False, "save_path": SAVE_PATH}), 400

    out = analyze_one_video(url)

    # 분석 실패 시
    if not out.get("ok"):
        return jsonify({
            **out,
            "saved": False,
            "save_path": SAVE_PATH
        }), 400

    r = out["result"]  # name / ingredients / steps / source / uploader / upload_date / video_url

    # 1️⃣ 스킵 규칙 (프로모션/분석불가는 저장 안 함)
    if (r.get("name") in ["분석 불가", "Only 제품 설명 OR 홍보"]) or \
       ("Only 제품 설명 OR 홍보" in (r.get("ingredients") or [])):
        return jsonify({
            "ok": True,
            "saved": False,
            "reason": "promo_or_unparsable",
            "result": r,
            "save_path": SAVE_PATH
        }), 200

    # 2️⃣ 파일 준비 + 중복 체크
    os.makedirs(os.path.join(BASE_DIR, "src"), exist_ok=True)
    initialize_js_file_if_needed(SAVE_PATH)

    existing = get_existing_urls(SAVE_PATH)
    if r["video_url"] in existing:
        return jsonify({
            "ok": True,
            "saved": False,
            "reason": "duplicate",
            "result": r,
            "save_path": SAVE_PATH
        }), 200

    # 3️⃣ 저장 시도 (✅ steps까지 함께 저장)
    try:
        append_to_js(
            {
                "메뉴": r["name"],
                "재료": _clean_ingredients(r["ingredients"]),
                "순서": r.get("steps", []),   # ← 추가: 요리 순서 저장
                "출처": r["source"]
            },
            r["video_url"],
            r["uploader"],
            r["upload_date"],
            file_path=SAVE_PATH
        )
        finalize_js_file(SAVE_PATH)

        return jsonify({
            "ok": True,
            "saved": True,
            "result": r,
            "save_path": SAVE_PATH
        }), 200

    except Exception as e:
        return jsonify({
            "ok": True,
            "saved": False,
            "reason": f"write_failed: {e}",
            "result": r,
            "save_path": SAVE_PATH
        }), 500


# ✅ 채널 영상 목록 가져오기
@app.post("/channel-videos")
def channel_videos():
    data = request.get_json() or {}
    channel_url = data.get("channel_url", "").strip()
    max_results = min(int(data.get("max_results", 10)), 500)
    start_index = max(1, int(data.get("start_index", 1)))

    if not channel_url:
        return jsonify({"ok": False, "error": "channel_url이 비어 있습니다."}), 400

    api_key = os.getenv("YOUTUBE_API_KEY")
    if not api_key:
        return jsonify({"ok": False, "error": "YOUTUBE_API_KEY가 설정되지 않았습니다."}), 500

    try:
        channel_id = resolve_channel_id(api_key, channel_url)
    except ValueError as e:
        return jsonify({"ok": False, "error": str(e)}), 400

    try:
        videos = get_video_list(api_key, channel_id, max_results=start_index + max_results - 1)
        videos = videos[start_index - 1:][:max_results]
        return jsonify({
            "ok": True,
            "videos": [
                {
                    "video_id": v["video_id"],
                    "url": v["url"],
                    "title": v["title"],
                    "duration": v["duration"],
                    "published_at": v["published_at"],
                }
                for v in videos
            ]
        }), 200
    except Exception as e:
        return jsonify({"ok": False, "error": f"영상 목록 가져오기 실패: {e}"}), 500


# ✅ 저장된 URL 목록 조회
@app.get("/existing-urls")
def existing_urls():
    initialize_js_file_if_needed(SAVE_PATH)
    urls = list(get_existing_urls(SAVE_PATH))
    return jsonify({"ok": True, "urls": urls}), 200


# ✅ 개별 레시피 저장 (overwrite 옵션 지원)
@app.post("/save-recipe")
def save_recipe():
    data = request.get_json() or {}
    r = data.get("result")
    overwrite = data.get("overwrite", False)
    if not r:
        return jsonify({"ok": False, "error": "result가 비어 있습니다."}), 400

    os.makedirs(os.path.join(BASE_DIR, "src"), exist_ok=True)
    initialize_js_file_if_needed(SAVE_PATH)

    existing = get_existing_urls(SAVE_PATH)
    is_duplicate = r.get("video_url") in existing

    if is_duplicate and not overwrite:
        return jsonify({"ok": True, "saved": False, "reason": "duplicate"}), 200

    try:
        # 덮어쓰기: 기존 항목 삭제 후 새로 추가
        if is_duplicate and overwrite:
            remove_from_js(r["video_url"], file_path=SAVE_PATH)

        append_to_js(
            {
                "메뉴": r["name"],
                "재료": _clean_ingredients(r["ingredients"]),
                "순서": r.get("steps", []),
                "출처": r.get("source", "unknown"),
            },
            r["video_url"],
            r.get("uploader", ""),
            r.get("upload_date", ""),
            file_path=SAVE_PATH,
        )
        finalize_js_file(SAVE_PATH)
        return jsonify({"ok": True, "saved": True, "overwritten": is_duplicate}), 200
    except Exception as e:
        return jsonify({"ok": False, "saved": False, "error": f"저장 실패: {e}"}), 500


# ✅ 저장된 레시피 삭제
@app.post("/delete-recipe")
def delete_recipe():
    data = request.get_json() or {}
    video_url = data.get("video_url", "").strip()
    if not video_url:
        return jsonify({"ok": False, "error": "video_url이 비어 있습니다."}), 400

    try:
        initialize_js_file_if_needed(SAVE_PATH)
        existing = get_existing_urls(SAVE_PATH)
        if video_url not in existing:
            return jsonify({"ok": True, "deleted": False, "reason": "not_found"}), 200

        remove_from_js(video_url, file_path=SAVE_PATH)
        finalize_js_file(SAVE_PATH)
        return jsonify({"ok": True, "deleted": True}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": f"삭제 실패: {e}"}), 500


# ──────────────────────────────────────────────
# AI 셰프: /api/chat  (Vercel AI Data Stream Protocol)
# ──────────────────────────────────────────────
import json as _json
import uuid as _uuid
from groq import Groq as _Groq

_CHEF_SYSTEM = """당신은 친근하고 유능한 한국어 요리 비서 'AI 셰프'입니다.

규칙:
- 항상 한국어로 답변하세요.
- 메뉴 추천이나 레시피 관련 질문에는 반드시 searchMenuData를 먼저 호출하세요.
- searchMenuData 결과가 있으면: 결과의 name, ingredients, url, uploader를 절대 수정하지 말고 그대로 showMenuCards에 전달하세요.
- searchMenuData 결과가 없으면: showMenuCards를 절대 사용하지 말고, 우리 데이터베이스에 해당 레시피가 없다고 텍스트로만 안내하세요.
- 재료 목록을 보여줄 때는 showIngredientChecklist를 사용하세요.
- 요리 순서를 설명할 때는 showRecipeSteps를 사용하세요.
- 도구 사용 시 짧은 안내 문구만 텍스트로 보내세요.
- 친근하고 실용적인 톤으로 대화하세요."""

_CHEF_TOOLS = [
    {
        "name": "showMenuCards",
        "description": "추천 메뉴 카드들을 화면에 렌더링합니다.",
        "input_schema": {
            "type": "object",
            "required": ["recipes"],
            "properties": {
                "recipes": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "required": ["name", "ingredients"],
                        "properties": {
                            "name": {"type": "string"},
                            "ingredients": {"type": "array", "items": {"type": "string"}},
                            "url": {"type": "string"},
                            "uploader": {"type": "string"}
                        }
                    }
                }
            }
        }
    },
    {
        "name": "showIngredientChecklist",
        "description": "특정 요리에 필요한 재료 체크리스트를 화면에 렌더링합니다.",
        "input_schema": {
            "type": "object",
            "required": ["recipeName", "ingredients"],
            "properties": {
                "recipeName": {"type": "string"},
                "ingredients": {"type": "array", "items": {"type": "string"}}
            }
        }
    },
    {
        "name": "showRecipeSteps",
        "description": "요리 순서를 단계별 카드로 화면에 렌더링합니다.",
        "input_schema": {
            "type": "object",
            "required": ["recipeName", "steps"],
            "properties": {
                "recipeName": {"type": "string"},
                "steps": {"type": "array", "items": {"type": "string"}}
            }
        }
    }
]

# searchMenuData: 서버에서 실행하는 도구 (클라이언트 렌더링 X)
_SEARCH_TOOL = {
    "type": "function",
    "function": {
        "name": "searchMenuData",
        "description": "우리 메뉴 데이터베이스에서 레시피를 검색합니다. 메뉴 추천이나 레시피 질문 시 반드시 먼저 호출하세요.",
        "parameters": {
            "type": "object",
            "required": [],
            "properties": {
                "query": {"type": "string", "description": "검색할 메뉴 이름 또는 키워드 (예: '삼겹살', '김치찌개')"},
                "ingredients": {"type": "array", "items": {"type": "string"}, "description": "사용자가 보유한 재료 목록 (예: ['계란', '대파'])"}
            }
        }
    }
}

_GROQ_UI_TOOLS = [
    {"type": "function", "function": {"name": t["name"], "description": t["description"], "parameters": t["input_schema"]}}
    for t in _CHEF_TOOLS
]
_GROQ_ALL_TOOLS = [_SEARCH_TOOL] + _GROQ_UI_TOOLS

# ── 메뉴 데이터 로드 & 검색 ──
_menu_data_cache = None

def _load_menu_data():
    global _menu_data_cache
    if _menu_data_cache is not None:
        return _menu_data_cache
    path = os.path.join(BASE_DIR, "src", "menuData_kr.js")
    try:
        with open(path, encoding="utf-8") as f:
            content = f.read()
        match = _re.search(r'=\s*(\[[\s\S]*\])', content)
        _menu_data_cache = _json.loads(match.group(1)) if match else []
    except Exception:
        _menu_data_cache = []
    return _menu_data_cache

def _search_menu_data(query: str = "", ingredients: list = None) -> list:
    data = _load_menu_data()
    query_l = query.lower().strip()
    # 쿼리를 토큰으로 분리 (공백 기준) — "계란 요리" → ["계란", "요리"]
    query_tokens = [t for t in query_l.split() if len(t) > 1] if query_l else []
    search_ings = [i.lower() for i in (ingredients or [])]
    scored = []
    for recipe in data:
        name = recipe.get("name", "").lower()
        recipe_ings = [i.lower() for i in recipe.get("ingredients", [])]
        score = 0
        # 전체 쿼리 이름 정확 매치
        if query_l and query_l in name:
            score += 10
        # 토큰별 이름/재료 매치 (부분 검색)
        for token in query_tokens:
            if token in name:
                score += 5
            score += sum(2 for ri in recipe_ings if token in ri or ri in token)
        if search_ings:
            score += sum(3 for si in search_ings if any(si in ri or ri in si for ri in recipe_ings))
        if score > 0:
            scored.append((score, recipe))
    scored.sort(key=lambda x: -x[0])
    # 중복 이름 제거 후 상위 5개 반환
    # LLM에게는 steps 제외 (길어서 LLM이 변형할 수 있음, showRecipeSteps 시 DB에서 직접 조회)
    seen_names, results = set(), []
    for _, r in scored:
        name = r.get("name", "")
        if name not in seen_names:
            seen_names.add(name)
            results.append({"name": name, "url": r.get("url", ""),
                            "uploader": r.get("uploader", ""), "ingredients": r.get("ingredients", [])})
        if len(results) == 5:
            break
    return results

def _get_recipe_steps(recipe_name: str) -> list:
    """레시피 이름으로 DB에서 정확한 steps 조회"""
    for r in _load_menu_data():
        if r.get("name", "") == recipe_name:
            return r.get("steps", [])
    return []

def _encode_line(line: str) -> bytes:
    return (line + "\n").encode("utf-8")

def _stream_tool_buf(buf: dict):
    """누적된 tool_calls_buf를 SSE tool 이벤트로 변환.
    showRecipeSteps의 steps는 DB에서 직접 조회해 LLM 변형을 방지."""
    for _, tc in sorted(buf.items()):
        try:
            args = _json.loads(tc["args_str"]) if tc["args_str"] else {}
        except Exception:
            args = {}
        # showRecipeSteps: steps를 DB에서 덮어씌워 정확도 보장
        if tc["name"] == "showRecipeSteps" and args.get("recipeName"):
            db_steps = _get_recipe_steps(args["recipeName"])
            if db_steps:
                args["steps"] = db_steps
        yield _encode_line(f"data: 9:{_json.dumps({'toolCallId': tc['id'], 'toolName': tc['name'], 'args': args}, ensure_ascii=False)}")


@app.post("/api/chat")
def api_chat():
    data = request.get_json() or {}
    messages_raw = data.get("messages", [])

    groq_messages = [{"role": "system", "content": _CHEF_SYSTEM}]
    for m in messages_raw:
        role = m.get("role")
        content = m.get("content", "")
        if role in ("user", "assistant") and content:
            groq_messages.append({"role": role, "content": content})

    if len(groq_messages) == 1:
        return jsonify({"error": "messages가 비어 있습니다."}), 400

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return jsonify({"error": "GROQ_API_KEY가 설정되지 않았습니다."}), 500

    client = _Groq(api_key=api_key)

    def generate():
        try:
            # ── 턴 1: 스트리밍 (텍스트 출력 + tool_calls 누적) ──
            stream1 = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=groq_messages,
                tools=_GROQ_ALL_TOOLS,
                tool_choice="auto",
                stream=True,
                max_tokens=2048,
            )
            text1 = ""
            buf1 = {}
            for chunk in stream1:
                delta = chunk.choices[0].delta
                if delta.content:
                    # tool call XML 누출 방지: 턴 1 텍스트는 버퍼링만, emit 안 함
                    text1 += delta.content
                if delta.tool_calls:
                    for tc in delta.tool_calls:
                        idx = tc.index
                        if idx not in buf1:
                            buf1[idx] = {"id": str(_uuid.uuid4()), "name": "", "args_str": ""}
                        if tc.id: buf1[idx]["id"] = tc.id
                        if tc.function and tc.function.name: buf1[idx]["name"] += tc.function.name
                        if tc.function and tc.function.arguments: buf1[idx]["args_str"] += tc.function.arguments

            # searchMenuData 도구 찾기
            search_tc = next(
                (tc for tc in buf1.values() if tc["name"] == "searchMenuData"), None
            )

            if search_tc:
                # ── searchMenuData 실행 ──
                try:
                    sargs = _json.loads(search_tc["args_str"]) if search_tc["args_str"] else {}
                except Exception:
                    sargs = {}
                results = _search_menu_data(sargs.get("query", ""), sargs.get("ingredients", []))
                source = "db" if results else "ai"
                yield _encode_line(f"data: 8:{_json.dumps(source)}")

                # 턴 1 결과를 대화에 추가 (content 없으면 키 생략 — Groq은 null 거부)
                asst_msg = {
                    "role": "assistant",
                    "tool_calls": [{"id": search_tc["id"], "type": "function",
                                    "function": {"name": search_tc["name"],
                                                 "arguments": search_tc["args_str"]}}]
                }
                groq_messages.append(asst_msg)
                groq_messages.append({
                    "role": "tool",
                    "tool_call_id": search_tc["id"],
                    "content": _json.dumps(results, ensure_ascii=False) if results else "검색 결과 없음"
                })

                # ── 턴 2: 스트리밍 (UI 도구로 최종 답변) ──
                stream2 = client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=groq_messages,
                    tools=_GROQ_UI_TOOLS,
                    tool_choice="auto",
                    stream=True,
                    max_tokens=2048,
                )
                buf2 = {}
                for chunk in stream2:
                    delta = chunk.choices[0].delta
                    if delta.content:
                        yield _encode_line(f"data: 0:{_json.dumps(delta.content, ensure_ascii=False)}")
                    if delta.tool_calls:
                        for tc in delta.tool_calls:
                            idx = tc.index
                            if idx not in buf2:
                                buf2[idx] = {"id": str(_uuid.uuid4()), "name": "", "args_str": ""}
                            if tc.id: buf2[idx]["id"] = tc.id
                            if tc.function and tc.function.name: buf2[idx]["name"] += tc.function.name
                            if tc.function and tc.function.arguments: buf2[idx]["args_str"] += tc.function.arguments
                yield from _stream_tool_buf(buf2)

            else:
                # searchMenuData 없이 턴 1에서 바로 답변
                # 버퍼링했던 text1 emit (tool call이 없으므로 순수 텍스트)
                if text1:
                    yield _encode_line(f"data: 0:{_json.dumps(text1, ensure_ascii=False)}")
                # UI 도구들만 처리 (searchMenuData 제외)
                ui_buf = {i: tc for i, tc in buf1.items() if tc["name"] != "searchMenuData"}
                yield from _stream_tool_buf(ui_buf)

            yield _encode_line(f"data: d:{_json.dumps({'finishReason': 'stop', 'usage': {}}, ensure_ascii=False)}")

        except Exception as e:
            yield _encode_line(f"data: 3:{_json.dumps(str(e), ensure_ascii=False)}")

    return app.response_class(
        generate(),
        mimetype="text/event-stream; charset=utf-8",
        headers={"x-vercel-ai-ui-message-stream": "v1", "Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


if __name__ == "__main__":
    app.run(port=8000, debug=True)
