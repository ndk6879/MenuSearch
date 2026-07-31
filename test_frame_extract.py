"""
test_frame_extract.py — 레시피카드 이미지 추출 파이프라인 테스트

사용법:
  python test_frame_extract.py https://www.youtube.com/watch?v=VIDEO_ID

결과:
  - test_frames/ 폴더에 추출된 이미지 저장
  - Gemini가 반환한 재료/레시피/타임스탬프 출력
  - Supabase 업로드는 --upload 플래그 추가 시 실행
"""

import sys, json, re, os
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv()

from youtube_automation import (
    analyze_video_with_gemini,
    extract_step_frames,
    upload_step_frames_to_supabase,
)

def extract_video_id(url: str) -> str:
    patterns = [
        r"(?:v=|youtu\.be/|shorts/)([A-Za-z0-9_-]{11})",
    ]
    for p in patterns:
        m = re.search(p, url)
        if m:
            return m.group(1)
    raise ValueError(f"유튜브 video_id 파싱 실패: {url}")


def main():
    if len(sys.argv) < 2:
        print("사용법: python test_frame_extract.py <유튜브URL> [--upload]")
        sys.exit(1)

    url = sys.argv[1]
    do_upload = "--upload" in sys.argv

    video_id = extract_video_id(url)
    print(f"\n🎬 video_id: {video_id}")
    print("=" * 60)

    # 1. Gemini 분석
    print("\n[1/3] Gemini 영상 분석 중 (재료 + 레시피 + 타임스탬프)...")
    raw = analyze_video_with_gemini(video_id)
    if not raw:
        print("❌ Gemini 분석 실패")
        sys.exit(1)

    # JSON 파싱
    # 첫 번째 완전한 JSON 객체만 추출
    data = None
    for match in re.finditer(r"\{", raw):
        start = match.start()
        depth, i = 0, start
        while i < len(raw):
            if raw[i] == '{': depth += 1
            elif raw[i] == '}':
                depth -= 1
                if depth == 0:
                    try:
                        data = json.loads(raw[start:i+1])
                        break
                    except json.JSONDecodeError:
                        pass
            i += 1
        if data:
            break

    if not data:
        print(f"❌ JSON 파싱 실패:\n{raw[:300]}")
        sys.exit(1)

    print(f"\n✅ 메뉴: {data.get('메뉴', '?')}")
    print(f"✅ 재료 {len(data.get('재료', []))}개: {data.get('재료', [])[:5]}...")
    print(f"✅ 순서 {len(data.get('순서', []))}단계")

    step_images = data.get("step_images", [])
    print(f"✅ 이미지 대상 단계: {step_images}")

    if not step_images:
        print("\n⚠️ Gemini가 이미지 타임스탬프를 반환하지 않았습니다.")
        sys.exit(0)

    # 2. 프레임 추출
    print(f"\n[2/3] 프레임 추출 중 ({len(step_images)}개 단계)...")
    output_dir = os.path.join(os.path.dirname(__file__), "test_frames", video_id)
    os.makedirs(output_dir, exist_ok=True)
    frames = extract_step_frames(video_id, step_images, output_dir=output_dir)

    if not frames:
        print("❌ 프레임 추출 실패")
        sys.exit(1)

    print(f"\n✅ 추출된 이미지:")
    for step_idx, path in frames.items():
        size_kb = os.path.getsize(path) // 1024
        print(f"   step {step_idx}: {path} ({size_kb}KB)")

    # 3. Supabase 업로드 (선택)
    if do_upload:
        print(f"\n[3/3] Supabase Storage 업로드 중...")
        urls = upload_step_frames_to_supabase(video_id, frames)
        print(f"\n✅ 업로드된 URL:")
        for step_idx, url in urls.items():
            print(f"   step {step_idx}: {url}")
    else:
        print(f"\n[3/3] 업로드 스킵 (--upload 플래그 없음)")
        print(f"   업로드하려면: python test_frame_extract.py {url} --upload")

    print("\n✅ 테스트 완료!")
    print(f"   이미지 저장 위치: test_frames/{video_id}/")


if __name__ == "__main__":
    main()
