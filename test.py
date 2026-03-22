import re
from youtube_transcript_api import (
    YouTubeTranscriptApi, 
    TranscriptsDisabled, 
    NoTranscriptFound
)

def main():
    url = input("🎥 유튜브 영상 링크를 입력하세요: ").strip()
    match = re.search(r"(?:v=|youtu\.be/)([A-Za-z0-9_-]{11})", url)
    if not match: 
        print("❌ 잘못된 유튜브 링크입니다.")
        return

    video_id = match.group(1)

    try:
        # 1. YouTubeTranscriptApi 인스턴스 생성 (v1.2.3 공식 사용법)
        ytt_api = YouTubeTranscriptApi()
        
        # 2. 인스턴스 메소드인 fetch()를 사용하여 자막을 가져옵니다. (한국어, 영어 순)
        transcript_data = ytt_api.fetch(
            video_id, 
            languages=['ko', 'en'] 
        )
        
        # 🚨 최종 수정: FetchedTranscriptSnippet 객체에서 'text' 속성으로 접근합니다.
        # item["text"] 대신 item.text를 사용합니다.
        script = "\n".join([item.text for item in transcript_data])
        
        print("\n✅ 자막을 성공적으로 가져왔습니다.\n")
        print("📝 자막 내용:\n")
        print(script)
        
    except TranscriptsDisabled:
        print("❌ 오류: 해당 영상은 자막이 비활성화되어 있습니다.")
    except NoTranscriptFound:
        print("❌ 오류: 요청한 언어(한국어, 영어) 자막을 찾을 수 없습니다.")
    except Exception as e:
        print(f"❌ 자막을 가져오는 중 최종 오류 발생: {e}")

if __name__ == "__main__":
    main()