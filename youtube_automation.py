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
from langdetect import detect

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

def extract_json_block(text):
    try:
        match = re.search(r'\{[\s\S]*?\}', text)
        if match:
            parsed = json.loads(match.group())
            if "menu" in parsed and "ingredients" in parsed:
                return parsed
    except Exception as e:
        # safe_print(f"❌ JSON 파싱 실패: {e}")
        safe_print(f"❌ Failed to parse JSON: {e}")

    return None

def get_existing_urls(file_path="src/menuTest.js"):
    if not os.path.exists(file_path):
        return set()
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
        urls = re.findall(r'"url":\s*"([^"]+)",?', content)
        return set(urls)

def initialize_js_file_if_needed(file_path="src/menuTest.js"):
    if not os.path.exists(file_path):
        with open(file_path, "w", encoding="utf-8") as f:
            f.write("const menuTest = [\n];\n\nexport default menuTest;\n")

def append_to_js(parsed_data, video_url, uploader_name, upload_date, file_path="src/menuTest.js"):
    try:
        entry = {
            "name": parsed_data["menu"],
            "url": video_url,
            "uploader": uploader_name,
            "upload_date": upload_date,
            "ingredients": parsed_data["ingredients"],
            "source": parsed_data.get("source", "unknown")
        }
        if not os.path.exists(file_path):
            initialize_js_file_if_needed(file_path)

        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            existing_items = re.findall(r'\{[\s\S]*?\}', content)
            for item in existing_items:
                try:
                    data = json.loads(item)
                    if data.get("url") == entry["url"]:
                        # safe_print("⚠️ 이미 저장된 URL → 추가 생략")
                        safe_print("⚠️ URL already exists → Skipping insertion")

                        return
                except:
                    continue
            lines = content.splitlines()
            close_idx = next((i for i, line in reversed(list(enumerate(lines))) if line.strip().startswith("]")), -1)
            export_idx = next((i for i, line in reversed(list(enumerate(lines))) if "export default" in line), -1)
            if close_idx == -1 or export_idx == -1:
                # safe_print("❌ JS 형식 이상")
                safe_print("❌ Invalid JS file format")

                return
            insert_idx = 1
            new_line = json.dumps(entry, ensure_ascii=False, indent=2) + ","
            lines.insert(insert_idx, new_line)
            with open(file_path, "w", encoding="utf-8") as f:
                f.writelines(line + "\n" for line in lines)
        #safe_print(f"✅ 데이터 추가 완료 (출처: {entry['source']})")
        safe_print(f"✅ Data added successfully (Source: {entry['source']})")

        safe_print(json.dumps(entry, ensure_ascii=False, indent=2))
    except Exception as e:
        # safe_print(f"❌ JS 저장 중 오류: {e}")
        safe_print(f"❌ Error while saving JS file: {e}")


def finalize_js_file(file_path="src/menuTest.js"):
    try:
        with open(file_path, "r+", encoding="utf-8") as f:
            content = f.read().rstrip(",\n")
            f.seek(0)
            f.write(content)
            f.truncate()
        # safe_print("📁 데이터 추가 완료")
        safe_print("📁 Finalizing data write completed")

    except Exception as e:
        # safe_print(f"❌ 데이터 실패: {e}")
        safe_print(f"❌ Error while finalizing file: {e}")


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
            # safe_print(f"⏩ {item['id']} → 영상 길이 {total_seconds//60}분 → 건너뜀")
            safe_print(f"⏩ {item['id']} → Video too long ({total_seconds//60} min) → Skipping")

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
        # safe_print(f"❌ 더보기란 가져오기 실패: {e}")
        safe_print(f"❌ Failed to fetch description: {e}")

        return None
        



