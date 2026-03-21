"""fix_translations.py — 번역 실패한 한국어 레시피 재번역"""
import re, json, os, time
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()
genai.configure(api_key=os.environ["GEMINI_API_KEY"])
model = genai.GenerativeModel("gemini-2.5-flash")

with open("src/menuData_en.js", encoding="utf-8") as f:
    raw = f.read()
raw = re.sub(r"^const menuData_en\s*=\s*", "", raw.strip())
idx = raw.rfind("]")
raw = raw[:idx+1]
data = json.loads(raw)

def has_korean(s):
    return any("가" <= c <= "힣" for c in (s or ""))

def translate_recipe(recipe):
    name = recipe.get("name", "")
    ingredients = recipe.get("ingredients", [])
    steps = recipe.get("steps", [])
    prompt = (
        "Translate this Korean recipe to English. "
        "Return ONLY a valid JSON object with keys: name, ingredients, steps.\n"
        f"name: {name}\n"
        f"ingredients: {json.dumps(ingredients, ensure_ascii=False)}\n"
        f"steps: {json.dumps(steps[:6], ensure_ascii=False)}"
    )
    response = model.generate_content(prompt)
    text = response.text.strip()
    # strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        text = text.rsplit("```", 1)[0]
    return json.loads(text.strip())

fixed = 0
for i, recipe in enumerate(data):
    name = recipe.get("name", "")
    ings = recipe.get("ingredients", [])
    if not has_korean(name) and not any(has_korean(ing) for ing in ings):
        continue
    print(f"[{i+1}] 재번역: {name}")
    try:
        result = translate_recipe(recipe)
        data[i]["name"] = result.get("name", name)
        data[i]["ingredients"] = result.get("ingredients", ings)
        data[i]["steps"] = result.get("steps", recipe.get("steps", []))
        fixed += 1
        print(f"  → {data[i]['name']}")
    except Exception as e:
        print(f"  실패: {e}")
    time.sleep(0.5)

out = json.dumps(data, ensure_ascii=False, indent=2)
with open("src/menuData_en.js", "w", encoding="utf-8") as f:
    f.write(f"const menuData_en = {out};\nexport default menuData_en;\n")

print(f"\n완료: {fixed}개 수정")
