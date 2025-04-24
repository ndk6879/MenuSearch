# ✅ 완성본 youtube_automation.py (복붙하면 바로 실행 가능)
# 기능: 고정댓글 → 더보기란 → 스크립트 순서로 Sonar 분석 + 출처 포함 + 중복 검사 + 긴영상

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

log_date = datetime.now().strftime("%Y-%m-%d")
log_path = f"logs/menu_extraction_{log_date}.log"

# 로그 + 터미널 동시 출력
logging.basicConfig(
    filename=log_path,
    level=logging.INFO,
    format="%(asctime)s - %(message)s",
)


class DualLogger:
    def __init__(self):
        self.terminal = sys.__stdout__
    def write(self, message):
        self.terminal.write(message)
        logging.info(message.strip())
    def flush(self):
        self.terminal.flush()
sys.stdout = DualLogger()

# 환경 변수 불러오기
load_dotenv()
API_KEY = os.getenv("YOUTUBE_API_KEY")
SONAR_API_KEY = os.getenv("SONAR_API_KEY")
CHANNEL_ID = "UC2IIBYSTMSvJaK2UJzCC06g"  # 원하는 채널로 교체 가능

def extract_json_block(text):
    try:
        match = re.search(r'\{[\s\S]*?\}', text)
        if match:
            parsed = json.loads(match.group())
            if "메뉴" in parsed and "재료" in parsed:
                return parsed
    except Exception as e:
        print("❌ JSON 파싱 실패:", e)
    return None

def append_to_js(parsed_data, video_url, uploader_name, upload_date, file_path="src/menuData_kr.js"):
    try:
        entry = {
            "name": parsed_data["메뉴"],
            "url": video_url,
            "uploader": uploader_name,
            "upload_date": upload_date,
            "ingredients": parsed_data["재료"],
            "source": parsed_data.get("출처", "unknown")
        }

        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            existing_items = re.findall(r"\{[\s\S]*?\}", content)
            for item in existing_items:
                try:
                    data = json.loads(item)
                    if data.get("name") == entry["name"] and data.get("url") == entry["url"]:
                        print("⚠️ 이미 존재하는 항목 (중복) → 추가 생략")
                        return
                except:
                    continue
            lines = content.splitlines()

        close_idx = next((i for i, line in reversed(list(enumerate(lines))) if line.strip() == "];"), -1)
        export_idx = next((i for i, line in reversed(list(enumerate(lines))) if "export default" in line), -1)
        if close_idx == -1 or export_idx == -1:
            print("❌ JS 형식 이상")
            return

        insert_idx = 1
        lines.insert(insert_idx, json.dumps(entry, ensure_ascii=False, indent=2) + ",\n")
        with open(file_path, "w", encoding="utf-8") as f:
            f.writelines(line + "\n" for line in lines)

        print(f"✅ 데이터 추가 완료 (출처: {entry['source']})")
    except Exception as e:
        print("❌ JS 저장 중 오류:", e)

def initialize_js_file_if_needed(file_path="src/menuData_kr.js"):
    if not os.path.exists(file_path):
        with open(file_path, "w", encoding="utf-8") as f:
            f.write("const menuData_kr = [\n];\n\nexport default menuData_kr;\n")
    else:
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        new_lines = []
        seen_export = False
        for line in lines:
            if "export default" in line:
                if not seen_export:
                    seen_export = True
                    new_lines.append(line)
            else:
                new_lines.append(line)

        with open(file_path, "w", encoding="utf-8") as f:
            f.writelines(new_lines)

def finalize_js_file(file_path="src/menuData_kr.js"):
    try:
        with open(file_path, "r+", encoding="utf-8") as f:
            content = f.read().rstrip(",\n")
            f.seek(0)
            f.write(content)
            f.truncate()
        print("📁 JS 파일 종료 구문 추가 완료")
    except Exception as e:
        print("❌ 종료 구문 처리 실패:", e)


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
            continue  # 생방송/예약 방송 제외

        # ⏱ 길이 제한 추가 (PT##M##S 형식 → 초 변환)
        duration = item["contentDetails"]["duration"]
        match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', duration)
        hours = int(match.group(1) or 0)
        minutes = int(match.group(2) or 0)
        seconds = int(match.group(3) or 0)
        total_seconds = hours * 3600 + minutes * 60 + seconds

        if total_seconds >= 50 * 60:
            print(f"⏩ {item['id']} → 영상 길이 {total_seconds//60}분 → 건너뜀")
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
        text = comment_snippet["textDisplay"]
        author_id = comment_snippet["authorChannelId"]["value"]
        return text, author_id
    return None, None

