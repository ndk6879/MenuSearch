import json  
from googleapiclient.discovery import build
from youtube_transcript_api import YouTubeTranscriptApi # ✅ 자막 API 추가
import requests
import logging
import sys
import os
from dotenv import load_dotenv
import re
from datetime import datetime
import socket

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import google.auth.transport.requests
import google.auth

import socket
import httplib2

# youtube_automation.py (맨 위쪽에 추가)
import re, json
from googleapiclient.discovery import build
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    TranscriptsDisabled, NoTranscriptFound, VideoUnavailable, TooManyRequests
)

def analyze_one_video(url: str) -> dict:
    try:
        # 1. videoId 추출
        match = re.search(r"(?:v=|youtu\.be/)([A-Za-z0-9_-]{11})", url)
        if not match:
            return {"ok": False, "error": "영상 URL에서 videoId 추출 실패"}
        video_id = match.group(1)

        youtube = build("youtube", "v3", developerKey=API_KEY)
        video_response = youtube.videos().list(part="snippet", id=video_id).execute()
        snippet = video_response["items"][0]["snippet"]
        uploader_name = snippet["channelTitle"]
        upload_date = snippet["publishedAt"][:10]
        video_url = f"https://youtu.be/{video_id}"

        # 2. 고정댓글/더보기란/자막 가져오기
        comment, author_id = get_first_comment_and_author(API_KEY, video_id)
        transcript_text = get_transcript(video_id) # ✅ 자막 가져오기 추가
        
        # ✅ 세 가지 출처를 우선 순위별로 정의
        sources = [
            ("고정댓글", comment if author_id == snippet["channelId"] else None),
            ("더보기란", get_description(youtube, video_id)),
            ("자막", transcript_text) # ✅ 자막 소스 추가
        ]

        # 3. Sonar API 분석
        for source_name, text in sources:
            if not text: 
                continue
            result = ask_sonar_from_comment(text, source_name)
            parsed = extract_json_block(result)
            if parsed:
                return {
                    "ok": True,
                    "result": {
                        "name": parsed["메뉴"],
                        "ingredients": parsed["재료"],
                        "steps": parsed.get("순서", []), # ✅ 순서(steps) 필드 추가
                        "source": source_name,
                        "uploader": uploader_name,
                        "upload_date": upload_date,
                        "video_url": video_url,
                    }
                }

        return {"ok": False, "error": "분석 실패"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


socket.setdefaulttimeout(10)


log_date = datetime.now().strftime("%Y-%m-%d")
log_path = f"logs/menu_extraction_{log_date}.log"

logging.basicConfig(
    filename=log_path,
    level=logging.INFO,
    format="%(asctime)s - %(message)s",
)

class DualLogger:
    def __init__(self):
        self.terminal = sys.__stdout__
    def write(self, message):
        try:
            self.terminal.write(message)
        except:
            self.terminal.write(message.encode("utf-8", "ignore").decode("utf-8"))
        logging.info(message.strip())
    def flush(self):
        self.terminal.flush()

sys.stdout = DualLogger()

# ✅ 유니코드 에러 방지
def sanitize(text):
    if not isinstance(text, str):
        return str(text)
    return ''.join(c for c in text if not (0xD800 <= ord(c) <= 0xDFFF))

def safe_print(msg):
    print(sanitize(msg))

load_dotenv()
API_KEY = os.getenv("YOUTUBE_API_KEY")
SONAR_API_KEY = os.getenv("SONAR_API_KEY")
CHANNEL_ID = "UC0x63Jy1Sy63grrf_Pq0WEg"

# ✅ '순서' 필드 검증 로직 추가
def extract_json_block(text):
    try:
        match = re.search(r'\{[\s\S]*?\}', text)
        if match:
            parsed = json.loads(match.group())
            # 메뉴, 재료, 순서 모두 있는지 확인
            if "메뉴" in parsed and "재료" in parsed and "순서" in parsed: 
                return parsed
    except Exception as e:
        safe_print(f"❌ JSON 파싱 실패: {e}")
    return None

def get_existing_urls(file_path="src/menuData_kr.js"):
    if not os.path.exists(file_path):
        return set()
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
        urls = re.findall(r'"url":\s*"([^"]+)"', content)
        return set(urls)

# ✅ 'steps' 필드 추가 및 저장 로직 수정
def append_to_js(parsed_data, video_url, uploader_name, upload_date, file_path="src/menuData_kr.js"):
    try:
        entry = {
            "name": parsed_data["메뉴"],
            "url": video_url,
            "uploader": uploader_name,
            "upload_date": upload_date,
            "ingredients": parsed_data["재료"],
            "steps": parsed_data.get("순서", []), # ✅ 순서 필드를 'steps'로 저장
            "source": parsed_data.get("출처", "unknown")
        }

        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            existing_items = re.findall(r"\{[\s\S]*?\}", content)
            for item in existing_items:
                try:
                    data = json.loads(item)
                    if data.get("url") == entry["url"]:
                        safe_print("⚠️ 이미 저장된 URL → 추가 생략")
                        return
                except:
                    continue
            lines = content.splitlines()

        close_idx = next((i for i, line in reversed(list(enumerate(lines))) if line.strip().startswith("]")), -1)

        export_idx = next((i for i, line in reversed(list(enumerate(lines))) if "export default" in line), -1)
        if close_idx == -1 or export_idx == -1:
            safe_print("❌ JS 형식 이상")
            return

        insert_idx = 1
        lines.insert(insert_idx, json.dumps(entry, ensure_ascii=False, indent=2) + ",\n")
        with open(file_path, "w", encoding="utf-8") as f:
            f.writelines(line + "\n" for line in lines)

        safe_print(f"✅ 데이터 추가 완료 (출처: {entry['source']})")
    except Exception as e:
        safe_print(f"❌ JS 저장 중 오류: {e}")

def initialize_js_file_if_needed(file_path="src/menuData_kr.js"):
    if not os.path.exists(file_path):
        with open(file_path, "w", encoding="utf-8") as f:
            f.write("const menuData_kr = [\n];\n\nexport default menuData_kr;\n")

def finalize_js_file(file_path="src/menuData_kr.js"):
    try:
        with open(file_path, "r+", encoding="utf-8") as f:
            content = f.read().rstrip(",\n")
            f.seek(0)
            f.write(content)
            f.truncate()
        safe_print("📁 데이터 추가 완료")
    except Exception as e:
        safe_print(f"❌ 데이터 실패: {e}")


def get_video_ids_and_channel(api_key, channel_id, max_results=200):
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
            id=",".join(video_ids)
        ).execute()

        for item in video_response["items"]:
            snippet = item.get("snippet", {})
            live_status = snippet.get("liveBroadcastContent", "none")
            duration = item["contentDetails"]["duration"]

            if live_status != "none":
                continue

            match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', duration)
            hours = int(match.group(1) or 0)
            minutes = int(match.group(2) or 0)
            seconds = int(match.group(3) or 0)
            total_seconds = hours * 3600 + minutes * 60 + seconds

            if total_seconds >= 1800:
                video_url = f"https://youtu.be/{item['id']}"
                if video_url in get_existing_urls():
                    safe_print(f"⚠️ 이미 저장된 URL → {video_url} → 건너뜀 (길이 김)")
                else:
                    safe_print(f"⏩ {item['id']} → 영상 길이 {total_seconds//60}분 → 저장 (길이 김)")
                    append_to_js(
                        {
                            "메뉴": "건너뜀 - 영상 너무 김",
                            "재료": [],
                            "순서": [], # ✅ 순서 필드 추가
                            "출처": "자동 판별"
                        },
                        video_url,
                        item["snippet"]["channelTitle"],
                        item["snippet"]["publishedAt"][:10]
                    )
                continue


            videos.append((item["id"], item["snippet"]["channelId"]))

        next_page_token = search_response.get("nextPageToken")
        if not next_page_token:
            break

    return videos[:max_results]


