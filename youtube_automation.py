from googleapiclient.discovery import build
from youtube_transcript_api import YouTubeTranscriptApi
from dotenv import load_dotenv
import os

load_dotenv()  # .env 파일 불러오기

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
SONAR_API_KEY = os.getenv("SONAR_API_KEY")


# Sonar API + 유튜브 자막으로 여러 영상에서 메뉴/재료 추출 자동화하는 코드
# 1. YouTube에서 영상 목록 가져옴 (최신 20개) 2. 각 영상 자막을 추출 3. 자막을 Sonar Reasoning API에 넘겨서 4. 메뉴 이름과 재료를 JSON으로 받아서 출력
# ✅ 유튜브 영상 ID 추출 함수
def get_video_ids_by_search(api_key, channel_id, max_results=20):
    youtube = build("youtube", "v3", developerKey=api_key)
    video_ids = []

    search_response = youtube.search().list(
        channelId=channel_id,
        part="id",
        maxResults=max_results,
        order="date",
        type="video"
    ).execute()

    for item in search_response["items"]:
        video_ids.append(item["id"]["videoId"])

    return video_ids

# ✅ 메뉴/재료 추출용 Sonar API 함수 (미리 만들어졌다고 가정)
def ask_sonar_for_recipe(script_text):
    import requests
    headers = {
        "Authorization": f"Bearer {SONAR_API_KEY}",
        "Content-Type": "application/json"
    }

    # ✨ user 프롬프트에 자막 + 요청 양식 추가
    user_prompt = f"""자막을 참고해서 메뉴 이름과 재료를 아래 JSON 형식으로만 알려줘. reasoning 없이 결과만 줘.

    형식:
    {{
    "메뉴": "메뉴 이름",
    "재료": ["재료1", "재료2", ...]
    }}

    자막:
    {script_text}
    """

    payload = {
        "model": "sonar-reasoning",  # ✅ 이걸로!
        "messages": [
            {"role": "system", "content": "넌 요리 영상 분석 전문가야."},
            {"role": "user", "content": user_prompt}
        ],
        "temperature": 0.3,
        "search": False
    }

    response = requests.post("https://api.perplexity.ai/chat/completions", headers=headers, json=payload)
    # ✅ 여기에서 안전하게 처리
    try:
        response_json = response.json()
        if "choices" in response_json:
            return response_json["choices"][0]["message"]["content"]
        else:
            print("❌ Sonar 응답에 'choices' 없음 → 응답 내용:", response_json)
            return None
    except Exception as e:
        print("❌ Sonar 응답 처리 중 예외 발생:", e)
        return None


# ✅ 실행 파트
API_KEY = os.getenv("YOUTUBE_API_KEY")
CHANNEL_ID = "UC2IIBYSTMSvJaK2UJzCC06g"  # 공격수셰프 채널 ID
SONAR_API_KEY = os.getenv("SONAR_API_KEY")
video_ids = get_video_ids_by_search(API_KEY, CHANNEL_ID, max_results=20)

for video_id in video_ids:
    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=['ko'])
        script_text = "\n".join([line['text'] for line in transcript])

        result = ask_sonar_for_recipe(script_text)

        print(f"\n📹 영상 링크: https://youtu.be/{video_id}")
        print("🧾 분석 결과:\n", result)

    except Exception as e:
        print(f"❌ {video_id} 처리 중 에러 발생:", e)










#📌 Sonar API를 1개 영상에만 적용해서 테스트하는 코드
# 1. 영상 ID 하나만 넣고 테스트 (video_id = "46WeNbSxYpg") 2. 자막 → Sonar로 넘김 3. 결과 출력 (상태 코드까지 포함)
# from googleapiclient.discovery import build

# def get_video_ids_by_search(api_key, channel_id, max_results=20):
#     youtube = build("youtube", "v3", developerKey=api_key)

#     video_ids = []

#     search_response = youtube.search().list(
#         channelId=channel_id,
#         part="id",
#         maxResults=max_results,
#         order="date",  # 최신 순
#         type="video"
#     ).execute()

#     for item in search_response["items"]:
#         video_ids.append(item["id"]["videoId"])

#     return video_ids


# # ✅ 여기에 API 키 넣기
# API_KEY = ""
# CHANNEL_ID = "UC2IIBYSTMSvJaK2UJzCC06g"

# video_ids = get_video_ids_by_search(API_KEY, CHANNEL_ID, max_results=20)
# print(video_ids)



# import requests
# from youtube_transcript_api import YouTubeTranscriptApi

# # 🔑 Sonar API 키 넣기
# API_KEY = ""  # ← 여기에 발급받은 키 입력