def get_transcript_text(video_id):
    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=["ko", "en"])
        return " ".join([entry["text"] for entry in transcript])
    except Exception as e:
        print("❌ 스크립트 가져오기 실패:", e)
        return None

def get_description(youtube, video_id):
    try:
        response = youtube.videos().list(part="snippet", id=video_id).execute()
        return response["items"][0]["snippet"]["description"]
    except Exception as e:
        print("❌ 더보기란 가져오기 실패:", e)
        return None

def ask_sonar_from_comment(comment_text, source_name=""):
    headers = {
        "Authorization": f"Bearer {SONAR_API_KEY}",
        "Content-Type": "application/json"
    }

    prompt_prefix = {
        "고정댓글": "이 댓글은 유튜브 요리 영상의 고정 댓글로 추정됩니다.",
        "더보기란": "이 텍스트는 유튜브 영상의 더보기란입니다. 메뉴/재료와 무관하거나 광고, 제품 홍보, 링크 안내가 주된 경우 분석하지 말고 '분석 불가'를 출력해주세요.",
        "스크립트": "이 텍스트는 유튜브 자막(스크립트)입니다."
    }

    prompt = f"""{prompt_prefix.get(source_name, '이 텍스트는 요리 영상의 일부입니다.')} 
내용에서 요리 메뉴 이름과 재료들을 JSON 형식으로 추출해주세요. 
다진/깐/삶은 등의 수식어는 제거하고 재료 이름만 포함해주세요. Ex) 깐마늘 → 마늘, 다진 쪽파 → 쪽파
요리나 재료가 명시되어 있지 않고, 제품 설명이나 홍보만 있다면 반드시 `"Only 제품 설명 OR 홍보"`를 출력하세요.
- 만약 여러 섹션(예: 브라인, 콩피, 드레싱)이 존재하더라도 메뉴는 하나이며, 모든 섹션의 재료를 중복 없이 통합해서 "재료"에 포함해주세요.


내용:
{comment_text}

형식:
{{
  "메뉴": "메뉴 이름",
  "재료": ["재료1", "재료2", ...]
}}"""

    payload = {
        "model": "sonar-reasoning",
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
            return response.json()["choices"][0]["message"]["content"]
        except Exception as e:
            print("❌ Sonar 응답 파싱 오류:", e)
            return None
    else:
        print("❌ Sonar 응답 없음 또는 실패:", response.status_code)
        return None

# ✅ 실행
videos_all = get_video_ids_and_channel(API_KEY, CHANNEL_ID, max_results=50)
videos = videos_all[40:50]

youtube = build("youtube", "v3", developerKey=API_KEY)
initialize_js_file_if_needed()

for idx, (video_id, uploader_id) in enumerate(videos, start=1):
    print(f"\n📌 영상 {idx}번: https://youtu.be/{video_id}")
    video_url = f"https://youtu.be/{video_id}"
    video_response = youtube.videos().list(part="snippet", id=video_id).execute()
    snippet = video_response["items"][0]["snippet"]
    uploader_name = snippet["channelTitle"]
    upload_date = snippet["publishedAt"][:10]
    comment, author_id = get_first_comment_and_author(API_KEY, video_id)

    # 순서: 고정댓글 → 더보기란 → 스크립트
    sources = [
        ("고정댓글", comment if author_id == uploader_id else None),
        ("더보기란", get_description(youtube, video_id)),
        ("스크립트", get_transcript_text(video_id))
    ]

    print("🔍 분석 순서: 고정댓글 → 더보기란 → 스크립트")

    for source_name, text in sources:
        print(f"⏭️ 현재 단계: {source_name} 확인 중...")
        if not text:
            print(f"🚫 {source_name} 없음 또는 확인 불가 → 다음 단계로 이동")
            continue
        print(f"📄 {source_name} 분석 시도")
        result = ask_sonar_from_comment(text, source_name)
        print(f"🧠 Sonar 응답 ({source_name}):\n{result}")

        parsed = extract_json_block(result)
        if parsed:
            parsed["출처"] = source_name
            append_to_js(parsed, video_url, uploader_name, upload_date)
            break
        else:
            print(f"⚠️ {source_name} 분석 실패 → 다음 단계로 이동")


    print("-" * 60)

finalize_js_file()
