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
from groq import Groq as GroqClient
from youtube_transcript_api import YouTubeTranscriptApi

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

# ✅ Gemini 설정 (영상 직접 분석 fallback용)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or API_KEY
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# ✅ Groq 설정 (텍스트 분석 — 무료)
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
_groq_client = GroqClient(api_key=GROQ_API_KEY) if GROQ_API_KEY else None


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

def _block_matches(block, video_url, name=None):
    url_match = (f'"url": "{video_url}"' in block or f'"url":"{video_url}"' in block)
    if not url_match:
        return False
    if name:
        return (f'"name": "{name}"' in block or f'"name":"{name}"' in block)
    return True

def get_recipe_by_url(video_url, file_path="src/menuData_kr.js"):
    """URL로 저장된 레시피 데이터 반환. 없으면 None."""
    if not os.path.exists(file_path):
        return None
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
    blocks = re.findall(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)?\}', content, re.DOTALL)
    for block in blocks:
        try:
            data = json.loads(block)
            if data.get("url") == video_url:
                return data
        except Exception:
            continue
    return None


def remove_from_js(video_url, name=None, file_path="src/menuData_kr.js"):
    """menuData_kr.js에서 특정 URL(+이름) 항목을 제거 — 첫 번째 매치 1건만 삭제"""
    if not os.path.exists(file_path):
        return
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    lines = content.splitlines()
    new_lines = []
    skip = False
    brace_depth = 0
    deleted = False

    for line in lines:
        if not skip:
            stripped = line.strip()
            if stripped.startswith('{') and 'const ' not in line and 'export ' not in line:
                block_lines = [line]
                brace_depth = line.count('{') - line.count('}')
                if brace_depth > 0:
                    skip = True
                    continue
                else:
                    block = '\n'.join(block_lines)
                    if not deleted and _block_matches(block, video_url, name):
                        safe_print(f"🗑️ 기존 항목 제거: {video_url}")
                        deleted = True
                    else:
                        new_lines.append(line)
                    continue
            new_lines.append(line)
        else:
            block_lines.append(line)
            brace_depth += line.count('{') - line.count('}')
            if brace_depth <= 0:
                skip = False
                block = '\n'.join(block_lines)
                if not deleted and _block_matches(block, video_url, name):
                    safe_print(f"🗑️ 기존 항목 제거: {video_url}")
                    deleted = True
                else:
                    new_lines.extend(block_lines)
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
- **같은 요리라도 재료나 방식이 달라 다른 결과물이 되는 버전(업그레이드, 변형, 응용)도 별도 객체로 분리하세요.**
  예: 기본 카레와 코코넛밀크 추가 버전 → 두 객체로 분리
- 버전이 여러 개일 때 메뉴명에 구분자를 붙이세요.
  예: "봉골레 파스타 (기본)", "봉골레 파스타 (사프란 버전)"
  예: "닭갈비 (기본)", "닭갈비 (치즈 추가)"
- 요리가 1가지(변형 없이)라면 배열 없이 단일 객체로 반환하세요.

⚠️ 중요 규칙:
- **화면에서 크리에이터가 직접 사용하거나 "넣는다/추가한다"고 명시적으로 말한 재료만** 포함하세요.
- 화면에 보이지 않거나 불확실한 재료, "써도 된다/대신 쓸 수 있다"는 대안 재료, 협찬/광고 제품, 배경 소품은 절대 추가하지 마세요.
- 이 요리에 대한 사전 지식이나 일반 레시피 정보를 사용하지 마세요. **누락이 오류보다 낫습니다.**
- 소금·후추·오일 등 소량이라도 실제 사용이 확인된 것은 포함하세요.
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

- **요리에 필요한 모든 단계를 빠짐없이 추출하세요.** 단계 수는 요리의 복잡도에 따라 자연스럽게 결정됩니다. 더보기란이나 댓글에 없더라도 영상을 직접 보고 파악하세요.
- 영상에 자막이 없어도 화면에 보이는 조리 동작(재료 손질 → 볶기/끓이기 → 플레이팅 등)을 기반으로 순서를 구성하세요.
- 연결된 동작이나 같은 맥락에서 자연스럽게 이어지는 행동은 하나의 단계로 묶으세요. 불필요한 세분화로 단계 수를 늘리지 마세요.
- 순서는 각 단계를 1~2문장으로 작성하세요. 영상에서 언급된 온도·시간·양·핵심 포인트가 있으면 반드시 그대로 포함하세요 (예: "180도로 예열한 오븐에 10분 굽습니다", "약불에서 저으면서 3분 볶습니다"). 단순 동사 하나("데치기", "마무리")만 쓰지 마세요.
- "마무리", "완성", "플레이팅" 같은 의미 없는 단계는 금지하세요. 실제 동작이 있을 때만 단계로 포함하세요.
- 잡담/광고/인트로/아웃트로는 제외하세요.
- 반드시 크리에이터가 직접 요리하는 과정을 보여주는 영상만 분석하세요. 레스토랑 방문/소개, 음식점에서 주문해 먹는 영상, 음식 리뷰, 먹방, 식당 투어는 요리 영상이 아닙니다.
- 요리 영상이 아니면 "분석 불가 (레스토랑 소개/먹방/음식 리뷰 등 직접 요리하지 않는 영상)"라고만 답하세요.

💡 크리에이터 TIP 규칙:
- 영상에서 크리에이터가 직접 강조하거나 말하는 요리 팁/노하우/주의사항을 먼저 추출하세요.
- 크리에이터 팁이 3개 미만이면, 이 요리에 실제로 도움이 되는 일반 요리 팁으로 나머지를 채우세요. 단, 이미 추출한 팁과 내용이 겹치지 않아야 합니다.
- 최대 3개까지만 반환하세요. 영상에서 팁으로 쓸 만한 말이 있으면 포함하되, 억지로 늘리지 마세요.
- 문장은 짧게 쓰되 핵심 디테일(온도, 타이밍, 주의사항 등)은 빠뜨리지 마세요.

🏷️ 태그 및 분량 규칙:
- servings: 크리에이터가 영상에서 분량을 언급하면 그대로 사용하세요 (예: "2인분", "4인분"). 언급이 없으면 재료 양·냄비 크기·완성 접시 수 등 시각적 단서로 추론하세요.
- tags: 해당하는 항목만 골라 배열로 반환하세요. 확실한 것만, 억지로 넣지 마세요.
  - 분량: "1인분", "2인분", "3~4인분", "파티용"
  - 음식 종류: "밥", "면류", "파스타", "고기", "해산물", "샐러드", "국물요리"
  - 조리 특성: "30분 이내", "초보 가능", "재료해치우기", "밀프랩/도시락", "에어프라이어", "오븐"
  - 상황: "다이어트", "술안주", "단백질", "브런치", "야식", "아이반찬", "손님상"
  - 기준:
    - "30분 이내": 전체 조리 시간이 30분 이하
    - "초보 가능": 크리에이터가 쉽다고 하거나 조리 난이도가 낮음
    - "재료해치우기": 냉장고 남은 재료 활용 스타일 (비빔밥, 볶음밥, 프리타타 등)
    - "국물요리": 국·찌개·탕·전골 모두 포함
  - 주의: 서로 상충하는 태그(예: "30분 이내"이면서 동시에 "손님상"처럼 어색한 조합)는 가장 맞는 것 하나만 선택하세요