def ask_sonar_from_comment(comment_text, source_name=""):
    headers = {
        "Authorization": f"Bearer {SONAR_API_KEY}",
        "Content-Type": "application/json"
    }
    prompt = f"""내용에서 요리 메뉴 이름과 재료들을 JSON 형식으로 추출해주세요.
- 다진/깐/삶은 등의 수식어는 제거하고 재료 이름만 포함해주세요. 예) 깐마늘 → 마늘, 다진 쪽파 → 쪽파
- 메뉴나 재료가 없고 제품 설명이나 홍보만 있다면 \"Only 제품 설명 OR 홍보\"를 출력해주세요.
- 서브 메뉴가 있거나 여러 메뉴가 있어도 메뉴는 메인 메뉴는 하나이며, 둘다 메인 같으면 메인 타이틀 같은걸 쓰거나 이름을 적당히 합쳐줘. 그리고 모든 재료는 중복 없이 \"재료\"에 통합해주세요.
- 재료 이름과 띄어쓰기도 올바르게 해줘
- 재료 대체: 생수는 물로 대체해. 엑스트라 버진 올리브오일은 그냥 올리브오일로 대체. 파스타면 종류는 그냥 파스타라고 대체해줘. 즉석밥, 햇반, 백미 같은거는 그냥 밥으로 대체. 코인육수는 있는 그대로 해줘. ex) 꽃게코인육수 -> 꽃게코인육수.

Please extract the cooking menu name and ingredients in JSON format from the content.

- Remove adjectives like "chopped", "peeled", or "boiled" and keep only the ingredient names.  
  e.g., "peeled garlic" → "garlic", "chopped scallions" → "scallions"
- If there is no menu or ingredient and the content is only product promotion or explanation, return: "Only 제품 설명 OR 홍보"
- If there are sub-menus or multiple main dishes, assume there is only one main menu.  
  If both seem like the main, choose a main title or combine the names appropriately.
- Combine all ingredients into one unified "ingredients" array with no duplicates.
- Use proper spacing and accurate ingredient naming (e.g., "soy sauce", not "soysauce").
- Ingredient normalization:  
  "mineral water" → "water"  
  "extra virgin olive oil" → "olive oil"  
  Any pasta variety → "pasta"  
  "instant rice", "microwave rice", "white rice" → "rice"  
  Leave coin broth names as-is (e.g., "crab coin broth" stays the same).


내용:
{sanitize(comment_text)}

형식:
{{
  \"menu\": \"menu name\",
  \"ingredients\": [\"ingredient1\", \"ingredient2\", ...]
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
    try:
        response = requests.post("https://api.perplexity.ai/chat/completions", headers=headers, json=payload)
        if response.status_code == 200:
            return sanitize(response.json()["choices"][0]["message"]["content"])
        else:
            # safe_print(f"❌ Sonar 응답 실패: {response.status_code}")
            safe_print(f"❌ Sonar API request failed with status: {response.status_code}")

    except Exception as e:
        # safe_print(f"❌ Sonar 요청 오류: {e}")
        safe_print(f"❌ Sonar request error: {e}")

    return None

def run():
    videos_all = get_video_ids_and_channel(API_KEY, CHANNEL_ID, max_results=50)
    videos = videos_all[:5]
    youtube = build("youtube", "v3", developerKey=API_KEY)
    file_path = "src/menuTest.js"
    existing_urls = get_existing_urls(file_path)
    initialize_js_file_if_needed(file_path)

    for idx, (video_id, uploader_id) in enumerate(videos, start=1):
        video_url = f"https://youtu.be/{video_id}"
        if video_url in existing_urls:
            # safe_print(f"⚠️ 이미 저장된 URL → {video_url} → 건너뜀")
            safe_print(f"⚠️ URL already exists → Skipping: {video_url}")
            continue
        video_response = youtube.videos().list(part="snippet", id=video_id).execute()
        snippet = video_response["items"][0]["snippet"]
        uploader_name = snippet["channelTitle"]
        upload_date = snippet["publishedAt"][:10]
        comment, author_id = get_first_comment_and_author(API_KEY, video_id)

        sources = [
            ("Pinned Comment", comment if author_id == uploader_id else None),
            ("Description Box", get_description(youtube, video_id))
        ]
        for source_name, text in sources:
            if not text:
                continue
            result = ask_sonar_from_comment(text, source_name)
            parsed = extract_json_block(result)
            if parsed:
                parsed["source"] = source_name
                append_to_js(parsed, video_url, uploader_name, upload_date, file_path)
                break

    finalize_js_file(file_path)

run()
