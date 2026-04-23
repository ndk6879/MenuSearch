import os
import re
import sys
import json
import logging
import socket
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from dotenv import load_dotenv

from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import google.generativeai as genai
from google import genai as genai_new
from google.genai import types as genai_types

# -----------------------------
# 로깅 / 유틸
# -----------------------------
socket.setdefaulttimeout(120)

# IPv6가 막힌 네트워크에서 httplib2가 IPv6를 먼저 시도해 타임아웃 나는 문제 방지
_orig_getaddrinfo = socket.getaddrinfo
def _ipv4_first(host, port, family=0, type=0, proto=0, flags=0):
    results = _orig_getaddrinfo(host, port, family, type, proto, flags)
    ipv4 = [r for r in results if r[0] == socket.AF_INET]
    ipv6 = [r for r in results if r[0] != socket.AF_INET]
    return ipv4 + ipv6 if ipv4 else ipv6
socket.getaddrinfo = _ipv4_first

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

# ✅ Gemini 설정 (영상 직접 분석용)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or API_KEY
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


# -----------------------------
# 공용 헬퍼
# -----------------------------
def extract_json_block(text):
    try:
        # 마크다운 코드블록 제거 (```json ... ```)
        text = re.sub(r"```(?:json)?\s*", "", text)

        # 중괄호 depth 추적으로 첫 번째 완전한 JSON 객체만 추출
        start = text.find('{')
        if start == -1:
            return None
        depth = 0
        json_str = None
        for i, c in enumerate(text[start:], start):
            if c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    json_str = text[start:i+1]
                    break
        if not json_str:
            return None
        parsed = json.loads(json_str)

        # '메뉴', '재료', '순서' 모두 존재해야 유효
        if all(k in parsed for k in ("메뉴", "재료", "순서")):
            steps = parsed["순서"]
            if isinstance(steps, list):
                # 앞에 붙은 기존 번호("1. ", "2) " 등) 제거 — 프론트 <ol>이 번호를 붙임
                cleaned = []
                for s in steps:
                    s = str(s).strip()
                    if s:
                        cleaned.append(re.sub(r"^\d+[\.\)\-]\s*", "", s))
                parsed["순서"] = cleaned
            else:
                parsed["순서"] = [str(steps).strip()]
            return parsed
    except Exception as e:
        safe_print(f"❌ JSON 파싱 실패: {e}")
    return None


def extract_json_blocks(text):
    """배열([...]) 또는 단일 객체({...}) 형식 모두 처리. 레시피 dict 리스트 반환."""
    try:
        text_clean = re.sub(r"```(?:json)?\s*", "", text)
        bracket_start = text_clean.find('[')
        brace_start = text_clean.find('{')

        if bracket_start != -1 and (brace_start == -1 or bracket_start < brace_start):
            depth, end = 0, -1
            for i, c in enumerate(text_clean[bracket_start:], bracket_start):
                if c == '[': depth += 1
                elif c == ']':
                    depth -= 1
                    if depth == 0:
                        end = i
                        break
            if end != -1:
                try:
                    parsed = json.loads(text_clean[bracket_start:end + 1])
                    if isinstance(parsed, list):
                        results = []
                        for item in parsed:
                            if isinstance(item, dict) and all(k in item for k in ("메뉴", "재료", "순서")):
                                steps = item["순서"]
                                item["순서"] = (
                                    [re.sub(r"^\d+[\.\)\-]\s*", "", str(s).strip()) for s in steps if str(s).strip()]
                                    if isinstance(steps, list) else [str(steps).strip()]
                                )
                                results.append(item)
                        if results:
                            return results
                except Exception as e:
                    safe_print(f"❌ 배열 JSON 파싱 실패: {e}")

        single = extract_json_block(text)
        return [single] if single else []
    except Exception as e:
        safe_print(f"❌ extract_json_blocks 실패: {e}")
        return []


def get_existing_urls(file_path="src/menuData_kr.js"):
    if not os.path.exists(file_path):
        return set()
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
        urls = re.findall(r'"url":\s*"([^"]+)"', content)
        return set(urls)

def get_existing_url_name_pairs(file_path="src/menuData_kr.js"):
    """저장된 (url, name) 쌍을 반환 — 같은 영상의 다른 메뉴 중복 방지용"""
    if not os.path.exists(file_path):
        return set()
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    pairs = set()
    for block in re.findall(r"\{[\s\S]*?\}", content):
        try:
            data = json.loads(block)
            if data.get("url") and data.get("name"):
                pairs.add((data["url"], data["name"]))
        except Exception:
            continue
    return pairs

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