형식:
{
  "메뉴": "메뉴 이름",
  "재료": ["주재료1", "주재료2", ..., "양념1", "양념2", ..., "기타1", ...],
  "순서": ["단계1", "단계2", ...],
  "tips": ["팁1", "팁2", ...],
  "servings": "2인분",
  "tags": ["2인분", "간단요리"]
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


# -----------------------------
# 프레임 추출 + Supabase Storage 업로드
# -----------------------------
def get_best_thumbnail_url(video_id: str) -> str:
    """YouTube 최고화질 썸네일 URL 반환 (완성 요리 사진용)"""
    import requests as req
    for quality in ["maxresdefault", "sddefault", "hqdefault"]:
        url = f"https://img.youtube.com/vi/{video_id}/{quality}.jpg"
        try:
            r = req.head(url, timeout=5)
            size = int(r.headers.get("content-length", 0))
            if r.status_code == 200 and size > 10000:
                return url
        except Exception:
            continue
    return f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"


def _timestamp_to_seconds(ts: str) -> float:
    parts = ts.strip().split(":")
    if len(parts) == 3:
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
    elif len(parts) == 2:
        return int(parts[0]) * 60 + float(parts[1])
    return float(parts[0])


def _fetch_subtitles(video_id: str) -> list:
    """yt-dlp로 YouTube 자동자막(ko) 다운로드 후 파싱. [{start_sec, text}, ...] 반환."""
    import subprocess, tempfile, os, re
    video_url = f"https://www.youtube.com/watch?v={video_id}"
    with tempfile.TemporaryDirectory() as tmp:
        out_tmpl = os.path.join(tmp, "%(id)s")
        try:
            subprocess.run([
                "yt-dlp", "--write-auto-sub", "--sub-lang", "ko",
                "--sub-format", "vtt", "--skip-download",
                "--cookies-from-browser", "chrome",
                "-o", out_tmpl, video_url,
            ], capture_output=True, timeout=30)
            vtt_files = [f for f in os.listdir(tmp) if f.endswith(".vtt")]
            if not vtt_files:
                return []
            return _parse_vtt(os.path.join(tmp, vtt_files[0]))
        except Exception as e:
            safe_print(f"⚠️ [자막] 추출 실패: {e}")
            return []


def _parse_vtt(path: str) -> list:
    """VTT 파일 → [{start_sec: float, text: str}, ...]. 중복 제거 포함."""
    import re
    entries = []
    seen_texts = set()
    with open(path, encoding="utf-8") as f:
        content = f.read()
    blocks = re.split(r"\n{2,}", content)
    for block in blocks:
        lines = block.strip().splitlines()
        ts_line = next((l for l in lines if "-->" in l), None)
        if not ts_line:
            continue
        m = re.match(r"(\d+:\d+[:.]\d+)", ts_line)
        if not m:
            continue
        raw = m.group(1).replace(",", ".")
        parts = raw.split(":")
        if len(parts) == 3:
            start = int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
        else:
            start = int(parts[0]) * 60 + float(parts[1])
        text_lines = [l for l in lines if "-->" not in l and l.strip() and not re.match(r"^\d+$", l.strip()) and l.strip() != "WEBVTT"]
        text = re.sub(r"<[^>]+>", "", " ".join(text_lines)).strip()
        if text and text not in seen_texts:
            seen_texts.add(text)
            entries.append({"start": start, "text": text})
    return entries


def _seconds_to_mmss(sec: float) -> str:
    m, s = divmod(int(sec), 60)
    return f"{m:02d}:{s:02d}"


def get_step_timestamps(video_id: str, steps: list) -> list:
    """
    공통 타임스탬프 추출 파이프라인 (첫 저장 / 갤러리 재생성 동일).
    1) 자막 있으면 Gemini Text 의미 매칭
    2) 매칭 실패 step만 Gemini Video fallback
    반환: [{"step_index": i, "timestamps": ["MM:SS", ...]}, ...]
    """
    import time as _time
    if not steps:
        return []

    results = []

    # ── 1. 자막 추출 ──────────────────────────────────────────
    t0 = _time.time()
    subtitles = _fetch_subtitles(video_id)
    safe_print(f"⏱ [타임스탬프] 자막 추출: {_time.time()-t0:.1f}s ({len(subtitles)}줄)")

    matched_indices = set()

    if subtitles:
        # ── 2. Gemini Text 의미 매칭 ───────────────────────────
        t1 = _time.time()
        subtitle_text = "\n".join(
            f"[{_seconds_to_mmss(e['start'])}] {e['text']}" for e in subtitles
        )
        steps_text = "\n".join(f"{i}. {s}" for i, s in enumerate(steps))

        # 자막이 너무 길면 Python 키워드로 후보 구간 먼저 좁힘
        SUBTITLE_CHAR_LIMIT = 12000
        if len(subtitle_text) > SUBTITLE_CHAR_LIMIT:
            import re as _re_kw
            filtered_entries = []
            for i, step in enumerate(steps):
                keywords = [w for w in _re_kw.findall(r"[가-힣a-zA-Z]{2,}", step)]
                matched = [e for e in subtitles if any(kw in e["text"] for kw in keywords)]
                if not matched:
                    matched = subtitles  # 키워드 없으면 전체로 fallback
                filtered_entries.extend(matched)
            # 중복 제거 후 시간순 정렬
            seen = set()
            deduped = []
            for e in sorted(filtered_entries, key=lambda x: x["start"]):
                if e["start"] not in seen:
                    seen.add(e["start"])
                    deduped.append(e)
            subtitle_text = "\n".join(
                f"[{_seconds_to_mmss(e['start'])}] {e['text']}" for e in deduped
            )

        prompt_match = f"""아래 자막과 요리 단계를 보고, 각 요리 단계가 영상에서 시작되는 시간(타임스탬프)을 찾아주세요.

자막 (시간: 내용):
{subtitle_text}

요리 단계:
{steps_text}

규칙:
- 단계의 의미와 가장 관련 있는 자막 구간을 찾으세요. 단순 키워드 일치가 아닌 의미 매칭.
- 각 단계마다 후보 타임스탬프를 1~3개 반환하세요.
- 크리에이터가 "이걸 넣어줄게요" 같이 재료명 없이 말해도 맥락으로 판단하세요.
- 확실히 관련 자막을 찾을 수 없는 단계는 반환하지 마세요.
- step_index는 0부터 시작.

JSON만 반환: [{{"step_index": 0, "timestamps": ["MM:SS", "MM:SS"]}}]"""

        try:
            client_t = genai_new.Client(api_key=GEMINI_API_KEY)
            resp_t = client_t.models.generate_content(
                model="gemini-2.5-flash",
                contents=[prompt_match],
            )
            import re as _re_sub, json as _json_sub
            _txt_sub = _re_sub.sub(r"```[a-z]*\s*", "", resp_t.text.strip())
            m_sub = _re_sub.search(r"\[[\s\S]*\]", _txt_sub)
            if m_sub:
                raw_sub = _json_sub.loads(m_sub.group(0))
                for item in raw_sub:
                    si = item.get("step_index")
                    tss = item.get("timestamps") or []
                    tss = [t for t in tss if _re_sub.match(r"^\d+:\d{2}$", t)]
                    if si is None or si < 0 or si >= len(steps) or not tss:
                        continue
                    results.append({"step_index": si, "timestamps": tss})
                    matched_indices.add(si)
            safe_print(f"⏱ [타임스탬프] Gemini Text 매칭: {_time.time()-t1:.1f}s → {len(matched_indices)}개 step 매칭")
        except Exception as e:
            safe_print(f"⚠️ [타임스탬프] Gemini Text 매칭 실패: {e}")

    # ── 3. 실패 step만 Gemini Video fallback ──────────────────
    failed_indices = [i for i in range(len(steps)) if i not in matched_indices]
    if failed_indices:
        t2 = _time.time()
        safe_print(f"🎬 [타임스탬프] Gemini Video fallback: step {failed_indices}")
        video_url = f"https://www.youtube.com/watch?v={video_id}"
        failed_texts = "\n".join(f"{i}. {steps[i]}" for i in failed_indices)
        prompt_fb = f"""이 요리 영상을 보고, 아래 조리 단계들이 영상에서 시작되는 타임스탬프를 찾아주세요.

{failed_texts}

【기준】
- 얼굴·상반신이 주 피사체인 구간 제외. 손·팔 일부 + 음식 중심이면 허용.
- 음식·재료·팬 중심으로 보여주는 시점.
- 단순 행동이라도 조리 결과나 재료 상태가 보이면 포함.
- 각 단계마다 타임스탬프 1~3개. step_index는 0부터 시작.

JSON만 반환: [{{"step_index": 0, "timestamps": ["MM:SS"]}}]"""
        try:
            client_fb = genai_new.Client(api_key=GEMINI_API_KEY)
            import concurrent.futures as _cf_fb
            with _cf_fb.ThreadPoolExecutor(max_workers=1) as _ex_fb:
                _fut_fb = _ex_fb.submit(
                    client_fb.models.generate_content,
                    model="gemini-2.5-flash",
                    contents=[
                        genai_types.Part(file_data=genai_types.FileData(file_uri=video_url)),
                        prompt_fb,
                    ],
                )
                resp_fb = _fut_fb.result(timeout=90)
            import re as _re_fb, json as _json_fb
            _txt_fb = _re_fb.sub(r"```[a-z]*\s*", "", resp_fb.text.strip())
            m_fb = _re_fb.search(r"\[[\s\S]*\]", _txt_fb)
            if m_fb:
                raw_fb = _json_fb.loads(m_fb.group(0))
                for item in raw_fb:
                    si = item.get("step_index")
                    tss = item.get("timestamps") or []
                    tss = [t for t in tss if _re_fb.match(r"^\d+:\d{2}$", t)]
                    if si is None or si not in failed_indices or not tss:
                        continue
                    results.append({"step_index": si, "timestamps": tss})
            safe_print(f"⏱ [타임스탬프] Gemini Video fallback: {_time.time()-t2:.1f}s")
        except Exception as e:
            safe_print(f"⚠️ [타임스탬프] Gemini Video fallback 실패: {e}")

    # ── 4. 코드 레벨 검증 (중복 제거, 오름차순) ──────────────
    import re as _re_v
    seen_idx = set()
    validated = []
    for item in sorted(results, key=lambda x: x["step_index"]):
        si = item["step_index"]
        if si in seen_idx:
            continue
        tss = [t for t in item["timestamps"] if _re_v.match(r"^\d+:\d{2}$", t)]
        if not tss:
            continue
        seen_idx.add(si)
        validated.append({"step_index": si, "timestamps": tss})

    filtered = []
    prev_sec = -1
    for item in validated:
        first_sec = _timestamp_to_seconds(item["timestamps"][0])
        if first_sec > prev_sec:
            filtered.append(item)
            prev_sec = first_sec
        else:
            safe_print(f"⚠️ [타임스탬프] step {item['step_index']} 역전 → 제거")

    safe_print(f"✅ [타임스탬프] 최종 {len(filtered)}개 step 확정")
    return filtered


def _sharpness(image_path: str) -> float:
    from PIL import Image
    import numpy as np
    img = Image.open(image_path).convert("L").resize((320, 240))
    arr = np.array(img, dtype=np.float32)
    dx = np.diff(arr, axis=1)
    dy = np.diff(arr, axis=0)
    return float(np.var(dx) + np.var(dy))


def _select_best_frame_with_gemini(candidate_paths: list, step_text: str = None):
    """후보 프레임 이미지들을 Gemini가 직접 보고 최적 1장 선택. 적합한 이미지 없으면 None 반환."""
    from PIL import Image as PILImage
    if not candidate_paths:
        return None
    try:
        client = genai_new.Client(api_key=GEMINI_API_KEY)
        images = []
        valid_paths = []
        for p in candidate_paths:
            try:
                img = PILImage.open(p)
                images.append(img)
                valid_paths.append(p)
            except Exception:
                continue
        if not images:
            return None

        step_ctx = f"\n조리 단계: 「{step_text}」" if step_text else ""
        prompt = (
            f"아래 {len(images)}장의 요리 영상 프레임 중 레시피 카드에 적합한 1장을 고르세요.{step_ctx}\n\n"
            "아래 기준에 가장 잘 맞는 프레임 1장을 선택하세요:\n"
            "1. 조리 단계와 가장 어울리는 음식/재료/조리과정\n"
            "2. 조리 과정이 화면에 보이면 선택 (약간 흔들려도 무방)\n\n"
            # "2. 선명하고 흔들림 없음\n"
            # "3. 식욕을 돋우는 비주얼\n\n"
            "기준에 맞는 프레임이 없으면 NONE을 반환하세요.\n"
            "프레임 번호만 답하세요. 예: 3 또는 NONE"
        )
        import io
        parts = [prompt]
        for img in images:
            buf = io.BytesIO()
            img.save(buf, format="JPEG")
            parts.append(genai_types.Part.from_bytes(data=buf.getvalue(), mime_type="image/jpeg"))

        import concurrent.futures as _cf
        with _cf.ThreadPoolExecutor(max_workers=1) as _ex:
            _fut = _ex.submit(client.models.generate_content, model="gemini-2.5-flash", contents=parts)
            try:
                response = _fut.result(timeout=60)
            except _cf.TimeoutError:
                safe_print("   ⚠️ Gemini Vision 타임아웃 (60s)")
                return None
        text = response.text.strip().upper()
        if "NONE" in text:
            safe_print(f"   🤖 Gemini: 적합한 프레임 없음 (NONE)")
            return None
        digits = ''.join(c for c in text[:5] if c.isdigit())
        if not digits:
            return None
        idx = max(0, min(int(digits) - 1, len(valid_paths) - 1))
        safe_print(f"   🤖 Gemini 선택: {idx + 1}번 프레임")
        return valid_paths[idx]
    except Exception as e:
        safe_print(f"⚠️ [이미지] Gemini 프레임 선택 실패: {e}")
        return None


def extract_step_frames(video_id: str, step_images: list, output_dir: str = None, steps: list = None) -> dict:
    """
    step_images: [{"step_index": 0, "timestamp": "01:23"}, ...]
    steps: 조리 단계 텍스트 배열 (프레임 선택 시 내용 일치 판단에 사용)
    반환: {step_index: local_image_path}
    """
    import subprocess, tempfile, os, shutil
    results = {}
    if not step_images:
        return results

    video_url = f"https://www.youtube.com/watch?v={video_id}"
    safe_print("🔗 [이미지] 스트림 URL 추출 중...")

    try:
        r = subprocess.run(
            [
                "yt-dlp", "-g",
                "-f", "bestvideo[height>=1080][ext=mp4]/bestvideo[height>=720][ext=mp4]/bestvideo[ext=mp4]/bestvideo/best",
                "--cookies-from-browser", "chrome",
                video_url,
            ],
            capture_output=True, text=True, timeout=30
        )
        stream_url = r.stdout.strip().split("\n")[0]
        if not stream_url:
            safe_print("❌ [이미지] 스트림 URL 추출 실패")
            return results
    except Exception as e:
        safe_print(f"❌ [이미지] yt-dlp 실패: {e}")
        return results

    work_dir = output_dir or tempfile.mkdtemp(prefix="findish_frames_")
    os.makedirs(work_dir, exist_ok=True)
    step_items_map = {item["step_index"]: item for item in step_images}

    def _extract_one_step(item):
        import time as _t
        step_idx = item["step_index"]
        timestamps = item.get("timestamps") or ([item["timestamp"]] if item.get("timestamp") else [])
        if not timestamps:
            return step_idx, None, "?"
        ts_label = timestamps[0]
        step_text = steps[step_idx] if steps and step_idx < len(steps) else None

        # ── ffmpeg 프레임 추출 ───────────────────────────────
        t_ffmpeg = _t.time()
        for t_idx, ts in enumerate(timestamps):
            base_sec = _timestamp_to_seconds(ts)
            seek_start = max(2, base_sec - 5)
            frame_pattern = os.path.join(work_dir, f"step_{step_idx}_t{t_idx}_%03d.jpg")
            try:
                subprocess.run([
                    "ffmpeg", "-y",
                    "-ss", str(seek_start), "-i", stream_url,
                    "-t", "10", "-vf", "fps=3", "-q:v", "1",
                    frame_pattern
                ], capture_output=True, timeout=60)
            except Exception as e:
                safe_print(f"⚠️ [이미지] step {step_idx} t{t_idx} ffmpeg 실패: {e}")
        safe_print(f"   ⏱ step {step_idx} ffmpeg: {_t.time()-t_ffmpeg:.1f}s")

        raw_candidates = sorted([
            os.path.join(work_dir, f) for f in os.listdir(work_dir)
            if f.startswith(f"step_{step_idx}_t") and f.endswith(".jpg") and "retry" not in f
            and os.path.getsize(os.path.join(work_dir, f)) > 2000
        ])

        if not raw_candidates:
            safe_print(f"⚠️ [이미지] step {step_idx} 프레임 없음")
            return step_idx, None, ts_label

        # ── blur + 중복 제거 → 12장 균등 sampling ───────────
        t_filter = _t.time()
        # 1) blur 제거 (gradient variance < 50 → blurry)
        non_blurry = []
        for p in raw_candidates:
            try:
                if _sharpness(p) >= 0:
                    non_blurry.append(p)
            except Exception:
                non_blurry.append(p)
        if not non_blurry:
            non_blurry = raw_candidates

        # 2) imagehash 중복 제거
        try:
            import imagehash
            from PIL import Image as _PILImg
            hash_map = {}
            deduped = []
            for p in non_blurry:
                h = imagehash.dhash(_PILImg.open(p))
                if not any(abs(h - eh) <= 6 for eh in hash_map.values()):
                    hash_map[p] = h
                    deduped.append(p)
        except ImportError:
            deduped = non_blurry

        # 3) 시간 기준 균등 sampling → 최대 12장
        MAX_FRAMES = 6
        if len(deduped) > MAX_FRAMES:
            step_size = len(deduped) / MAX_FRAMES
            candidates = [deduped[int(i * step_size)] for i in range(MAX_FRAMES)]
        else:
            candidates = deduped

        safe_print(f"   ⏱ step {step_idx} blur/hash/sample: {_t.time()-t_filter:.1f}s ({len(raw_candidates)}→{len(candidates)}장)")

        # ── Gemini Vision 선택 ───────────────────────────────
        t_vision = _t.time()
        best = _select_best_frame_with_gemini(candidates, step_text=step_text)
        safe_print(f"   ⏱ step {step_idx} Gemini Vision: {_t.time()-t_vision:.1f}s")

        # NONE이면 모든 timestamp 각각 ±8초로 확장 재탐색
        if best is None:
            safe_print(f"   🔄 step {step_idx} 구간 확장 재탐색 중...")
            for p in candidates:
                if os.path.exists(p): os.remove(p)
            wider_candidates = []
            for w_idx, ts_w in enumerate(timestamps):
                w_base = _timestamp_to_seconds(ts_w)
                w_start = max(2, w_base - 8)
                w_pattern = os.path.join(work_dir, f"step_{step_idx}_wide_t{w_idx}_%03d.jpg")
                try:
                    subprocess.run([
                        "ffmpeg", "-y",
                        "-ss", str(w_start), "-i", stream_url,
                        "-t", "16", "-vf", "fps=3", "-q:v", "1",
                        w_pattern
                    ], capture_output=True, timeout=90)
                except Exception:
                    continue
            wider_candidates = [
                os.path.join(work_dir, f)
                for f in sorted(os.listdir(work_dir))
                if f.startswith(f"step_{step_idx}_wide") and f.endswith(".jpg")
                and os.path.getsize(os.path.join(work_dir, f)) > 2000
            ]
            if wider_candidates:
                t_wide = _t.time()
                best = _select_best_frame_with_gemini(wider_candidates, step_text=step_text)
                safe_print(f"   ⏱ step {step_idx} 확장 Gemini Vision: {_t.time()-t_wide:.1f}s")
                for p in wider_candidates:
                    if p != best and os.path.exists(p): os.remove(p)

        if best is None:
            safe_print(f"⚠️ [이미지] step {step_idx} 적합한 프레임 없음 — 건너뜀")
            return step_idx, None, ts_label

        final_path = os.path.join(work_dir, f"step_{step_idx}_best.jpg")
        shutil.copy2(best, final_path)
        for p in candidates:
            if p != final_path and os.path.exists(p):
                os.remove(p)
        return step_idx, final_path, ts

    # 모든 스텝을 병렬로 처리 (ffmpeg + Gemini 동시)
    with ThreadPoolExecutor(max_workers=6) as ex:
        futures = {ex.submit(_extract_one_step, item): item for item in step_images}
        for fut in futures:
            step_idx, final_path, ts = fut.result()
            if final_path:
                dest = os.path.join(work_dir, f"step_{step_idx}.jpg")
                shutil.move(final_path, dest)
                results[step_idx] = dest
                safe_print(f"✅ [이미지] step {step_idx} 프레임 추출 완료 ({ts})")

    # 중복 프레임 제거 (imagehash)
    try:
        import imagehash
        from PIL import Image as _PILImg2
        hashes = {}
        for step_idx, path in list(results.items()):
            h = imagehash.dhash(_PILImg2.open(path))
            duplicate_of = None
            for prev_idx, prev_hash in hashes.items():
                if abs(h - prev_hash) <= 8:
                    duplicate_of = prev_idx
                    break
            if duplicate_of is not None:
                safe_print(f"⚠️ [이미지] step {step_idx} ≈ step {duplicate_of} 중복 감지, 재추출 시도")
                orig_item = step_items_map.get(step_idx)
                if orig_item:
                    tss_orig = orig_item.get("timestamps") or ([orig_item["timestamp"]] if orig_item.get("timestamp") else [])
                    base_sec = _timestamp_to_seconds(tss_orig[0]) if tss_orig else 0
                    retry_pattern = os.path.join(work_dir, f"step_{step_idx}_retry_%03d.jpg")
                    retry_start = max(2, base_sec + 15)
                    try:
                        subprocess.run([
                            "ffmpeg", "-y",
                            "-ss", str(retry_start), "-i", stream_url,
                            "-t", "10", "-vf", "fps=3", "-q:v", "1",
                            retry_pattern
                        ], capture_output=True, timeout=60)
                    except Exception:
                        pass
                    retry_candidates = [
                        os.path.join(work_dir, f)
                        for f in sorted(os.listdir(work_dir))
                        if f.startswith(f"step_{step_idx}_retry") and f.endswith(".jpg")
                        and os.path.getsize(os.path.join(work_dir, f)) > 2000
                    ]
                    if retry_candidates:
                        retry_step_text = steps[step_idx] if steps and step_idx < len(steps) else None
                        best_r = _select_best_frame_with_gemini(retry_candidates, step_text=retry_step_text)
                        shutil.copy2(best_r, path)
                        for p in retry_candidates:
                            if os.path.exists(p):
                                os.remove(p)
                        h = imagehash.dhash(_PILImg2.open(path))
                        safe_print(f"✅ [이미지] step {step_idx} 중복 재추출 완료")
            hashes[step_idx] = h
    except ImportError:
        safe_print("⚠️ [이미지] imagehash 미설치, 중복 제거 건너뜀 (pip install imagehash)")

    # 최종 누락 step만 Gemini Video 1회 일괄 재탐색
    if steps:
        missing_step_indices = [i for i in range(len(steps)) if i not in results]
    else:
        missing_step_indices = []
    if missing_step_indices:
        safe_print(f"🔍 [2차] 누락 step {missing_step_indices} 일괄 재탐색 시작")
        try:
            video_url_2nd = f"https://www.youtube.com/watch?v={video_id}"
            missing_texts = "\n".join(
                f"{si}. {steps[si]}" for si in missing_step_indices if si < len(steps)
            )
            prompt_2nd = f"""이 요리 영상에서 아래 조리 단계들의 타임스탬프를 찾아주세요.
영상 전체를 살펴보세요.

{missing_texts}

【기준】
- 얼굴·상반신이 주 피사체인 구간은 제외
- 손·팔이 일부 보여도 음식·재료·팬이 주 피사체면 허용
- 단순 행동이라도 조리 결과나 재료 상태가 보이면 포함
- 각 단계마다 timestamp 1~2개 반환

JSON만 반환: [{{"step_index": 0, "timestamps": ["MM:SS"]}}]
정말 없는 단계는 제외하세요."""

            client_2nd = genai_new.Client(api_key=GEMINI_API_KEY)
            import concurrent.futures as _cf2nd
            with _cf2nd.ThreadPoolExecutor(max_workers=1) as _ex2nd:
                _fut2nd = _ex2nd.submit(
                    client_2nd.models.generate_content,
                    model="gemini-2.5-flash",
                    contents=[
                        genai_types.Part(file_data=genai_types.FileData(file_uri=video_url_2nd)),
                        prompt_2nd,
                    ],
                )
                try:
                    resp_2nd = _fut2nd.result(timeout=90)
                except _cf2nd.TimeoutError:
                    safe_print("⚠️ [2차] Gemini Video 타임아웃 (90s) — 건너뜀")
                    resp_2nd = None

            if resp_2nd:
                import re as _re2, json as _json2
                _t2 = _re2.sub(r"```[a-z]*\s*", "", resp_2nd.text.strip()).strip().strip("`")
                m2 = _re2.search(r'\[[\s\S]*\]', _t2)
                if not m2:
                    safe_print(f"   ⚠️ [2차] Gemini Video JSON 파싱 실패: {_t2[:200]}")
                if m2:
                    raw2 = _json2.loads(m2.group(0))
                    safe_print(f"   🔍 [2차] Gemini Video 응답: {len(raw2)}개 step")
                    valid_missing = set(missing_step_indices)

                    def _extract_2nd(item2):
                        si2 = item2.get("step_index")
                        tss2 = item2.get("timestamps") or []
                        tss2_raw = tss2[:]
                        tss2 = [t for t in tss2 if _re2.match(r'^\d+:\d{2}$', t)]
                        if si2 not in valid_missing:
                            safe_print(f"   ⚠️ [2차] step {si2} valid_missing 미해당 — 건너뜀")
                            return si2, None
                        if not tss2:
                            safe_print(f"   ⚠️ [2차] step {si2} 유효 타임스탬프 없음 (raw: {tss2_raw})")
                            return si2, None
                        safe_print(f"   🔍 [2차] step {si2} 재탐색: {tss2}")
                        step_text_2nd = steps[si2] if si2 < len(steps) else None
                        cands_2nd = []
                        for w2_idx, ts2 in enumerate(tss2):
                            b2 = _timestamp_to_seconds(ts2)
                            s2 = max(2, b2 - 5)
                            pat2 = os.path.join(work_dir, f"step_{si2}_2nd_t{w2_idx}_%03d.jpg")
                            try:
                                subprocess.run([
                                    "ffmpeg", "-y", "-ss", str(s2), "-i", stream_url,
                                    "-t", "10", "-vf", "fps=3", "-q:v", "1", pat2
                                ], capture_output=True, timeout=60)
                            except Exception:
                                continue
                        cands_2nd = [
                            os.path.join(work_dir, f)
                            for f in sorted(os.listdir(work_dir))
                            if f.startswith(f"step_{si2}_2nd") and f.endswith(".jpg")
                            and os.path.getsize(os.path.join(work_dir, f)) > 2000
                        ]
                        if not cands_2nd:
                            return si2, None
                        sharp2 = cands_2nd
                        _max_f2 = 6
                        if len(sharp2) > _max_f2:
                            step_size2 = len(sharp2) / _max_f2
                            sharp2 = [sharp2[int(i * step_size2)] for i in range(_max_f2)]
                        best_2nd = _select_best_frame_with_gemini(sharp2, step_text=step_text_2nd)
                        for p in cands_2nd:
                            if p != best_2nd and os.path.exists(p):
                                os.remove(p)
                        return si2, best_2nd

                    with ThreadPoolExecutor(max_workers=6) as ex2:
                        futs2 = {ex2.submit(_extract_2nd, item2): item2 for item2 in raw2}
                        for fut2 in futs2:
                            try:
                                si2, best_2nd = fut2.result()
                                if best_2nd:
                                    dest_2nd = os.path.join(work_dir, f"step_{si2}.jpg")
                                    shutil.copy2(best_2nd, dest_2nd)
                                    results[si2] = dest_2nd
                                    safe_print(f"✅ [2차] step {si2} 이미지 확보")
                                else:
                                    safe_print(f"⚠️ [2차] step {si2} 적합한 프레임 없음")
                            except Exception as e2:
                                safe_print(f"⚠️ [2차] step 처리 오류: {e2}")
        except Exception as e:
            safe_print(f"⚠️ [2차] 재분석 실패: {e}")

    return results


def upload_step_frames_to_supabase(video_id: str, frame_paths: dict) -> dict:
    """
    frame_paths: {step_index: local_image_path}
    반환: {step_index: public_url}
    """
    import requests, os
    supabase_url = os.getenv("SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_key:
        safe_print("❌ [이미지] SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 없음")
        return {}

    bucket = "recipe-images"
    headers = {
        "Authorization": f"Bearer {service_key}",
        "apikey": service_key,
    }
    results = {}

    for step_idx, path in frame_paths.items():
        storage_path = f"{video_id}/step_{step_idx}.jpg"
        upload_url = f"{supabase_url}/storage/v1/object/{bucket}/{storage_path}"
        try:
            with open(path, "rb") as f:
                r = requests.post(
                    upload_url,
                    headers={**headers, "Content-Type": "image/jpeg", "x-upsert": "true"},
                    data=f,
                    timeout=30
                )
            if r.status_code in (200, 201):
                public_url = f"{supabase_url}/storage/v1/object/public/{bucket}/{storage_path}"
                results[step_idx] = public_url
                safe_print(f"✅ [이미지] step {step_idx} Supabase 업로드 완료")
            else:
                safe_print(f"❌ [이미지] step {step_idx} 업로드 실패: {r.status_code} {r.text[:100]}")
        except Exception as e:
            safe_print(f"❌ [이미지] step {step_idx} 업로드 오류: {e}")

    return results


def process_step_images(video_id: str, step_images: list, steps: list = None) -> dict:
    """Gemini step_images → Supabase URL dict 반환. {step_index: url, 'dish': thumbnail_url}"""
    result = {}
    thumbnail_url = get_best_thumbnail_url(video_id)
    if thumbnail_url:
        result["dish"] = thumbnail_url
        safe_print(f"✅ [이미지] 완성 요리 썸네일: {thumbnail_url}")

    frames = extract_step_frames(video_id, step_images or [], steps=steps)
    if not frames:
        return result
    urls = upload_step_frames_to_supabase(video_id, frames)
    result.update(urls)
    import os
    for p in frames.values():
        if os.path.exists(p):
            os.remove(p)
    return result


def generate_step_timestamps(video_id: str, steps: list) -> list:
    """조리 단계 텍스트를 기반으로 Gemini가 영상에서 각 단계 타임스탬프 추출"""
    import json
    if not GEMINI_API_KEY or not steps:
        return []
    video_url = f"https://www.youtube.com/watch?v={video_id}"
    steps_text = "\n".join(f"{i+1}. {s}" for i, s in enumerate(steps))
    prompt = f"""이 요리 영상을 보고, 아래 각 조리 단계에 해당하는 타임스탬프 후보를 찾아주세요.

조리 단계:
{steps_text}

【필수 규칙】
1. 얼굴·상반신·전신이 화면의 주 피사체인 구간은 선택 금지 (크리에이터가 카메라 보고 설명하는 장면).
   단, 손·팔이 일부 보여도 음식·재료·팬이 화면의 주 피사체면 허용.
2. 각 단계의 조리 결과물 또는 조리 과정이 화면에 선명하게 보이는 시점을 선택하세요.
3. 자막/텍스트가 없는 장면을 우선하되, 하단 자막이 작게 있는 정도는 허용합니다.
4. 각 단계마다 타임스탬프를 최대 3개까지 반환하세요 (조금씩 다른 시점).
5. timestamps 배열은 오름차순이어야 합니다.
6. step들 간 순서도 오름차순 (step 0 < step 1 < step 2 ...).
7. 단순 행동이라도 음식·재료·팬 중심으로 결과를 보여줄 수 있는 장면이 있으면 timestamp를 반환하세요.
   예: 재료를 팬에 넣는 순간, 소스 색·농도 변화가 보이는 순간, 고기가 익어가는 색감이 보이는 순간.
   정말로 영상 전체에서 음식 중심 장면이 없는 단계만 건너뜁니다.
8. step_index는 0부터 시작합니다.

JSON 배열만 반환하세요:
[{{"step_index": 0, "timestamps": ["MM:SS", "MM:SS", "MM:SS"]}}, ...]"""

    try:
        client = genai_new.Client(api_key=GEMINI_API_KEY)
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[
                genai_types.Part(file_data=genai_types.FileData(file_uri=video_url)),
                prompt,
            ],
        )
        text = response.text.strip()
        import re as _re_ts
        m = _re_ts.search(r'\[.*?\]', text, _re_ts.DOTALL)
        if not m:
            return []
        raw = json.loads(m.group(0))

        # 코드 레벨 검증: step_index 중복 제거, 유효 범위, timestamps 형식 체크
        seen_idx = set()
        validated = []
        for item in raw:
            si = item.get("step_index")
            if si is None or si in seen_idx or si < 0 or si >= len(steps):
                continue
            # timestamps 배열 또는 구버전 단일 timestamp 모두 처리
            tss = item.get("timestamps") or ([item["timestamp"]] if item.get("timestamp") else [])
            tss = [t for t in tss if _re_ts.match(r'^\d+:\d{2}$', t)]
            if not tss:
                continue
            seen_idx.add(si)
            validated.append({"step_index": si, "timestamps": tss})

        # step_index 기준 오름차순 정렬
        validated.sort(key=lambda x: x["step_index"])

        # step 간 첫 번째 timestamp가 오름차순인지 확인 — 역전된 step 제거
        filtered = []
        prev_sec = -1
        for item in validated:
            first_sec = _timestamp_to_seconds(item["timestamps"][0])
            if first_sec > prev_sec:
                filtered.append(item)
                prev_sec = first_sec
            else:
                safe_print(f"⚠️ [갤러리] step {item['step_index']} timestamp 역전 → 제거")

        safe_print(f"✅ [갤러리] 타임스탬프 {len(filtered)}개 스텝 확정")
        return filtered
    except Exception as e:
        safe_print(f"❌ [갤러리] 타임스탬프 추출 실패: {e}")
    return []


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
# 자막(transcript) 가져오기
# -----------------------------
def get_transcript(video_id: str) -> str | None:
    api = YouTubeTranscriptApi()
    # 한국어 우선, 없으면 영어 자동자막 시도
    for langs in [["ko"], ["ko", "en"], ["en"]]:
        try:
            entries = api.fetch(video_id, languages=langs)
            text = " ".join(e.get("text", "") for e in entries)
            if len(text) > 100:
                safe_print(f"📝 [자막] {len(text)}자 수집 (언어: {langs[0]})")
                return text
        except Exception:
            continue
    safe_print("⏭️ [자막] 사용 가능한 자막 없음")
    return None


# -----------------------------
# Groq 텍스트 분석 (고정댓글/더보기란/자막) — 무료
# -----------------------------
def ask_groq_from_text(raw_text, source_name="", target="both"):
    """
    target: "both" | "ingredients" | "steps"
    Whisper 단계에서 부족한 항목만 보완할 때 target을 지정해서 호출.
    """
    if not _groq_client:
        safe_print("❌ GROQ_API_KEY 없음 → 텍스트 분석 불가")
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
        "음성전사": "이 텍스트는 유튜브 요리 영상의 음성을 전사한 내용입니다. 잡담/광고/인트로/아웃트로는 제외하고 요리 관련 내용만 추출하세요.",
    }.get(source_name, "")

    # target에 따라 추출 지시 조정
    if target == "ingredients":
        target_instruction = (
            "⚠️ 이미 순서(조리 과정)는 확보되어 있습니다. **재료 목록만** 추출하세요. "
            "순서는 빈 배열 []로 두세요."
        )
    elif target == "steps":
        target_instruction = (
            "⚠️ 이미 재료 목록은 확보되어 있습니다. **조리 순서만** 추출하세요. "
            "재료는 빈 배열 []로 두세요."
        )
    else:
        target_instruction = ""

    prompt = f"""{prefix}
{target_instruction}

다음 텍스트에서 **메인 메뉴 이름**, **재료(중복 제거)**, **단계별 요리 순서**를 JSON 형식으로만 출력하세요.

⚠️ 중요 규칙:
- 텍스트에 **명시적으로 적혀 있는** 재료와 순서만 추출하세요.
- 절대로 추측하거나 일반 상식으로 재료/순서를 지어내지 마세요.
- 재료가 텍스트에 나열되어 있지 않으면 "재료": [] (빈 배열)로 하세요.
- 요리 순서/과정이 텍스트에 설명되어 있지 않으면 "순서": [] (빈 배열)로 하세요.
- 메뉴/재료/순서 3개의 키를 반드시 포함하세요.
- 재료는 양념(소금, 후추, 간장 등), 오일, 물 등 소량 재료도 빠짐없이 포함하세요.
- 재료는 **이름만** 적으세요. 용량/수량은 제외 (예: "소금 1큰술" → "소금", "계란 3개" → "계란").
- 재료명 표기 통일: 올리브오일→"올리브 오일", 고춧가루류→"고춧가루", 간장류→"간장", 후추류→"후추", 버터류→"버터", 계란/달걀→"계란".
- 재료 정렬: 주재료(육류/해산물/채소) → 양념/소스 → 기타(오일/물/가루) 순서.
- 순서는 각 단계를 1~2문장으로 작성하세요. 텍스트에 온도·시간·양·핵심 포인트가 언급되어 있으면 반드시 그대로 포함하세요 (예: "끓는 소금물에 1분 데친 후 찬물에 헹굽니다", "중불에서 3분간 볶습니다"). 단순 동사 하나("데치기", "마무리")만 쓰지 마세요. 연결된 동작이나 같은 맥락의 행동은 하나의 단계로 묶으세요.
- "마무리", "완성", "플레이팅" 같은 의미 없는 단계는 금지하세요. 실제 동작이 설명된 경우에만 단계로 포함하세요.
- 텍스트가 레스토랑 소개/방문, 음식 리뷰, 먹방, 제품 홍보/광고 위주이거나 직접 요리하지 않는 내용이면 "분석 불가 (레스토랑 소개/먹방/음식 리뷰 등)"라고만 답하세요.

형식:
{{
  "메뉴": "메뉴 이름",
  "재료": ["재료1", "재료2", ...],
  "순서": ["단계1", "단계2", ...]
}}

텍스트:
{sanitize(raw_text[:6000])}
"""

    try:
        resp = _groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1500,
            temperature=0.1,
        )
        result = sanitize(resp.choices[0].message.content or "")
        safe_print(f"✅ [Groq {source_name}] 응답 수신 ({len(result)}자)")
        return result
    except Exception as e:
        safe_print(f"❌ Groq 텍스트 분석 실패 ({source_name}): {e}")
        return None


