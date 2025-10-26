import os
import re
import sys
import json
import logging
import socket
import requests
from datetime import datetime
from dotenv import load_dotenv

from googleapiclient.discovery import build

# ✅ youtube_transcript_api: 공식 API만 사용 (내부 _errors 사용 X)
from youtube_transcript_api import (
    YouTubeTranscriptApi,
    TranscriptsDisabled,
    NoTranscriptFound,
)

# -----------------------------
# 로깅 / 유틸
# -----------------------------
socket.setdefaulttimeout(10)

log_date = datetime.now().strftime("%Y-%m-%d")
os.makedirs("logs", exist_ok=True)
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
        if message.strip():
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

# -----------------------------
# env
# -----------------------------
load_dotenv()
API_KEY = os.getenv("YOUTUBE_API_KEY")
SONAR_API_KEY = os.getenv("SONAR_API_KEY")

# -----------------------------
# 공용 헬퍼
# -----------------------------
def extract_json_block(text):
    try:
        match = re.search(r'\{[\s\S]*?\}', text)
        if not match:
            return None
        parsed = json.loads(match.group())

        # '메뉴', '재료', '순서' 모두 존재해야 유효
        if all(k in parsed for k in ("메뉴", "재료", "순서")):
            steps = parsed["순서"]
            if isinstance(steps, list):
                # ✅ 각 단계에 숫자 붙이기
                parsed["순서"] = [f"{i+1}. {s.strip()}" for i, s in enumerate(steps) if str(s).strip()]
            else:
                parsed["순서"] = [f"1. {str(steps).strip()}"]
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

def initialize_js_file_if_needed(file_path="src/menuData_kr.js"):
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
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

