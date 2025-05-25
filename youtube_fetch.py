# youtube_fetch.py
# ➤ 유튜브 채널에서 최대 200개의 영상 메타데이터(제목, 길이 등)를 수집해 video_ids.json에 저장하는 스크립트

import json
import os
import re
from googleapiclient.discovery import build
from dotenv import load_dotenv
from datetime import datetime

# ✅ 환경 변수 로딩
load_dotenv()
API_KEY = os.getenv("YOUTUBE_API_KEY")
CHANNEL_ID = "UC2IIBYSTMSvJaK2UJzCC06g"

# ✅ 유니코드 문자 제거
def sanitize(text):
    return ''.join(c for c in text if not (0xD800 <= ord(c) <= 0xDFFF))

# ✅ 유튜브 영상 목록 가져오기
def get_video_list(api_key, channel_id, max_results=200):
    youtube = build("youtube", "v3", developerKey=api_key)
    videos = []
    next_page_token = None

    while len(videos) < max_results:
        search_response = youtube.search().list(
            channelId=channel_id,
            part="id",
            order="date",
            maxResults=50,
            type="video",
            pageToken=next_page_token
        ).execute()

        video_ids = [item["id"]["videoId"] for item in search_response["items"]]
        video_response = youtube.videos().list(
            part="snippet,contentDetails",
            id=','.join(video_ids)
        ).execute()

        for item in video_response["items"]:
            snippet = item.get("snippet", {})
            duration = item.get("contentDetails", {}).get("duration", "")
            match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', duration)

            if match:
                hours = int(match.group(1) or 0)
                minutes = int(match.group(2) or 0)
                seconds = int(match.group(3) or 0)
            else:
                hours = minutes = seconds = 0

            total_seconds = hours * 3600 + minutes * 60 + seconds

            videos.append({
                "video_id": item["id"],
                "url": f"https://youtu.be/{item['id']}",
                "title": sanitize(snippet.get("title", "")),
                "description": sanitize(snippet.get("description", "")),
                "channel_title": snippet.get("channelTitle", ""),
                "published_at": snippet.get("publishedAt", ""),
                "duration": total_seconds,
                "processed": False,
                "reason": None
            })

        next_page_token = search_response.get("nextPageToken")
        if not next_page_token:
            break

    return videos[:max_results]

# ✅ 실행
if __name__ == "__main__":
    results = get_video_list(API_KEY, CHANNEL_ID, max_results=200)
    os.makedirs("data", exist_ok=True)
    with open("data/video_ids.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"✅ 총 {len(results)}개의 영상 정보를 저장했습니다 → data/video_ids.json")