# -----------------------------
# 텍스트 소스에서 확인된 용량 추출
# -----------------------------
def extract_confirmed_quantities_from_text(raw_text: str, source_name: str, ingredients: list) -> dict:
    """
    description/pinned comment 등 텍스트에서 알려진 재료들의 명시적 용량을 추출.
    반환: {재료명: {"quantity": "2큰술", "source": source_name}}
    """
    if not _groq_client or not ingredients or not raw_text:
        return {}

    ing_list = "\n".join(f"- {ing}" for ing in ingredients)
    prompt = f"""다음 텍스트에서 아래 재료들의 **명시적으로 적힌** 용량을 찾아 JSON으로 반환하세요.

재료 목록:
{ing_list}

규칙:
- 텍스트에 명확히 적힌 용량만 추출하세요. 추측하지 마세요.
- 용량이 없는 재료는 결과에 포함하지 마세요.
- 재료명은 위 목록의 표기와 동일하게 사용하세요.
- 출력: {{"재료명": "용량"}} 형식의 JSON 객체만 반환

출력 예시:
{{"파스타": "200g", "생크림": "2~3큰술"}}

텍스트:
{sanitize(raw_text[:4000])}
"""
    try:
        resp = _groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=300,
            temperature=0.1,
        )
        raw = sanitize(resp.choices[0].message.content or "")
        raw = re.sub(r"```(?:json)?\s*", "", raw).strip()
        brace_start = raw.find('{')
        brace_end = raw.rfind('}')
        if brace_start != -1 and brace_end != -1:
            parsed = json.loads(raw[brace_start:brace_end + 1])
            if isinstance(parsed, dict):
                result = {k: {"quantity": v, "source": source_name} for k, v in parsed.items() if k in ingredients}
                if result:
                    safe_print(f"✅ [확인된 용량] {source_name}에서 {len(result)}개 확인: {result}")
                return result
        return {}
    except Exception as e:
        safe_print(f"⚠️ [확인된 용량 추출] {source_name} 실패: {e}")
        return {}


