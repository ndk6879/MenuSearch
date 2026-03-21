"""
translate_to_english.py
menuData_kr.js의 한국 레시피를 영어로 번역해서 menuData_en.js에 저장
- name, ingredients, steps 번역
- url, uploader, upload_date 유지
"""

import re
import json
import time
import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()
genai.configure(api_key=os.environ["GEMINI_API_KEY"])
model = genai.GenerativeModel("gemini-2.5-flash")

SRC = "src/menuData_kr.js"
OUT = "src/menuData_en.js"

# ── 1. 원본 파싱 ──
with open(SRC, encoding="utf-8") as f:
    raw = f.read()

raw = re.sub(r"^const menuData_kr\s*=\s*", "", raw.strip())
idx = raw.rfind("]")
raw = raw[:idx+1]
raw = re.sub(r",\s*([}\]])", r"\1", raw)  # trailing commas 제거
data_kr = json.loads(raw)
print(f"총 {len(data_kr)}개 레시피 로드")

# ── 2. 기존 번역 로드 (있으면 이어서) ──
translated = []
done_urls = set()

if os.path.exists(OUT):
    with open(OUT, encoding="utf-8") as f:
        existing = f.read()
    existing = re.sub(r"^const menuData_en\s*=\s*", "", existing.strip())
    idx2 = existing.rfind("]")
    existing = existing[:idx2+1] if idx2 != -1 else existing
    try:
        translated = json.loads(existing)
        done_urls = {r.get("url") for r in translated}
        print(f"기존 번역 {len(translated)}개 로드 (이어서 진행)")
    except Exception:
        print("기존 파일 파싱 실패, 처음부터 시작")

def translate_recipe(recipe):
    name = recipe.get("name", "")
    ingredients = recipe.get("ingredients", [])
    steps = recipe.get("steps", [])

    prompt = f"""Translate the following Korean recipe information to English.
Return a JSON object with exactly these keys: "name", "ingredients", "steps".
- "name": translated recipe name (natural English dish name)
- "ingredients": array of translated ingredient strings (keep concise, no measurements)
- "steps": array of translated cooking step strings

Korean recipe:
name: {name}
ingredients: {json.dumps(ingredients, ensure_ascii=False)}
steps: {json.dumps(steps, ensure_ascii=False)}

Return ONLY the JSON object, no explanation, no markdown.
"""
    response = model.generate_content(prompt)
    text = response.text.strip()
    # JSON 파싱
    text = re.sub(r"^```json\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    parsed = json.loads(text)
    return parsed

# ── 3. 번역 실행 ──
errors = []
for i, recipe in enumerate(data_kr):
    url = recipe.get("url", "")
    if url in done_urls:
        continue

    name = recipe.get("name", "(이름없음)")
    print(f"[{i+1}/{len(data_kr)}] 번역 중: {name}")

    try:
        translated_fields = translate_recipe(recipe)
        translated.append({
            "name": translated_fields.get("name", name),
            "url": url,
            "uploader": recipe.get("uploader", ""),
            "upload_date": recipe.get("upload_date", ""),
            "ingredients": translated_fields.get("ingredients", []),
            "steps": translated_fields.get("steps", []),
        })
        done_urls.add(url)
    except Exception as e:
        print(f"  ❌ 실패: {e}")
        errors.append((name, url, str(e)))
        # 실패해도 원본 데이터로 채워넣기
        translated.append({
            "name": name,
            "url": url,
            "uploader": recipe.get("uploader", ""),
            "upload_date": recipe.get("upload_date", ""),
            "ingredients": recipe.get("ingredients", []),
            "steps": recipe.get("steps", []),
        })
        done_urls.add(url)

    # 10개마다 중간 저장
    if (i + 1) % 10 == 0:
        _out = json.dumps(translated, ensure_ascii=False, indent=2)
        with open(OUT, "w", encoding="utf-8") as f:
            f.write(f"const menuData_en = {_out};\nexport default menuData_en;\n")
        print(f"  💾 중간 저장 ({len(translated)}개)")

    time.sleep(0.5)  # rate limit 방지

# ── 4. 최종 저장 ──
out_json = json.dumps(translated, ensure_ascii=False, indent=2)
with open(OUT, "w", encoding="utf-8") as f:
    f.write(f"const menuData_en = {out_json};\nexport default menuData_en;\n")

print(f"\n✅ 완료: {len(translated)}개 번역 → {OUT}")
if errors:
    print(f"\n❌ 실패 {len(errors)}개:")
    for name, url, err in errors:
        print(f"  {name} | {err}")