# ✅ 자막 가져오는 함수 추가
def get_transcript(video_id):
    try:
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
        
        ko_transcript = None
        for t in transcript_list:
            if t.language_code == 'ko':
                ko_transcript = t
                break
        
        if not ko_transcript:
            for t in transcript_list:
                 if t.is_generated or t.language_code == 'en': 
                     ko_transcript = t
                     break

        if not ko_transcript:
            safe_print("🚫 한국어 또는 다른 사용 가능한 자막 없음")
            return None

        transcript = ko_transcript.fetch()
        full_text = " ".join([item['text'] for item in transcript])
        
        return full_text
        
    except Exception as e:
        safe_print(f"❌ 자막 가져오기 실패: {e}")
        return None

def get_first_comment_and_author(api_key, video_id):
    youtube = build("youtube", "v3", developerKey=api_key)
    response = youtube.commentThreads().list(
        part="snippet",
        videoId=video_id,
        maxResults=1,
        textFormat="plainText"
    ).execute()
    if response.get("items"):
        comment_snippet = response["items"][0]["snippet"]["topLevelComment"]["snippet"]
        return comment_snippet["textDisplay"], comment_snippet["authorChannelId"]["value"]
    return None, None

def get_description(youtube, video_id):
    try:
        response = youtube.videos().list(part="snippet", id=video_id).execute()
        return response["items"][0]["snippet"]["description"]
    except Exception as e:
        safe_print(f"❌ 더보기란 가져오기 실패: {e}")
        return None