# -----------------------------
# Groq 용량 추정 (확정된 재료 리스트 기반)
# -----------------------------
def estimate_quantities_with_groq(dish_name: str, ingredients: list, servings: str = "", confirmed: dict = None) -> list:
    """
    Gemini가 확정한 재료 리스트를 받아 Groq으로 권장 용량만 추정.
    confirmed: {재료명: {"quantity": "2큰술", "source": "고정댓글"}} — 크리에이터가 명시한 용량 앵커
    반환: [{"text": "파스타 100g", "source": "groq"}, ...] 형식의 리스트
    """
    if not _groq_client or not ingredients:
        return []

    confirmed = confirmed or {}
    servings_hint = f"\n분량 기준: {servings}" if servings else ""

    def ing_line(ing):
        if ing in confirmed:
            return f"- {ing} [확인된 양: {confirmed[ing]['quantity']}]"
        return f"- {ing}"

    ing_list = "\n".join(ing_line(ing) for ing in ingredients)
    prompt = f"""요리 이름: {dish_name}{servings_hint}
아래는 이 요리에 실제 사용된 재료 목록입니다. 각 재료의 권장 용량을 반환하세요.

재료 목록:
{ing_list}

규칙:
- "[확인된 양: X]"로 표시된 재료는 크리에이터가 직접 명시한 양입니다. 그 값을 그대로 사용하세요.
- 나머지 재료는 "[확인된 양: X]" 재료와의 비율을 고려해 추정하세요. 임의로 늘리지 마세요.
- 건파스타(스파게티/링귀니/펜네 등) 기준: 1인분 = 80~100g. 분량 표기에 맞게 조정하세요.
- 반드시 위 재료 목록에 있는 것만 처리하세요. 새 재료를 추가하지 마세요.
- 허용 단위만 사용: 큰술 / 작은술 / 컵 / g / 개 / 쪽 / 줄기 / 꼬집 / 약간
- 범위 표현 가능: "2~3큰술", "3~4쪽"
- 소금/후추/오일처럼 취향에 따라 달라지는 재료는 "약간" 또는 "적당량" 사용
- 출력 형식: 재료 목록과 동일한 순서로 JSON 배열만 반환

출력 예시:
["바지락 1kg", "양파 1개", "올리브 오일 3~4큰술", "소금 약간"]
"""
    try:
        resp = _groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=500,
            temperature=0.1,
        )
        raw = sanitize(resp.choices[0].message.content or "")
        raw = re.sub(r"```(?:json)?\s*", "", raw).strip()
        bracket_start = raw.find('[')
        bracket_end = raw.rfind(']')
        if bracket_start != -1 and bracket_end != -1:
            parsed = json.loads(raw[bracket_start:bracket_end + 1])
            if isinstance(parsed, list) and len(parsed) == len(ingredients):
                safe_print(f"✅ [Groq 용량추정] {len(parsed)}개 재료 완료")
                result = []
                for ing, qty_text in zip(ingredients, parsed):
                    if ing in confirmed:
                        result.append({"text": qty_text, "source": confirmed[ing]["source"]})
                    else:
                        result.append({"text": qty_text, "source": "groq"})
                return result
        safe_print(f"⚠️ [Groq 용량추정] 파싱 실패 또는 길이 불일치")
        return []
    except Exception as e:
        safe_print(f"❌ [Groq 용량추정] 실패: {e}")
        return []