def append_to_js(parsed_data, video_url, uploader_name, upload_date, file_path="src/menuData_kr.js"):
    try:
        entry = {
            "name": parsed_data["메뉴"],
            "url": video_url,
            "uploader": uploader_name,
            "upload_date": upload_date,
            "ingredients": parsed_data["재료"],
            "steps": parsed_data.get("순서", []),
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

# -----------------------------
# YouTube/Transcript
# -----------------------------
def get_transcript(video_id: str):
    try:
        ytt_api = YouTubeTranscriptApi()
        transcript_data = ytt_api.fetch(video_id, languages=['ko', 'en'])
        full_text = " ".join([item.text for item in transcript_data])
        return full_text
    except TranscriptsDisabled:
        safe_print("🚫 자막이 비활성화된 영상입니다.")
        return None
    except NoTranscriptFound:
        safe_print("🚫 자막을 찾을 수 없습니다.")
        return None
    except Exception as e:
        safe_print(f"❌ 자막 가져오기 실패: {e}")
        return None

# youtube_automation.py

def get_first_comment_and_author(api_key, video_id):
    youtube = build("youtube", "v3", developerKey=api_key)

    # ▶ 동영상의 채널 ID 가져오기
    v = youtube.videos().list(part="snippet", id=video_id).execute()
    items = v.get("items", [])
    video_channel_id = items[0]["snippet"]["channelId"] if items else None

    # ▶ 상단(고정댓글 우선) 1개만 조회
    response = youtube.commentThreads().list(
        part="snippet",
        videoId=video_id,
        maxResults=1,
        textFormat="plainText",
        order="relevance"
    ).execute()

    if response.get("items"):
        c = response["items"][0]["snippet"]["topLevelComment"]["snippet"]
        return c["textDisplay"], c["authorChannelId"]["value"], video_channel_id

    return None, None, video_channel_id


def get_description(youtube, video_id):
    try:
        response = youtube.videos().list(part="snippet", id=video_id).execute()
        return response["items"][0]["snippet"]["description"]
    except Exception as e:
        safe_print(f"❌ 더보기란 가져오기 실패: {e}")
        return None

# -----------------------------
# Sonar (Perplexity) 호출
# -----------------------------
# ---------- 교체: Sonar 호출 ----------
def ask_sonar_from_comment(raw_text, source_name=""):
    """
    입력 텍스트(고정댓글/더보기란/자막)에서 메뉴/재료/순서를 JSON으로 추출.
    순서가 비어 있으면 '분석 불가'로 간주하여 다음 소스로 넘어가도록 설계.
    """
    headers = {
        "Authorization": f"Bearer {SONAR_API_KEY}",
        "Content-Type": "application/json"
    }

    prefix = {
        "고정댓글": "이 텍스트는 유튜브 요리 영상의 고정 댓글입니다.",
        "더보기란": "이 텍스트는 유튜브 영상의 더보기란(설명) 입니다.",
        "자막": (
            "이 텍스트는 유튜브 영상의 자막입니다. "
            "잡담/광고/인트로/아웃트로/브랜드 멘트는 제외하고 **요리 과정**만 추려서 순서를 만드세요. "
            "가능하면 명령형 동사(썰다, 볶다, 끓이다 등) 기준으로 3~12단계로 나누세요."
        )
    }.get(source_name, "")

    prompt = f"""{prefix}

다음 텍스트에서 **메인 메뉴 이름**, **재료(중복 제거)**, **단계별 요리 순서**를 JSON 형식으로만 출력하세요.

요구사항:
- 메뉴/재료/순서 3개의 키를 반드시 포함하세요.
- 순서는 각 단계가 1문장 내로 간결해야 합니다. 불필요한 설명/광고/링크는 제거하세요.
- 텍스트가 제품 홍보/광고 위주라 레시피가 없으면 "분석 불가"라고만 답하세요.

형식:
{{
  "메뉴": "메뉴 이름",
  "재료": ["재료1", "재료2", ...],
  "순서": ["단계1", "단계2", ...]
}}

텍스트:
{sanitize(raw_text)}
"""

    payload = {
        "model": "sonar-reasoning-pro",
        "messages": [
            {"role": "system", "content": "넌 요리 영상 분석 전문가야."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.2,
        "search": False
    }

    resp = requests.post("https://api.perplexity.ai/chat/completions", headers=headers, json=payload)
    if resp.status_code != 200 or not resp.content.strip():
        safe_print(f"❌ Sonar 응답 실패: {resp.status_code}")
        return None

    try:
        return sanitize(resp.json()["choices"][0]["message"]["content"])
    except Exception as e:
        safe_print(f"❌ Sonar JSON 파싱 실패: {e}")
        return None

# -----------------------------
# ✅ api_server.py 가 import 하는 핵심 함수
# -----------------------------
def analyze_one_video(url: str) -> dict:
    """
    우선순위: 고정댓글(작성자=채널) → 더보기란 → 자막
    '메뉴','재료','순서'를 모두 포함하는 JSON이 나오는 첫 소스를 채택.
    """
    try:
        m = re.search(r"(?:v=|youtu\.be/)([A-Za-z0-9_-]{11})", url)
        if not m:
            return {"ok": False, "error": "영상 URL에서 videoId 추출 실패"}
        video_id = m.group(1)

        youtube = build("youtube", "v3", developerKey=API_KEY)
        vr = youtube.videos().list(part="snippet", id=video_id).execute()
        if not vr.get("items"):
            return {"ok": False, "error": "영상 정보를 찾을 수 없음"}

        snip = vr["items"][0]["snippet"]
        uploader_name = snip["channelTitle"]
        uploader_id   = snip["channelId"]
        upload_date   = snip["publishedAt"][:10]
        video_url     = f"https://youtu.be/{video_id}"

        # ---- 후보 텍스트 수집
        # 1) 고정댓글(=상단댓글) + 채널 주인 여부
        comment_text, author_ch, _ = get_first_comment_and_author(API_KEY, video_id)
        comment_text = comment_text if (author_ch and author_ch == uploader_id) else None

        # 2) 더보기란
        desc_text = get_description(youtube, video_id)

        # 3) 자막
        transcript_text = get_transcript(video_id)

        # 우선순위: 고정댓글 → 더보기란 → 자막
        sources = [
            ("고정댓글", comment_text),
            ("더보기란",  desc_text),
            ("자막",     transcript_text),
        ]

        for source_name, text in sources:
            if not text or not text.strip():
                continue

            raw = ask_sonar_from_comment(text, source_name)
            if not raw:
                continue
            parsed = extract_json_block(raw)
            if not parsed:
                continue

            return {
                "ok": True,
                "result": {
                    "name": parsed["메뉴"],
                    "ingredients": parsed["재료"],
                    "steps": parsed["순서"],      # ✅ 요리 순서 포함
                    "source": source_name,
                    "uploader": uploader_name,
                    "upload_date": upload_date,
                    "video_url": video_url,
                }
            }

        return {"ok": False, "error": "분석 실패: 고정댓글/더보기란/자막 어디에도 레시피가 없음"}

    except Exception as e:
        return {"ok": False, "error": str(e)}

# -----------------------------
# 모듈 단독 실행 체크(선택)
# -----------------------------
if __name__ == "__main__":
    safe_print("✅ youtube_automation.py 로드 완료 (analyze_one_video 포함)")
