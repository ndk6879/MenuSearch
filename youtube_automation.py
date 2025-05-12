# ✅ 실행 시 고정댓글 → 더보기란까지만 확인하고 스크립트는 생략한 버전

import json  
from googleapiclient.discovery import build
from youtube_transcript_api import YouTubeTranscriptApi
import requests
import logging
import sys
import os
from dotenv import load_dotenv
import re
from datetime import datetime
from langdetect import detect  # pip install langdetect
from append_to_merged_js import append_to_merged_js

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
CHANNEL_ID = "UC0N7H8ALIQSnktDH6wy7iSw"
# CHANNEL_ID = "UC2IIBYSTMSvJaK2UJzCC06g"


def extract_json_block(text):
    try:
        match = re.search(r'\{[\s\S]*?\}', text)
        if match:
            parsed = json.loads(match.group())
            if "메뉴" in parsed and "재료" in parsed:
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

def is_english(text):
    try:
        lang = detect(text)
        return lang == "en"
    except:
        return False



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

def get_video_ids_and_channel(api_key, channel_id, max_results=0):
    youtube = build("youtube", "v3", developerKey=api_key)
    videos = []

    search_response = youtube.search().list(
        channelId=channel_id,
        part="id",
        order="date",
        maxResults=max_results,
        type="video"
    ).execute()

    video_ids = [item["id"]["videoId"] for item in search_response["items"]]
    video_response = youtube.videos().list(
        part="snippet,contentDetails",
        id=",".join(video_ids)
    ).execute()

    for item in video_response["items"]:
        if item["snippet"]["liveBroadcastContent"] != "none":
            continue

        duration = item["contentDetails"]["duration"]
        match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', duration)
        hours = int(match.group(1) or 0)
        minutes = int(match.group(2) or 0)
        seconds = int(match.group(3) or 0)
        total_seconds = hours * 3600 + minutes * 60 + seconds

        if total_seconds >= 30 * 60:
            safe_print(f"⏩ {item['id']} → 영상 길이 {total_seconds//60}분 → 건너뜀")
            continue

        videos.append((item["id"], item["snippet"]["channelId"]))
    return videos

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

def ask_sonar_from_comment(comment_text, source_name=""):
    headers = {
        "Authorization": f"Bearer {SONAR_API_KEY}",
        "Content-Type": "application/json"
    }

    prompt_prefix = {
        "고정댓글": "이 댓글은 유튜브 요리 영상의 고정 댓글로 추정됩니다.",
        "더보기란": "이 텍스트는 유튜브 영상의 더보기란입니다. 메뉴/재료와 무관하거나 광고, 제품 홍보, 링크 안내가 주된 경우 분석하지 말고 '분석 불가'를 출력해주세요."
    }

    prompt = f"""{prompt_prefix.get(source_name, '')}

내용에서 요리 메뉴 이름과 재료들을 JSON 형식으로 추출해주세요.
- 다진/깐/삶은 등의 수식어는 제거하고 재료 이름만 포함해주세요. 예) 깐마늘 → 마늘, 다진 쪽파 → 쪽파
- 메뉴나 재료가 없고 제품 설명이나 홍보만 있다면 \"Only 제품 설명 OR 홍보\"를 출력해주세요.
- 서브 메뉴가 있거나 여러 메뉴가 있어도 메뉴는 메인 메뉴는 하나이며, 둘다 메인 같으면 메인 타이틀 같은걸 쓰거나 이름을 적당히 합쳐줘. 그리고 모든 재료는 중복 없이 \"재료\"에 통합해주세요.
- 재료 대체: 생수는 물로 대체해. 엑스트라 버진 올리브오일은 그냥 올리브오일로 대체. 파스타면 종류는 그냥 파스타라고 대체해줘. 즉석밥, 햇반, 백미 같은거는 그냥 밥으로 대체. 코인육수는 있는 그대로 해줘. ex) 꽃게코인육수 -> 꽃게코인육수.

확인하는 고정댓글/더보기란/자막이 영어인경우
- egg yolk -> egg
- 파스타면 종류는 pasta
- hot water/ice water -> water
- sushi rice -> rice
- rice vinegar -> vinegar
- unsalted butter -> butter
-> every oil -> olive oil
-> frozen fries -> fries
내용:
{sanitize(comment_text)}

형식:
{{
  \"메뉴\": \"메뉴 이름\",
  \"재료\": [\"재료1\", \"재료2\", ...]
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

# ✅ 실행 부분
videos_all = get_video_ids_and_channel(API_KEY, CHANNEL_ID, max_results=50)
videos = videos_all[:20]
existing_urls = get_existing_urls("src/menuData_kr.js") | get_existing_urls("src/menuData_en.js")
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

    sources = [
        ("고정댓글", comment if author_id == uploader_id else None),
        ("더보기란", get_description(youtube, video_id))
    ]

    for source_name, text in sources:
        if not text:
            safe_print(f"🚫 {source_name} 없음 또는 확인 불가 → 다음 단계로 이동")
            continue

        # ✅ Sonar 호출 전에 중복 확인
        if video_url in existing_urls:
            safe_print(f"⚠️ 이미 저장된 URL → {video_url} → Sonar 호출 생략")
            break
        safe_print(f"📄 {source_name} 분석 시도")
        result = ask_sonar_from_comment(text, source_name)
        safe_print(f"🧠 Sonar 응답 ({source_name}):\n{result}")

        parsed = extract_json_block(result)
        if parsed:
            lang = detect(text)
            parsed["출처"] = ("고정댓글" if source_name == "고정댓글" else "더보기란") if lang == "ko" else ("Pinned Comment" if source_name == "고정댓글" else "Description Box")
            source_name = parsed["출처"]
            append_to_merged_js(parsed, video_url, uploader_name, upload_date, lang, source_name)

            break

        else:
            safe_print(f"⚠️ {source_name} 분석 실패 → 다음 단계로 이동")

    safe_print("-" * 60)

finalize_js_file()