# -----------------------------
# 오디오 다운로드 + Groq Whisper 전사
# -----------------------------
def download_audio(video_id: str) -> str | None:
    """yt-dlp로 오디오만 다운로드. 파일 경로 반환, 실패시 None."""
    import tempfile
    out_dir = tempfile.mkdtemp()
    out_tmpl = os.path.join(out_dir, "%(id)s.%(ext)s")
    cmd = [
        "yt-dlp",
        "-x",                        # 오디오만 추출
        "--audio-format", "mp3",
        "--audio-quality", "5",      # 중간 품질 (파일 크기 절약)
        "--max-filesize", "20M",     # Groq 25MB 제한 여유있게
        "--ffmpeg-location", "/opt/homebrew/bin/ffmpeg",
        "--cookies-from-browser", "chrome",
        "-o", out_tmpl,
        "--no-playlist",
        "--quiet",
        f"https://www.youtube.com/watch?v={video_id}",
    ]
    try:
        safe_print(f"⬇️ [오디오] 다운로드 중...")
        result = __import__("subprocess").run(cmd, capture_output=True, timeout=60)
        if result.returncode != 0:
            safe_print(f"❌ [오디오] 다운로드 실패: {result.stderr.decode()[:200]}")
            return None
        for fname in os.listdir(out_dir):
            if fname.endswith(".mp3"):
                path = os.path.join(out_dir, fname)
                size_mb = os.path.getsize(path) / 1024 / 1024
                safe_print(f"✅ [오디오] 다운로드 완료 ({size_mb:.1f}MB)")
                return path
        return None
    except Exception as e:
        safe_print(f"❌ [오디오] 다운로드 오류: {e}")
        return None


