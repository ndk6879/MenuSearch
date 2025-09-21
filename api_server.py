from flask import Flask, request, jsonify
from flask_cors import CORS
from youtube_automation import analyze_one_video, append_to_js, initialize_js_file_if_needed, finalize_js_file

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": ["http://localhost:3000","http://127.0.0.1:3000"]}})

@app.post("/analyze")          # 결과만
def analyze():
    url = (request.get_json() or {}).get("url","")
    out = analyze_one_video(url)
    return jsonify(out), (200 if out.get("ok") else 400)

@app.post("/analyze-save")     # 결과 + menuData_kr.js 저장
def analyze_save():
    url = (request.get_json() or {}).get("url","")
    out = analyze_one_video(url)
    if not out.get("ok"): return jsonify(out), 400
    r = out["result"]
    initialize_js_file_if_needed("src/menuData_kr.js")
    append_to_js({"메뉴": r["name"], "재료": r["ingredients"], "출처": r["source"]},
                 r["video_url"], r["uploader"], r["upload_date"], file_path="src/menuData_kr.js")
    finalize_js_file("src/menuData_kr.js")
    return jsonify({"ok": True, "saved": True, "result": r})

if __name__ == "__main__":
    app.run(port=8000, debug=True)