# # 📹 유튜브 영상 ID (예: https://youtu.be/6epy51dKxaQ → "6epy51dKxaQ")
# video_id = "46WeNbSxYpg"

# # 1. 유튜브 자막 추출
# try:
#     transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=['ko'])
#     script_text = "\n".join([line['text'] for line in transcript])
# except Exception as e:
#     print(f"❌ 자막 추출 실패: {e}")
#     script_text = None

# def ask_sonar_for_recipe(script_text):
#     import requests

#     url = "https://api.perplexity.ai/chat/completions"
#     headers = {
#         "Authorization": f"Bearer {API_KEY}",
#         "Content-Type": "application/json"
#     }

#     system_prompt = "넌 요리 영상 분석 전문가야. 자막을 참고해 정확한 메뉴 이름과 재료 목록을 JSON으로 알려줘."
#     user_prompt = f"""다음은 유튜브 요리 영상의 자막입니다. 여기서 요리된 **메뉴 이름**과 **정확한 재료 목록**을 JSON 형식으로 알려줘. 양은 필요 없어.

# 자막:
# {script_text}
# """

#     payload = {
#     "model": "sonar-reasoning",  # ✅ 이걸로!
#         "messages": [
#             {"role": "system", "content": system_prompt},
#             {"role": "user", "content": user_prompt}
#         ],
#         "temperature": 0.3,
#         "search": False
#     }

#     response = requests.post(url, headers=headers, json=payload)

#     # 🔎 1단계: 응답 상태 코드와 전체 내용 출력
#     print("🔎 응답 상태 코드:", response.status_code)
#     print("🔎 응답 내용:")
#     print(response.text)

#     # ✅ 2단계: 예외 처리 (choices가 없을 경우 대비)
#     try:
#         response_json = response.json()
#         if "choices" in response_json:
#             return response_json["choices"][0]["message"]["content"]
#         else:
#             return "❌ 오류: 응답에 'choices' 키가 없습니다."
#     except Exception as e:
#         return f"❌ 예외 발생: {e}"


# # 3. 결과 출력
# if script_text:
#     result = ask_sonar_for_recipe(script_text)
#     print("\n📦 Sonar API 추출 결과:")
#     print(result)
# else:
#     print("자막이 없어서 요청을 생략했습니다.")

# 제목과 재료를 꽤 정확히 알려줌. 
# main ingredients/common ingredients의 이름이 다르거나 빠졌을때, reasoning process를 볼 수 있어서 좋음. 
# user prompt를 참고해서 결정한다는것도 알 수 있어서 조흥ㅁ.
# Ex) 1. 소금과 후추를 넣을지 말지 고민하는 soanr API 2. 코인육수를 육수라고 변경
# 그래서 user_prompt만 손봐주면 될거같음












''' Youtube + ChatGPT OpenAI
OpenAI GPT API 사용 예제 (ChatGPT) 
1. (Sonar API가 아닌 OpenAI API 기반) 2. openai 라이브러리로 GPT-3.5에게 자막 전달 3. 메뉴/재료를 JSON 형식으로 추출 결과 출력


import openai
from youtube_transcript_api import YouTubeTranscriptApi
import os

# 🔑 OpenAI API 키 설정
client = openai.OpenAI(
    api_key=""  # ← 여기에 너의 OpenAI API 키 넣기
)

# 📹 유튜브 영상 ID만 입력 (예: https://youtu.be/46WeNbSxYpg → "46WeNbSxYpg")
video_id = "6epy51dKxaQ"

# 1. 유튜브 자막 추출
try:
    transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=['ko'])
    script_text = "\n".join([line['text'] for line in transcript])
except Exception as e:
    print(f"❌ 자막 추출 실패: {e}")
    script_text = None

# 2. GPT에 자막 전달해서 메뉴/재료 추출
def ask_gpt_for_recipe(script_text):
    system_prompt = "너는 요리 영상을 분석해서 정확한 메뉴 이름과 사용된 재료 목록을 뽑아주는 전문가야. 이 스크립트를 참고해 만드는 메뉴와 필요한 재료를 정확히 알아내줘."

    user_prompt = f"""다음은 유튜브 요리 영상의 자막입니다. 여기서 요리된 **메뉴 이름**과 **정확한 재료 목록**을 JSON 형식으로 알려줘.

자막:
{script_text}
"""

    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.4
    )

    return response.choices[0].message.content

# 3. 결과 출력
if script_text:
    result = ask_gpt_for_recipe(script_text)
    print("\n📦 GPT 추출 결과:")
    print(result)
else:
    print("자막이 없어서 GPT 요청을 생략했습니다.")
    '''