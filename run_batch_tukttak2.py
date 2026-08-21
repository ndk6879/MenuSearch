"""
뚝딱이형 동영상(쇼츠 제외) 22개 신규 배치 분석+저장
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

VIDEO_IDS = [
    'ahbJW_qLuF0', 'wRp_OxfqLoM', 'sjjBdB2fOzY', 'VQMACe0G7y8',
    'BQe-smVgnfk', '2wcxwr2zflc', '9JBzp9V0aNo', '38GBZlbmbMg',
    'jcMWnHnJc48', '07VOqilLKak', 'CRcydHmiPAs', 'pl0usVj-BFU',
    '0ePrpr3_3Fc', 'SQ-93NQI3ko', 'RvEQDYPsI4c', 'qY3wVXb2rTg',
    '4nA6RbiGHW8', 'sVlR8fP1mdk', '7jl422Pw61s', '5HoH2gPjRvo',
    'NMmYAcDt7IA', 'xTZMKeX9vwI',
]

total = len(VIDEO_IDS)
print(f"▶ 총 {total}개 영상 처리 시작\n")

for i, vid in enumerate(VIDEO_IDS, 1):
    url = f"https://www.youtube.com/watch?v={vid}"
    if vid in SKIP:
        print(f"[{i}/{total}] {vid} ⏭ 블랙리스트 스킵")
        continue
    print(f"[{i}/{total}] {vid}")
    try:
        r = requests.post(
            "http://localhost:8000/analyze-save",
            json={"url": url},
            timeout=300,
        )
        data = r.json()
        if data.get("ok") or data.get("name"):
            print(f"  ✅ 저장: {data.get('name', '')} (count={data.get('saved_count', 0)})")
            skipped = data.get("skipped") or []
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
