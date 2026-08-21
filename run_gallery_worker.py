"""
독립 갤러리 워커 — queued 상태 job을 순차 처리
"""
import os, sys, time, requests
from dotenv import load_dotenv
load_dotenv()

sys.path.insert(0, os.path.dirname(__file__))
from youtube_automation import get_step_timestamps, process_step_images

SUPABASE_URL = os.getenv("SUPABASE_URL")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

def _get_video_id(url):
    import re
    m = re.search(r"(?:v=|youtu\.be/)([A-Za-z0-9_-]{11})", url)
    return m.group(1) if m else None

def process_job(job):
    recipe_id = job["recipe_id"]
    job_id = job["id"]

    # processing 표시
    requests.patch(
        f"{SUPABASE_URL}/rest/v1/gallery_jobs",
        headers=HEADERS,
        params={"id": f"eq.{job_id}"},
        json={"status": "processing", "attempts": job.get("attempts", 0) + 1},
    )

    try:
        r = requests.get(
            f"{SUPABASE_URL}/rest/v1/recipes",
            headers={"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"},
            params={"id": f"eq.{recipe_id}", "select": "id,url,steps"},
        )
        rows = r.json()
        if not rows:
            raise ValueError("recipe not found")

        row = rows[0]
        steps = row.get("steps", [])
        vid = _get_video_id(row.get("url", ""))
        if not vid:
            raise ValueError("video_id 없음")

        print(f"  🎬 {vid} — {len(steps)}단계")
        timestamps = get_step_timestamps(vid, steps)
        if not timestamps:
            raise ValueError("타임스탬프 추출 실패")

        img_dict = process_step_images(vid, timestamps, steps=steps)
        if img_dict:
            requests.patch(
                f"{SUPABASE_URL}/rest/v1/recipes",
                headers=HEADERS,
                params={"id": f"eq.{recipe_id}"},
                json={"step_images": img_dict},
            )

        requests.patch(
            f"{SUPABASE_URL}/rest/v1/gallery_jobs",
            headers=HEADERS,
            params={"id": f"eq.{job_id}"},
            json={"status": "done"},
        )
        print(f"  ✅ done")

    except Exception as e:
        print(f"  ❌ 실패: {e}")
        requests.patch(
            f"{SUPABASE_URL}/rest/v1/gallery_jobs",
            headers=HEADERS,
            params={"id": f"eq.{job_id}"},
            json={"status": "failed", "error": str(e)[:500]},
        )


def main():
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/gallery_jobs",
        headers={"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"},
        params={"status": "eq.queued", "attempts": "lt.3", "order": "created_at.asc"},
    )
    jobs = r.json()
    total = len(jobs)
    print(f"▶ queued 작업 {total}개 처리 시작\n")

    for i, job in enumerate(jobs, 1):
        print(f"[{i}/{total}] recipe_id={job['recipe_id']}")
        process_job(job)
        print()

    print("완료")


if __name__ == "__main__":
    main()
