import json  
from googleapiclient.discovery import build
from youtube_transcript_api import YouTubeTranscriptApi
import requests
import logging
import sys
import os
from dotenv import load_dotenv
import re

# 로그 + 터미널 동시 출력
logging.basicConfig(
    filename="logs/menu_extraction.log",
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
CHANNEL_ID = "UC2IIBYSTMSvJaK2UJzCC06g"

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
            "ingredients": parsed_data["재료"]
        }

        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        # 배열 닫는 위치 찾기 (맨 마지막 export 제외 전의 ]; 위치)
        close_idx = next((i for i, line in reversed(list(enumerate(lines))) if line.strip() == "];"), -1)
        export_idx = next((i for i, line in reversed(list(enumerate(lines))) if "export default" in line), -1)

        if close_idx == -1 or export_idx == -1:
            print("❌ JS 형식 이상: 닫는 괄호나 export 줄을 찾지 못했습니다.")
            return

        # 새 데이터 삽입 위치는 배열 시작 바로 뒤 (const 다음 줄)
        insert_idx = 1  # const menuData_kr = [ 다음 줄
        json_str = json.dumps(entry, ensure_ascii=False, indent=2)
        lines.insert(insert_idx, json_str + ",\n")

        # 덮어쓰기
        with open(file_path, "w", encoding="utf-8") as f:
            f.writelines(lines)

        print("✅ 데이터 추가 완료 (닫기/export 줄은 수정 안 함)")
    except Exception as e:
        print("❌ JS 저장 중 오류:", e)


def initialize_js_file_if_needed(file_path="src/menuData_kr.js"):
    if not os.path.exists(file_path):
        with open(file_path, "w", encoding="utf-8") as f:
            f.write("const menuData_kr = [\n];\n\nexport default menuData_kr;\n")
    else:
        with open(file_path, "r", encoding="utf-8") as f:
            lines = f.readlines()

        # 중복된 export 제거
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
            content = f.read().rstrip(",\n")  # 마지막 콤마 제거
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
        part="snippet",
        id=",".join(video_ids)
    ).execute()
    for item in video_response["items"]:
        if item["snippet"]["liveBroadcastContent"] == "none":
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

def ask_sonar_from_comment(comment_text):
    headers = {
        "Authorization": f"Bearer {SONAR_API_KEY}",
        "Content-Type": "application/json"
    }
    prompt = f"""이 댓글은 유튜브 요리 영상의 고정 댓글로 추정됩니다. 댓글을 기반으로 요리 메뉴 이름과 재료들을 JSON 형식으로 추출해주세요. 
    만약 댓글이 메뉴나 재료와 무관하거나, 제품 홍보나 안내일 경우 분석하지 말고 "분석 불가"를 출력해주세요. 
    재료의 양은 필요없으며, 생수는 물로 대체. 양념장/드레싱이 여러 재료로 구성되면 구성 성분도 포함해주세요.
    단, 다진/깐/삶은 등의 수식어는 제거하고 재료 이름만 포함해주세요. Ex) 깐마늘 → 마늘, 다진 쪽파 → 쪽파

댓글:
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

# 실행
videos_all = get_video_ids_and_channel(API_KEY, CHANNEL_ID, max_results=50)
videos = videos_all[30:40]

youtube = build("youtube", "v3", developerKey=API_KEY)
initialize_js_file_if_needed()

for idx, (video_id, uploader_id) in enumerate(videos, start=1):
    print(f"\n📌 영상 {idx}번: https://youtu.be/{video_id}")
    comment, author_id = get_first_comment_and_author(API_KEY, video_id)

    if comment and author_id == uploader_id:
        print("✅ 고정 댓글 확인됨 → Sonar 분석 시작")
        result = ask_sonar_from_comment(comment)
        print("🧠 Sonar 응답:\n", result)

        parsed = extract_json_block(result)

        if parsed:
            video_response = youtube.videos().list(part="snippet", id=video_id).execute()
            snippet = video_response["items"][0]["snippet"]
            uploader_name = snippet["channelTitle"]
            upload_date = snippet["publishedAt"][:10]
            video_url = f"https://youtu.be/{video_id}"

            append_to_js(parsed, video_url, uploader_name, upload_date)
        else:
            print("⚠️ Sonar 분석 실패 또는 분석 대상 아님 → 생략")
    else:
        print("❌ 고정 댓글 없음 → 분석 생략")

    print("-" * 60)

finalize_js_file()