def remove_from_js(video_url, file_path="src/menuData_kr.js"):
    """menuData_kr.js에서 특정 URL의 항목을 제거"""
    if not os.path.exists(file_path):
        return
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # JSON 항목들을 찾아서 해당 URL 항목 제거
    lines = content.splitlines()
    new_lines = []
    skip = False
    brace_depth = 0
    for line in lines:
        if not skip:
            # 새 JSON 객체 시작 감지 (배열 선언 줄이 아닌 { 로 시작하는 줄)
            stripped = line.strip()
            if stripped.startswith('{') and 'const ' not in line and 'export ' not in line:
                # 이 항목에 해당 URL이 있는지 미리 확인
                # brace가 닫힐 때까지 모아서 체크
                block_lines = [line]
                brace_depth = line.count('{') - line.count('}')
                if brace_depth > 0:
                    skip = True
                    continue
                else:
                    # 한 줄짜리 JSON
                    block = '\n'.join(block_lines)
                    if f'"url": "{video_url}"' not in block and f'"url":"{video_url}"' not in block:
                        new_lines.append(line)
                    else:
                        safe_print(f"🗑️ 기존 항목 제거: {video_url}")
                    continue
            new_lines.append(line)
        else:
            block_lines.append(line)
            brace_depth += line.count('{') - line.count('}')
            if brace_depth <= 0:
                skip = False
                block = '\n'.join(block_lines)
                if f'"url": "{video_url}"' not in block and f'"url":"{video_url}"' not in block:
                    new_lines.extend(block_lines)
                else:
                    safe_print(f"🗑️ 기존 항목 제거: {video_url}")
                    # 다음 줄이 쉼표로 시작하면 그것도 제거
                block_lines = []

    with open(file_path, "w", encoding="utf-8") as f:
        f.write('\n'.join(new_lines))


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
                    if data.get("url") == entry["url"] and data.get("name") == entry["name"]:
                        safe_print("⚠️ 이미 저장된 URL+메뉴 → 추가 생략")
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
# Gemini 영상 직접 분석 (자막 스크래핑 대체)
# -----------------------------
def analyze_video_with_gemini(video_id: str):
    """
    Gemini API에 YouTube URL을 직접 전달하여 영상을 보고+듣고 레시피를 추출.
    자막 스크래핑 없이 영상 자체를 분석하므로 IP 차단 문제가 없음.
    """
    if not GEMINI_API_KEY:
        safe_print("❌ GEMINI_API_KEY 없음 → 영상 분석 불가")
        return None

    video_url = f"https://www.youtube.com/watch?v={video_id}"
    safe_print(f"🎬 [영상 분석] Gemini에 YouTube 영상 직접 분석 요청 중...")

    prompt = """이 유튜브 영상을 처음부터 끝까지 시청하고 **메뉴 이름**, **재료(중복 제거)**, **단계별 요리 순서**를 JSON 형식으로만 출력하세요.

🍽️ 요리 개수 규칙:
- 영상에 **2가지 이상의 독립된 요리**가 소개되면 각 요리를 별도 객체로 만들어 **JSON 배열**로 반환하세요.
  예: [{"메뉴": "요리1", "재료": [...], "순서": [...]}, {"메뉴": "요리2", "재료": [...], "순서": [...]}]
- 요리가 1가지라면 배열 없이 단일 객체로 반환하세요.

⚠️ 중요 규칙:
- **실제 조리에 직접 투입된 재료만** 추출하세요. 협찬/광고 제품, 언급만 되고 사용하지 않은 재료, "대신 써도 된다"는 대안 재료, 배경/소품은 제외하세요.
- 재료는 영상에서 사용하는 **모든** 재료를 빠짐없이 포함하세요: 주재료, 양념(소금, 후추, 설탕 등), 소스(간장, 굴소스 등), 오일, 물, 가루류 등 아무리 소량이라도 포함.
- 재료는 **이름만** 적으세요. 용량/수량은 제외 (예: "소금 1큰술" → "소금", "계란 3개" → "계란", "대파 1/2대" → "대파").
- 재료명 표기 통일 (동의어만, 구체적 부위명은 그대로 유지):
  - 올리브오일/콩피오일 → "올리브 오일"
  - 고추가루/고운고춧가루/굵은 고추가루 → "고춧가루"
  - 국간장/진간장/양조간장/맛간장/백간장 → "간장"
  - 통후추/후추가루/후춧가루 → "후추"
  - 무염버터/무염 버터/기버터 → "버터"
  - 파마산치즈/파마산 치즈 가루 → "파마산 치즈"
  - 양송이버섯/양송이 → "양송이 버섯"
  - 표고버섯 → "표고 버섯", 팽이버섯 → "팽이 버섯", 느타리버섯 → "느타리 버섯"
  - 계란 노른자/감동란/반숙란 → "계란"
  - 깨소금/볶은깨 → "깨"
  - 이탈리안 파슬리 → "파슬리"
  - 화이트와인 → "화이트 와인"
  - 맛소금 → "소금"
  - 주의: 삼겹살/목살/닭가슴살/닭다리 등 구체적 부위명은 그대로 유지하세요.
  - 주의: 크림치즈/페타치즈/부라타치즈 등 치즈 종류도 그대로 유지하세요.
- 재료 정렬: 주재료(육류/해산물/채소) → 양념/소스 → 기타(오일/물/가루 등) 카테고리 순서로 나열하세요.
- **요리 순서는 반드시 3단계 이상 추출해야 합니다.** 더보기란이나 댓글에 없더라도 영상을 직접 보고 요리 과정을 파악해서 단계를 작성하세요.
- 영상에 자막이 없어도 화면에 보이는 조리 동작(재료 손질 → 볶기/끓이기 → 플레이팅 등)을 기반으로 순서를 구성하세요.
- 순서는 각 단계가 1문장 내로 간결하게 (명령형 동사 사용: 썰다, 볶다, 끓이다 등).
- 잡담/광고/인트로/아웃트로는 제외하세요.
- 요리 영상이 아니면 "분석 불가"라고만 답하세요.

형식:
{
  "메뉴": "메뉴 이름",
  "재료": ["주재료1", "주재료2", ..., "양념1", "양념2", ..., "기타1", ...],
  "순서": ["단계1", "단계2", ...]
}"""

    try:
        client = genai_new.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                genai_types.Part(
                    file_data=genai_types.FileData(file_uri=video_url)
                ),
                prompt,
            ],
        )
        result_text = sanitize(response.text)
        safe_print(f"✅ [영상 분석] Gemini 응답 수신 ({len(result_text)}자)")
        return result_text
    except Exception as e:
        safe_print(f"❌ [영상 분석] Gemini 영상 분석 실패: {e}")
        return None


