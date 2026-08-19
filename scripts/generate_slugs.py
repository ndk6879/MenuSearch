"""
기존 레시피 전체에 영어 slug 일괄 생성.
실행 전: Supabase SQL editor에서 아래 실행
  ALTER TABLE recipes ADD COLUMN IF NOT EXISTS slug TEXT;

실행: python scripts/generate_slugs.py
"""
import os, re, time
import requests
from dotenv import load_dotenv
from google import genai as genai_new

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
}


def to_slug(text: str) -> str:
    """영어 번역 결과를 URL 슬러그로 정리."""
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"\s+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text


def gemini_translate_batch(names: list[str]) -> list[str]:
    """이름 목록을 Gemini로 한 번에 영어 슬러그 번역."""
    client = genai_new.Client(api_key=GEMINI_API_KEY)
    numbered = "\n".join(f"{i+1}. {n}" for i, n in enumerate(names))
    prompt = f"""Translate each Korean dish name to a short English slug (2-4 words, lowercase, hyphens only, no special chars).
Return ONLY the translated slugs, one per line, same order, no numbers or extra text.

{numbered}"""
    resp = client.models.generate_content(model="gemini-2.5-flash", contents=prompt)
    lines = [l.strip() for l in resp.text.strip().splitlines() if l.strip()]
    return lines


def get_video_id(url: str) -> str | None:
    m = re.search(r"(?:v=|youtu\.be/|shorts/)([A-Za-z0-9_-]{11})", url or "")
    return m.group(1) if m else None


def make_unique_slug(base: str, used: set[str], video_id: str) -> str:
    if base not in used:
        return base
    suffix = (video_id or "")[:4]
    candidate = f"{base}-{suffix}" if suffix else base
    i = 2
    while candidate in used:
        candidate = f"{base}-{i}"
        i += 1
    return candidate


def main():
    # 1. slug 없는 레시피 전부 가져오기
    res = requests.get(
        f"{SUPABASE_URL}/rest/v1/recipes",
        headers=headers,
        params={"select": "url,name,uploader,slug", "slug": "is.null", "limit": 5000},
    )
    recipes = res.json()
    print(f"슬러그 없는 레시피: {len(recipes)}개")

    if not recipes:
        print("모두 슬러그 있음. 완료.")
        return

    # 2. uploader별 slug 충돌 방지를 위해 기존 slug 로드
    existing_res = requests.get(
        f"{SUPABASE_URL}/rest/v1/recipes",
        headers=headers,
        params={"select": "uploader,slug", "slug": "not.is.null", "limit": 5000},
    )
    used_by_uploader: dict[str, set] = {}
    for row in existing_res.json():
        up = row.get("uploader", "")
        used_by_uploader.setdefault(up, set()).add(row.get("slug", ""))

    # 3. Gemini로 배치 번역 (50개씩)
    BATCH = 50
    name_list = [r["name"] for r in recipes]
    translated: list[str] = []
    for i in range(0, len(name_list), BATCH):
        batch = name_list[i:i+BATCH]
        print(f"번역 중... {i+1}~{i+len(batch)}")
        try:
            results = gemini_translate_batch(batch)
            if len(results) != len(batch):
                print(f"  ⚠️ 결과 수 불일치 ({len(results)}/{len(batch)}), 부족분 video_id로 채움")
                results += [""] * (len(batch) - len(results))
            translated.extend(results)
        except Exception as e:
            print(f"  ❌ Gemini 오류: {e}, video_id fallback 사용")
            translated.extend([""] * len(batch))
        time.sleep(1)

    # 4. slug 확정 후 DB 업데이트
    updated = 0
    for recipe, raw_en in zip(recipes, translated):
        url = recipe["url"]
        uploader = recipe.get("uploader", "")
        video_id = get_video_id(url)

        base = to_slug(raw_en) if raw_en else (video_id[:8] if video_id else "recipe")
        if not base:
            base = video_id[:8] if video_id else "recipe"

        used = used_by_uploader.setdefault(uploader, set())
        final_slug = make_unique_slug(base, used, video_id)
        used.add(final_slug)

        patch = requests.patch(
            f"{SUPABASE_URL}/rest/v1/recipes",
            headers={**headers, "Prefer": "return=minimal"},
            params={"url": f"eq.{url}"},
            json={"slug": final_slug},
        )
        if patch.status_code < 300:
            updated += 1
        else:
            print(f"  ❌ 업데이트 실패: {recipe['name']} → {patch.text}")

    print(f"\n✅ 완료: {updated}/{len(recipes)}개 슬러그 생성")


if __name__ == "__main__":
    main()