# ✅ ask_sonar_from_comment 함수 전체 (수정 완료 버전)
def ask_sonar_from_comment(comment_text, source_name=""):
    headers = {
        "Authorization": f"Bearer {SONAR_API_KEY}",
        "Content-Type": "application/json"
    }

    prompt_prefix = {
        "고정댓글": "이 댓글은 유튜브 요리 영상의 고정 댓글로 추정됩니다.",
        "더보기란": "이 텍스트는 유튜브 영상의 더보기란입니다. 메뉴/재료와 무관하거나 광고, 제품 홍보, 링크 안내가 주된 경우 분석하지 말고 '분석 불가'를 출력해주세요.",
        "자막": "이 텍스트는 유튜브 영상의 자막입니다. 영상에서 요리하는 내용만 추려서 메뉴/재료/순서를 추출해야 합니다. 쓸데없는 대화, 배경 설명, PPL 등은 무시하고 **오직 요리 순서에 해당하는 문장**만 간단히 요약하여 순서에 포함해주세요."
    }

    prompt = f"""{prompt_prefix.get(source_name, '')}

내용에서 요리 메뉴 이름, 재료들, 그리고 **요리 순서(레시피)**를 JSON 형식으로 추출해주세요.

- 메뉴나 재료/순서가 없고 제품 설명이나 홍보만 있다면 \"Only 제품 설명 OR 홍보\"를 출력해주세요.
- 서브 메뉴가 있거나 여러 메뉴가 있어도 메인 메뉴는 하나이며, 둘다 메인 같으면 메인 타이틀 같은걸 쓰거나 이름을 적당히 합쳐줘.
- **재료**: 모든 재료는 중복 없이 \"재료\"에 통합해주세요. (다진/깐 등의 수식어는 제거하고 이름만 남기세요. 예: 깐마늘 → 마늘)
- **순서**: 요리 순서를 단계별 배열로 추출해주세요. **만약 입력된 내용에 이미 명확하게 정리된 단계별 순서가 있다면, 있는걸 사용해주세요.**

내용:
{sanitize(comment_text)}

형식:
{{
  \"메뉴\": \"메뉴 이름\",
  \"재료\": [\"재료1\", \"재료2\", ...],
  \"순서\": [\"순서1\", \"순서2\", \"순서3\", ...]
}}"""

    payload = {
        "model": "sonar-reasoning-pro",
        "messages": [
            {"role": "system", "content": "넌 요리 영상 분석 전문가야."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.3,
        "search": False
    }

    response = requests.post("https://api.perplexity.ai/chat/completions", headers=headers, json=payload)
    if response.status_code == 200 and response.content.strip():
        try:
            return sanitize(response.json()["choices"][0]["message"]["content"])
        except Exception as e:
            safe_print(f"❌ JSON 파싱 실패: {e}")
            return None
    else:
        safe_print(f"❌ Sonar 응답 없음 또는 실패: {response.status_code}")
        return None



if __name__ == "__main__":

    # ✅ 실행 부분
    videos_all = get_video_ids_and_channel(API_KEY, CHANNEL_ID, max_results=200)
    videos = videos_all[:5]
    existing_urls = get_existing_urls()
    youtube = build("youtube", "v3", developerKey=API_KEY)
    initialize_js_file_if_needed()

    for idx, (video_id, uploader_id) in enumerate(videos, start=1):
        video_url = f"https://youtu.be/{video_id}"
        if video_url in existing_urls:
            safe_print(f"⚠️ 이미 저장된 URL → {video_url} → 건너뜀")
            continue

        safe_print(f"\n📌 영상 {idx}번: {video_url}")
        video_response = youtube.videos().list(part="snippet", id=video_id).execute()
        snippet = video_response["items"][0]["snippet"]
        uploader_name = snippet["channelTitle"]
        upload_date = snippet["publishedAt"][:10]
        comment, author_id = get_first_comment_and_author(API_KEY, video_id)
        
        transcript_text = get_transcript(video_id) # ✅ 자막 가져오기

        # ✅ 고정댓글, 더보기란, 자막 순으로 탐색
        sources = [
            ("고정댓글", comment if author_id == uploader_id else None),
            ("더보기란", get_description(youtube, video_id)),
            ("자막", transcript_text)
        ]

        found_and_saved = False
        for source_name, text in sources:
            safe_print(f"⏭️ 현재 단계: {source_name} 확인 중...")
            if not text:
                safe_print(f"🚫 {source_name} 없음 또는 확인 불가 → 다음 단계로 이동")
                continue
            
            safe_print(f"📄 {source_name} 분석 시도")
            result = ask_sonar_from_comment(text, source_name)
            safe_print(f"🧠 Sonar 응답 ({source_name}):\n{result}")

            parsed = extract_json_block(result)
            if parsed:
                parsed["출처"] = source_name
                append_to_js(parsed, video_url, uploader_name, upload_date)
                found_and_saved = True
                break
            else:
                safe_print(f"⚠️ {source_name} 분석 실패 → 다음 단계로 이동")
        
        # 모든 출처에서 분석 실패 시 '분석 불가' 저장
        if not found_and_saved:
            safe_print("❌ 모든 출처 분석 실패 → '분석 불가' 항목 저장")
            failed_entry = {
                "메뉴": "분석 불가",
                "재료": [],
                "순서": [],
                "출처": "모든 출처 실패"
            }
            append_to_js(failed_entry, video_url, uploader_name, upload_date)


        safe_print("-" * 60)

    finalize_js_file()