def get_first_comment_and_author(api_key, video_id):
    youtube = build("youtube", "v3", developerKey=api_key)

    # ▶ 동영상의 채널 ID 가져오기
    v = youtube.videos().list(part="snippet", id=video_id).execute()
    items = v.get("items", [])
    video_channel_id = items[0]["snippet"]["channelId"] if items else None

    # ▶ 상단(고정댓글 우선) 1개만 조회
    try:
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
    except HttpError as e:
        if "commentsDisabled" in str(e):
            safe_print("⏭️ 댓글 비활성화된 영상 → 고정댓글 스킵")
        else:
            safe_print(f"⚠️ 댓글 조회 실패: {e}")

    return None, None, video_channel_id


def get_description(youtube, video_id):
    try:
        response = youtube.videos().list(part="snippet", id=video_id).execute()
        return response["items"][0]["snippet"]["description"]
    except Exception as e:
        safe_print(f"❌ 더보기란 가져오기 실패: {e}")
        return None

# -----------------------------
# Gemini 텍스트 분석 (고정댓글/더보기란)
# -----------------------------
def ask_gemini_from_text(raw_text, source_name=""):
    """
    입력 텍스트(고정댓글/더보기란)에서 메뉴/재료/순서를 JSON으로 추출.
    Gemini 2.5 Flash 사용 (영상 분석보다 훨씬 저렴, ~0.4원/회).
    """
    if not GEMINI_API_KEY:
        safe_print("❌ GEMINI_API_KEY 없음 → 텍스트 분석 불가")
        return None

    prefix = {
        "고정댓글": "이 텍스트는 유튜브 요리 영상의 고정 댓글입니다.",
        "더보기란": (
            "이 텍스트는 유튜브 영상의 더보기란(설명)입니다. "
            "더보기란에는 협찬/홍보/SNS 링크/구독 요청 등 레시피와 무관한 내용이 있을 수 있습니다. "
            "재료 목록이나 요리 순서가 있으면 최대한 추출하세요. "
            "협찬/SNS 링크/구독 요청 등 레시피와 완전히 무관한 내용은 무시하세요. "
            "재료나 순서가 전혀 없을 때만 빈 배열 []로 두세요."
        ),
        "자막": (
            "이 텍스트는 유튜브 요리 영상의 자막(스크립트)입니다. "
            "잡담/광고/인트로/아웃트로/브랜드 멘트는 제외하고 **요리 과정**만 추려서 순서를 만드세요. "
            "가능하면 명령형 동사(썰다, 볶다, 끓이다 등) 기준으로 3~12단계로 나누세요."
        )
    }.get(source_name, "")

    prompt = f"""{prefix}

다음 텍스트에서 **메인 메뉴 이름**, **재료(중복 제거)**, **단계별 요리 순서**를 JSON 형식으로만 출력하세요.

⚠️ 중요 규칙:
- 텍스트에 **명시적으로 적혀 있는** 재료와 순서만 추출하세요.
- 절대로 추측하거나 일반 상식으로 재료/순서를 지어내지 마세요.
- 재료가 텍스트에 나열되어 있지 않으면 "재료": [] (빈 배열)로 하세요.
- 요리 순서/과정이 텍스트에 설명되어 있지 않으면 "순서": [] (빈 배열)로 하세요.
- 메뉴/재료/순서 3개의 키를 반드시 포함하세요.
- 재료는 양념(소금, 후추, 간장 등), 오일, 물 등 소량 재료도 빠짐없이 포함하세요.
- 재료는 **이름만** 적으세요. 용량/수량은 제외 (예: "소금 1큰술" → "소금", "계란 3개" → "계란", "대파 1/2대" → "대파").
- 재료명 표기 통일 (동의어만, 구체적 부위명은 그대로 유지):
  - 올리브오일/콩피오일 → "올리브 오일"
  - 고추가루/고운고춧가루/굵은 고추가루 → "고춧가루"
  - 국간장/진간장/양조간장/맛간장/백간장 → "간장"
  - 통후추/후추가루/후춧가루 → "후추"
  - 무염버터/무염 버터/기버터 → "버터"
  - 파마산치즈/파마산 치즈 가루 → "파마산 치즈"
  - 양송이버섯/양송이 → "양송이 버섯"
  - 표고버섯 → "표고 버섯", 팽이버섯 → "팽이 버섯", 느타리버섯 → "느타리 버섯"
  - 계란 노른자/감동란/반숙란 → "계란"
  - 깨소금/볶은깨 → "깨"
  - 이탈리안 파슬리 → "파슬리"
  - 화이트와인 → "화이트 와인"
  - 맛소금 → "소금"
  - 주의: 삼겹살/목살/닭가슴살/닭다리 등 구체적 부위명은 그대로 유지하세요.
  - 주의: 크림치즈/페타치즈/부라타치즈 등 치즈 종류도 그대로 유지하세요.
- 재료 정렬: 주재료(육류/해산물/채소) → 양념/소스 → 기타(오일/물/가루 등) 카테고리 순서로 나열하세요.
- 순서는 각 단계가 1문장 내로 간결해야 합니다. 불필요한 설명/광고/링크는 제거하세요.
- 텍스트가 제품 홍보/광고 위주이거나 요리와 관련 없으면 "분석 불가"라고만 답하세요.

형식:
{{
  "메뉴": "메뉴 이름",
  "재료": ["주재료1", "주재료2", ..., "양념1", "양념2", ..., "기타1", ...],
  "순서": ["단계1", "단계2", ...]
}}

텍스트:
{sanitize(raw_text)}
"""

    try:
        client = genai_new.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[prompt],
        )
        return sanitize(response.text)
    except Exception as e:
        safe_print(f"❌ Gemini 텍스트 분석 실패: {e}")
        return None