def transcribe_with_groq(audio_path: str) -> str | None:
    """Groq Whisper로 한국어 오디오 전사. 텍스트 반환, 실패시 None."""
    if not _groq_client:
        return None
    try:
        safe_print(f"🎙️ [Whisper] Groq Whisper 전사 중...")
        with open(audio_path, "rb") as f:
            resp = _groq_client.audio.transcriptions.create(
                file=(os.path.basename(audio_path), f),
                model="whisper-large-v3",
                language="ko",
                response_format="text",
            )
        text = sanitize(str(resp))
        # 한국어·영어·숫자·기본 문장부호 외 노이즈 문자(일본어 등) 제거
        text = re.sub(r'[^\uAC00-\uD7A3\u1100-\u11FF\u3130-\u318F\u0020-\u007Ea-zA-Z0-9\s.,!?()]', '', text).strip()
        safe_print(f"✅ [Whisper] 전사 완료 ({len(text)}자): {text[:80]}")
        return text if text else None
    except Exception as e:
        safe_print(f"❌ [Whisper] 전사 실패: {e}")
        return None
    finally:
        try:
            os.remove(audio_path)
            os.rmdir(os.path.dirname(audio_path))
        except Exception:
            pass


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
- 순서는 각 단계를 1~2문장으로 작성하세요. 텍스트에 온도·시간·양·핵심 포인트가 언급되어 있으면 반드시 그대로 포함하세요 (예: "끓는 소금물에 1분 데친 후 찬물에 헹굽니다", "중불에서 3분간 볶습니다"). 단순 동사 하나("데치기", "마무리")만 쓰지 마세요. 연결된 동작이나 같은 맥락의 행동은 하나의 단계로 묶으세요.
- "마무리", "완성", "플레이팅" 같은 의미 없는 단계는 금지하세요. 실제 동작이 설명된 경우에만 단계로 포함하세요.
- 불필요한 설명/광고/링크는 제거하세요.
- 텍스트가 레스토랑 소개/방문, 음식 리뷰, 먹방, 제품 홍보/광고 위주이거나 직접 요리하지 않는 내용이면 "분석 불가 (레스토랑 소개/먹방/음식 리뷰 등)"라고만 답하세요.

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
        m = re.search(r"(?:v=|youtu\.be/|shorts/)([A-Za-z0-9_-]{11})", url)
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

        # ---- 1순위: 텍스트 소스 수집 (고정댓글 + 더보기란만, 자막 제거)
        text_sources = {}
        if comment_text and comment_text.strip():
            text_sources["고정댓글"] = comment_text
        else:
            safe_print("⏭️ [고정댓글] 텍스트 없음 → 스킵")
        if desc_text and desc_text.strip():
            text_sources["더보기란"] = desc_text
        else:
            safe_print("⏭️ [더보기란] 텍스트 없음 → 스킵")

        # ---- Groq으로 텍스트 소스 병렬 분석
        safe_print(f"🔍 텍스트 분석 시작 (Groq)...")
        with ThreadPoolExecutor(max_workers=2) as executor:
            text_futures = {
                name: executor.submit(ask_groq_from_text, text, name)
                for name, text in text_sources.items()
            }
            for name, future in text_futures.items():
                parsed = parse_text_source(future.result(), name)
                if parsed:
                    all_results[name] = parsed

        # ---- 텍스트 결과에서 현재까지 확보된 최선값 계산
        cur_ingredients = []
        cur_steps = []
        cur_name = None
        for src in ["고정댓글", "더보기란"]:
            if src not in all_results:
                continue
            r = all_results[src]
            if is_valid(r["재료"]) and len(r["재료"]) > len(cur_ingredients):
                cur_ingredients = r["재료"]
                cur_name = r["메뉴"]
            if is_valid(r["순서"]) and len(r["순서"]) > len(cur_steps):
                cur_steps = r["순서"]
                if not cur_name:
                    cur_name = r["메뉴"]

        need_ingredients = len(cur_ingredients) < 4
        need_steps = len(cur_steps) < 3

        # ---- Gemini 영상 분석 — step_images 위해 항상 호출, 재료/순서 부족 시 보완도 겸함
        video_raw = None
        if need_ingredients or need_steps:
            missing = []
            if need_ingredients: missing.append("재료")
            if need_steps: missing.append("순서")
            safe_print(f"🎬 텍스트 부족 ({'+'.join(missing)} 미달) + step_images → Gemini 영상 분석...")
        else:
            safe_print(f"✅ 텍스트 소스 충분 (재료 {len(cur_ingredients)}개, 순서 {len(cur_steps)}단계) → step_images 위해 Gemini 영상 분석...")
        video_raw = analyze_video_with_gemini(video_id)

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
            def _build_multi(p):
                ings = p["재료"] if is_valid(p["재료"]) else []
                svgs = p.get("servings", "") if isinstance(p.get("servings"), str) else ""
                qty_result = estimate_quantities_with_groq(p["메뉴"], ings, servings=svgs) if ings else []
                return {
                    "name": p["메뉴"],
                    "ingredients": ings,
                    "ingredients_measured": [item["text"] for item in qty_result],
                    "ingredients_sources": [item["source"] for item in qty_result],
                    "ingredients_source": "영상 분석",
                    "steps": p["순서"] if is_valid(p["순서"]) else [],
                    "steps_source": "영상 분석",
                    "tips": p.get("tips", []) if isinstance(p.get("tips"), list) else [],
                    "servings": svgs,
                    "tags": p.get("tags", []) if isinstance(p.get("tags"), list) else [],
                    "source": "영상 분석",
                    "uploader": uploader_name,
                    "upload_date": upload_date,
                    "video_url": video_url,
                }
            return {
                "ok": True,
                "results": [_build_multi(p) for p in multi_dish_results],
            }

        if not all_results:

            return {"ok": False, "error": "레시피를 찾을 수 없습니다. 직접 요리하는 영상이 아닌 경우(레스토랑 소개, 먹방, 음식 리뷰 등)는 분석이 어렵습니다."}

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

            # ---- 확정된 재료로 Groq 용량 추정 (재료 추출과 분리)
            final_ingredients = best_ingredients or []
            servings_str = video_result.get("servings", "") if video_result else ""
            ingredients_measured = []
            ingredients_sources = []
            if final_ingredients and best_name:
                # 텍스트 소스에서 크리에이터가 명시한 용량 먼저 추출
                confirmed = {}
                for src_name in ["고정댓글", "더보기란"]:
                    if src_name in text_sources:
                        extracted = extract_confirmed_quantities_from_text(
                            text_sources[src_name], src_name, final_ingredients
                        )
                        for ing, info in extracted.items():
                            if ing not in confirmed:
                                confirmed[ing] = info

                safe_print(f"📏 [용량추정] Groq으로 {len(final_ingredients)}개 재료 용량 추정 중... (확인된 양: {len(confirmed)}개)")
                qty_result = estimate_quantities_with_groq(best_name, final_ingredients, servings=servings_str, confirmed=confirmed)
                ingredients_measured = [item["text"] for item in qty_result]
                ingredients_sources = [item["source"] for item in qty_result]

            return {
                "ok": True,
                "results": [{
                    "name": best_name,
                    "ingredients": final_ingredients,
                    "ingredients_source": best_ingredients_source or "",
                    "steps": best_steps or [],
                    "steps_source": best_steps_source or "",
                    "source": source_label,
                    "uploader": uploader_name,
                    "upload_date": upload_date,
                    "video_url": video_url,
                    "step_images": video_result.get("step_images", []) if video_result else [],
                    "ingredients_measured": ingredients_measured,
                    "ingredients_sources": ingredients_sources,
                    "tips": video_result.get("tips", []) if video_result and isinstance(video_result.get("tips"), list) else [],
                    "servings": servings_str,
                    "tags": video_result.get("tags", []) if video_result and isinstance(video_result.get("tags"), list) else [],
                }],
            }

        return {"ok": False, "error": "레시피를 찾을 수 없습니다. 직접 요리하는 영상이 아닌 경우(레스토랑 소개, 먹방, 음식 리뷰 등)는 분석이 어렵습니다."}

    except Exception as e:
        return {"ok": False, "error": str(e)}

# -----------------------------
# 모듈 단독 실행 체크(선택)
# -----------------------------
if __name__ == "__main__":
    safe_print("✅ youtube_automation.py 로드 완료 (analyze_one_video 포함)")
