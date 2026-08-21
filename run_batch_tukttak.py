"""
뚝딱이형 미처리 영상 50개 배치 분석+저장
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

DONE = {
    "mpt5eC4be4s",  # 닭칼국수
    "cnmzc2uQ0qo",  # 앞다리살 차슈
    "1_xyx3Ncv98",  # 항정살 스테이크
    "gx9GzKohj5o",  # 선지해장국
    "ErRPw4Xgc7Y",  # underrated cut
    "FPf8FgLYx5w",  # 맛집 칼국수 (이미 DB에 있음)
}

VIDEO_IDS = [
    "FPf8FgLYx5w", "Hb1MU29nUjo", "bKgytsZoU2s", "GQySe-dZTwM",
    "OgR00HBMKFs", "w7Y1VTjST-E", "vFRno2QPXFk", "CosIl-068WA",
    "CbczJqB20aU", "S_nBECiPB_Y", "IV1ii1cdZ6Y", "GHe5PZlWDA0",
    "6j2OqTgzg2c", "RG4rils5Wgk", "ROc4fJcrJIs", "-hxSjy0STWM",
    "hu1uTTaXERM", "6wPet-tS5sQ", "4gqF4FUmmYY", "wbjpCqVxOPo",
    "4IszS80haHE", "nHNUVuYfF-A", "6Z3e4Sn0pgA", "eTkcrIjOn0w",
    "7oKLVfk1lEk", "BuLEtY4lPFc", "A8OVVSTDmQE", "oEjKGhzlpNs",
    "dDLZlj0trfA", "NXNErPdm9O8", "K3xaf1EXpB0", "5QK1MYSWruY",
    "U9MF9r1lLTg", "KRrmTMtkD6U", "fuDKr-j-m8U", "GtAGveuWMmU",
    "2cGCWze4qZU", "gaE5uxVHlLI", "SyAMjGiUfA8", "cohpnptYtYE",
    "qNXAfktS-fI", "a-uEVp8YwkU", "2ztKFN4baao", "9U0qusEMRAA",
    "k6BN1o_C95Q", "RBCf2jbDrMc", "Xqajl2Phu4g", "csoBqNW3Mgw",
    "oBKZfEeS_f4", "bSJK-_TrQYg",
]

targets = [vid for vid in VIDEO_IDS if vid not in DONE]
total = len(targets)

print(f"▶ 총 {total}개 영상 처리 시작\n")

for i, vid in enumerate(targets, 1):
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
        if data.get("ok") or data.get("saved_names"):
            saved = data.get("saved_names") or []
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