# -----------------------------
# ✅ api_server.py 가 import 하는 핵심 함수
# -----------------------------
def analyze_one_video(url: str) -> dict:
    """
    고정댓글/더보기란/영상 직접 분석을 병렬로 실행 후 최적 결과 조합.
    다중 요리가 감지되면 results 배열에 각각 반환 (사용자가 저장 전 확인).
    반환 형식: {"ok": True, "results": [...]} 또는 {"ok": False, "error": "..."}
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

        # ---- 후보 텍스트 수집 (빠른 YouTube Data API 호출 — 순차)
        comment_text, author_ch, _ = get_first_comment_and_author(API_KEY, video_id)
        comment_text = comment_text if (author_ch and author_ch == uploader_id) else None
        desc_text = get_description(youtube, video_id)

        def is_valid(items):
            if not items:
                return False
            return not any("분석 불가" in str(x) for x in items)

        def parse_text_source(raw, source_name):
            """Gemini 텍스트 응답을 파싱해서 유효한 결과 반환. 실패시 None."""
            if not raw:
                return None
            if "분석 불가" in raw and "{" not in raw and "[" not in raw:
                safe_print(f"⏭️ [{source_name}] 분석 불가 → 스킵")
                return None
            parsed = extract_json_block(raw)
            if not parsed:
                safe_print(f"⏭️ [{source_name}] JSON 파싱 실패 | 응답: {raw[:150]}")
                return None
            if parsed["메뉴"] in ["분석 불가", "Only 제품 설명 OR 홍보"]:
                safe_print(f"⏭️ [{source_name}] 메뉴='{parsed['메뉴']}' → 스킵")
                return None
            ing_count = len(parsed["재료"]) if is_valid(parsed["재료"]) else 0
            step_count = len(parsed["순서"]) if is_valid(parsed["순서"]) else 0
            if ing_count == 0 and step_count == 0:
                safe_print(f"⏭️ [{source_name}] 재료·순서 모두 비어있음 → 스킵")
                return None
            safe_print(f"✅ [{source_name}] 메뉴={parsed['메뉴']}, 재료={ing_count}개, 순서={step_count}단계")
            return parsed

        all_results = {}
        multi_dish_results = []

        # ---- 텍스트 소스 수집
        text_sources = {}
        if comment_text and comment_text.strip():
            text_sources["고정댓글"] = comment_text
        else:
            safe_print("⏭️ [고정댓글] 텍스트 없음 → 스킵")
        if desc_text and desc_text.strip():
            text_sources["더보기란"] = desc_text
        else:
            safe_print("⏭️ [더보기란] 텍스트 없음 → 스킵")

        # ---- 텍스트 분석 + 영상 분석 병렬 실행 (항상)
        safe_print(f"🔍 텍스트 분석 + 영상 분석 병렬 시작...")
        with ThreadPoolExecutor(max_workers=3) as executor:
            text_futures = {
                name: executor.submit(ask_gemini_from_text, text, name)
                for name, text in text_sources.items()
            }
            video_future = executor.submit(analyze_video_with_gemini, video_id)

            for name, future in text_futures.items():
                parsed = parse_text_source(future.result(), name)
                if parsed:
                    all_results[name] = parsed

            video_raw = video_future.result()

        # ---- 영상 분석 결과 처리
        if video_raw:
            parsed_list = extract_json_blocks(video_raw)
            valid = [p for p in parsed_list if p.get("메뉴") not in ["분석 불가", "Only 제품 설명 OR 홍보"]]
            if len(valid) > 1:
                for p in valid:
                    safe_print(f"✅ [영상 분석] {p['메뉴']}: 재료={len(p['재료'])}개, 순서={len(p['순서'])}단계")
                multi_dish_results = valid
            elif len(valid) == 1:
                p = valid[0]
                safe_print(f"✅ [영상 분석] 메뉴={p['메뉴']}, 재료={len(p['재료'])}개, 순서={len(p['순서'])}단계")
                all_results["영상 분석"] = p
            else:
                safe_print("⏭️ [영상 분석] JSON 파싱 실패 또는 분석 불가")
        else:
            safe_print("⏭️ [영상 분석] 응답 없음")

        # ---- 다중 요리: 각각 반환 (저장 전 사용자 확인)
        if multi_dish_results:
            safe_print(f"🍽️ 다중 요리 {len(multi_dish_results)}개 감지 → 각각 반환")
            return {
                "ok": True,
                "results": [
                    {
                        "name": p["메뉴"],
                        "ingredients": p["재료"] if is_valid(p["재료"]) else [],
                        "ingredients_source": "영상 분석",
                        "steps": p["순서"] if is_valid(p["순서"]) else [],
                        "steps_source": "영상 분석",
                        "source": "영상 분석",
                        "uploader": uploader_name,
                        "upload_date": upload_date,
                        "video_url": video_url,
                    }
                    for p in multi_dish_results
                ],
            }

        if not all_results:
            return {"ok": False, "error": "분석 실패: 어떤 소스에서도 레시피를 찾지 못했습니다."}

        # ---- 단일 요리: 재료·순서 선택 로직
        video_result = all_results.get("영상 분석")

        # 텍스트에서 가장 재료가 많은 소스 선택
        best_text_ingredients = None
        best_text_source = None
        best_text_name = None
        for src in ["고정댓글", "더보기란"]:
            if src not in all_results:
                continue
            p = all_results[src]
            if is_valid(p["재료"]) and len(p["재료"]) > (len(best_text_ingredients) if best_text_ingredients else 0):
                best_text_ingredients = p["재료"]
                best_text_source = src
                best_text_name = p["메뉴"]

        # 재료 선택: 텍스트 5개 이상이면 텍스트(크리에이터 작성 = 정확), 미만이면 영상
        TEXT_ING_THRESHOLD = 5
        if best_text_ingredients and len(best_text_ingredients) >= TEXT_ING_THRESHOLD:
            best_ingredients = best_text_ingredients
            best_ingredients_source = best_text_source
            best_name = best_text_name
            safe_print(f"📋 [재료] 텍스트({best_text_source}) 채택: {len(best_text_ingredients)}개 ≥ {TEXT_ING_THRESHOLD}개 기준")
        elif video_result and is_valid(video_result["재료"]):
            best_ingredients = video_result["재료"]
            best_ingredients_source = "영상 분석"
            best_name = video_result["메뉴"]
            safe_print(f"🎬 [재료] 영상 분석 채택: 텍스트 재료 {len(best_text_ingredients) if best_text_ingredients else 0}개 < {TEXT_ING_THRESHOLD}개 기준")
        elif best_text_ingredients:
            best_ingredients = best_text_ingredients
            best_ingredients_source = best_text_source
            best_name = best_text_name
            safe_print(f"📋 [재료] 텍스트({best_text_source}) fallback: 영상 분석 재료 없음")
        else:
            best_ingredients = None
            best_ingredients_source = None
            best_name = None

        # 순서 선택: 항상 영상 우선, 없으면 텍스트 fallback
        best_steps = None
        best_steps_source = None
        if video_result and is_valid(video_result["순서"]) and len(video_result["순서"]) >= 1:
            best_steps = video_result["순서"]
            best_steps_source = "영상 분석"
            safe_print(f"🎬 [순서] 영상 분석 채택: {len(best_steps)}단계")
        else:
            for src in ["고정댓글", "더보기란"]:
                if src in all_results and is_valid(all_results[src]["순서"]) and len(all_results[src]["순서"]) >= 1:
                    if not best_steps or len(all_results[src]["순서"]) > len(best_steps):
                        best_steps = all_results[src]["순서"]
                        best_steps_source = src
            if best_steps:
                safe_print(f"📋 [순서] 텍스트({best_steps_source}) fallback: {len(best_steps)}단계")

        # 메뉴명: 영상 분석 우선
        if not best_name:
            if video_result:
                best_name = video_result.get("메뉴")
            if not best_name:
                best_name = list(all_results.values())[0]["메뉴"]

        if best_steps_source:
            safe_print(f"🎯 최종 → 재료: {best_ingredients_source}({len(best_ingredients) if best_ingredients else 0}개) / 순서: {best_steps_source}({len(best_steps)}단계)")

        if not best_name:
            best_name = list(all_results.values())[0]["메뉴"]

        if best_ingredients or best_steps:
            source_label = best_ingredients_source or best_steps_source or ""
            if best_ingredients_source and best_steps_source and best_steps_source != best_ingredients_source:
                source_label = f"재료:{best_ingredients_source} / 순서:{best_steps_source}"

            return {
                "ok": True,
                "results": [{
                    "name": best_name,
                    "ingredients": best_ingredients or [],
                    "ingredients_source": best_ingredients_source or "",
                    "steps": best_steps or [],
                    "steps_source": best_steps_source or "",
                    "source": source_label,
                    "uploader": uploader_name,
                    "upload_date": upload_date,
                    "video_url": video_url,
                }],
            }

        return {"ok": False, "error": "분석 실패: 어떤 소스에서도 레시피를 찾지 못했습니다."}

    except Exception as e:
        return {"ok": False, "error": str(e)}

# -----------------------------
# 모듈 단독 실행 체크(선택)
# -----------------------------
if __name__ == "__main__":
    safe_print("✅ youtube_automation.py 로드 완료 (analyze_one_video 포함)")
