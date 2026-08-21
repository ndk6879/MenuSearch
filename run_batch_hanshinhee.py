"""
한신희 쇼츠 30개 배치 분석+저장 (Method B: 기존 삭제 후 재삽입)
대상: vCQe0NgjADg 이후 최신 쇼츠 30개
"""
import requests
import time
import os

SKIP_FILE = "skip_videos.txt"

def load_skip_list():
    skip = set()
    if os.path.exists(SKIP_FILE):
        for line in open(SKIP_FILE):
            line = line.strip()
            if line and not line.startswith("#"):
                skip.add(line.split()[0])
    return skip

def add_to_skip_list(vid, reason="타임아웃 — 검토 필요"):
    with open(SKIP_FILE, "a") as f:
        f.write(f"{vid}  # {reason}\n")
    print(f"  📝 블랙리스트 추가: {vid}")

SKIP = load_skip_list()

# redirect check로 확인된 한신희 쇼츠 30개 (vCQe0NgjADg 이후, 최신순)
VIDEO_IDS = [
    "bZHIEWzwExo", "M1fvOrDChWc", "njF7RCwxQ9w", "nN5Ac1Vb9KY",
    "YTv1tQBsYiM", "IBw5i2pEaK8", "zLorAazgBwQ", "AVw1nTeFD_o",
    "2-Y5V7TpIZU", "6w5lUA6ggFg", "4G2FOxnY7Bg", "T8o8NecFVGw",
    "4Z_U31gI2fY", "iK_cXGQCYMQ", "rx6gwwcB3ec", "PfIHcyJIcXU",
    "jmGEX5wgWYg", "gSCNaH3HC2M", "lJ5NE0AepDA", "UbAvDiCFI7w",
    "pt3eS-s1AMs", "_vhkxRayAh8", "76T4Bk98M-E", "eyDW1WPql5U",
    "FUz3oVf0SuY", "P8PZxtQg-zA", "3EFZSdcEN6M", "ArqiSRAg-CA",
    "rqWOCRMjoTA", "irv_5xrxvJ4",
]

total = len(VIDEO_IDS)
print(f"▶ 한신희 쇼츠 {total}개 처리 시작 (Method B: 삭제 후 재삽입)\n")

for i, vid in enumerate(VIDEO_IDS, 1):
    url = f"https://www.youtube.com/watch?v={vid}"

    if vid in SKIP:
        print(f"[{i}/{total}] {vid} ⏭ 블랙리스트 스킵")
        print()
        continue

    print(f"[{i}/{total}] {vid}")

    # Method B: 기존 레시피 삭제
    try:
        del_r = requests.post(
            "http://localhost:8000/delete-recipe",
            json={"video_url": url},
            timeout=10,
        )
        del_data = del_r.json()
        if del_data.get("deleted"):
            print(f"  🗑 기존 레시피 삭제 완료")
    except Exception as e:
        print(f"  ⚠️ 삭제 시도 실패 (무시하고 진행): {e}")

    # 분석 + 저장
    try:
        r = requests.post(
            "http://localhost:8000/analyze-save",
            json={"url": url},
            timeout=300,
        )
        data = r.json()
        if data.get("ok") or data.get("saved_names") or data.get("name"):
            saved = data.get("saved_names") or ([data["name"]] if data.get("name") else [])
            skipped = data.get("skipped") or []
            print(f"  ✅ 저장: {saved}")
            if skipped:
                print(f"  ⏭ 스킵: {[s['name'] for s in skipped]}")
        else:
            print(f"  ❌ 실패: {data.get('error', data)}")
    except Exception as e:
        print(f"  ❌ 오류: {e}")
        if "timed out" in str(e).lower() or "timeout" in str(e).lower():
            add_to_skip_list(vid)

    print()
    if i < total:
        time.sleep(3)

print("완료")
