import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from youtube_automation import (
    analyze_one_video,
    append_to_js,
    initialize_js_file_if_needed,
    finalize_js_file,
    get_existing_urls,
)

app = Flask(__name__)

CORS(app, resources={
    r"/*": {"origins": ["http://localhost:3000", "http://127.0.0.1:3000"]}
})

# ✅ 절대경로 기반으로 menuData_kr.js 지정
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SAVE_PATH = os.path.join(BASE_DIR, "src", "menuData_kr.js")


# ✅ 결과만 반환 (저장 X)
@app.post("/analyze")
def analyze():
    url = (request.get_json() or {}).get("url", "")
    out = analyze_one_video(url)
    return jsonify(out), (200 if out.get("ok") else 400)


# ✅ 결과 + menuData_kr.js 저장
@app.post("/analyze-save")
def analyze_and_save():
    url = (request.get_json() or {}).get("url", "")
    out = analyze_one_video(url)

    # 분석 실패 시
    if not out.get("ok"):
        return jsonify({
            **out,
            "saved": False,
            "save_path": SAVE_PATH
        }), 400

    r = out["result"]

    # 1️⃣ 스킵 규칙
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

    # 3️⃣ 저장 시도
    try:
        append_to_js(
            {"메뉴": r["name"], "재료": r["ingredients"], "출처": r["source"]},
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


if __name__ == "__main__":
    app.run(port=8000, debug=True)
