# Gallery 이미지 추출 파이프라인

> 최종 업데이트: 2026-08-19

## 개요

레시피 카드의 GALLERY 섹션에 표시되는 이미지를 YouTube 영상에서 자동 추출하는 파이프라인.
`youtube_automation.py` 내부에 구현되어 있으며, `api_server.py`가 호출함.

레시피 저장 시 자동 실행되며, 별도로 `/generate-gallery` 엔드포인트로도 재생성 가능.

---

## 전체 흐름 (v4, 2026-08-19)

```
① 타임스탬프 추출 (get_step_timestamps)
   - yt-dlp로 자막(VTT) 파싱 → Gemini Text로 step별 타임스탬프 매칭
   - 자막 없으면 Gemini Video API fallback
   - 코드 레벨 검증: 오름차순 역전 항목 자동 제거
        ↓
② 타임스탬프 정확히 1장 추출 (ffmpeg -t 1 -vf fps=1)
        ↓
③ Gemini YES/NO 판단
   "이 프레임이 [조리 단계]에 해당하는 장면입니까?"
   YES → 바로 사용 ✅
   NO  → ④로 진행
        ↓
④ ±5초 구간 ffmpeg 다중 프레임 추출 (fps=3, ~20장)
   → blur/hash 필터 → 6장 샘플링
   → Gemini Vision: 6장 중 최적 1장 선택
   → NONE이면 ±8초 확장 재탐색
        ↓
⑤ 1차 NONE 남은 step → 2차 배치 탐색
   (Gemini Video API로 누락 step 타임스탬프 재추출 → ②~④ 반복)
        ↓
⑥ [NEW] 완성 요리 이미지 확보 (_find_final_dish_override)
   → 아래 별도 섹션 참고
        ↓
⑦ Supabase Storage 업로드 → DB step_images 컬럼 저장
```

---

## [NEW] 완성 요리 이미지 로직 (2026-08-19)

갤러리 마지막에 완성된 요리 이미지를 붙이는 기능. 3단계 폴백 구조.

```
마지막 step 이미지
    ↓
_is_final_dish() YES/NO
    ├─ YES → 그대로 사용 (추가 작업 없음)
    └─ NO
        ↓
마지막 step 타임스탬프(tss[0]) 이후 ~ 영상 끝 구간
ffmpeg로 6~10장 추출
        ↓
_select_best_final_dish_frame() → 최적 1장
        ├─ 선택됨 → dish_final 키로 Supabase 업로드
        └─ NONE → 완성 이미지 없이 마무리
```

**핵심 구현 포인트:**
- `last_sec = _timestamp_to_seconds(tss[0])` — 마지막 step의 첫 번째 타임스탬프 사용 (tss[-1]은 탐색 범위 끝이라 구간이 너무 좁아짐)
- stream_url 재획득: 긴 작업 후 HLS URL 만료 대비, yt-dlp로 재획득
- span < 2초면 건너뜀

**YES/NO 프롬프트 (`_is_final_dish`):**
```
"이 이미지가 지금 만들고 있는 요리의 완성된 모습을 보여주기에 적절하면 YES, 아니면 NO."
```

**완성 요리 선택 프롬프트 (`_select_best_final_dish_frame`):**
```
선택 기준:
1. 조리가 완료된 음식의 전체 모습, 플레이팅, 먹기 직전 상태
2. 접시/그릇에 담긴 완성 형태 우선
제외: 재료 손질·볶는 중·끓이는 중 등 조리 과정 중인 장면
```

---

## Gallery Job Queue (2026-08-19)

갤러리 생성을 DB 기반 잡 큐로 관리. 동시성 제한 + 중단 복구 목적.

```python
# api_server.py
_gallery_executor = ThreadPoolExecutor(max_workers=2)  # 동시 최대 2개
_gallery_active: set = set()   # 현재 처리 중인 recipe_id

# gallery_jobs 테이블 (Supabase)
# status: queued → processing → done | failed
# UNIQUE INDEX on (recipe_id) WHERE status IN ('queued', 'processing') — 중복 방지
```

**폴러 동작:**
- 서버 시작 시 stuck `processing` 잡을 `queued`로 복구
- 10초마다 `queued` 잡 최대 2개 꺼내 executor에 제출

---

## 함수별 역할

| 함수 | 위치 | 역할 |
|------|------|------|
| `get_step_timestamps(video_id, steps)` | youtube_automation.py | 자막→Gemini Text→Video fallback 타임스탬프 추출 |
| `extract_step_frames(video_id, step_images, steps, thumbnail_url)` | youtube_automation.py | YES/NO → 다중 프레임 → 2차 배치 → 완성 요리 전체 흐름 |
| `_is_final_dish(img_source)` | youtube_automation.py | 이미지(경로 or URL) → 완성 요리 여부 YES/NO |
| `_find_final_dish_override(results, step_items, stream_url, work_dir)` | youtube_automation.py | 완성 요리 이미지 확보 오케스트레이션 |
| `_select_best_final_dish_frame(candidate_paths)` | youtube_automation.py | 완성 요리 후보 중 최적 1장 선택 |
| `_select_best_frame_with_gemini(candidate_paths, step_text)` | youtube_automation.py | 조리 단계 후보 중 최적 1장 선택 |
| `upload_step_frames_to_supabase(video_id, frame_paths)` | youtube_automation.py | 로컬 이미지 → Supabase Storage 업로드 |
| `process_step_images(video_id, step_images, steps)` | youtube_automation.py | 진입점: extract + upload + dish_final 처리 |
| `_process_gallery_job(recipe_id, job_id)` | api_server.py | 잡 큐에서 꺼낸 갤러리 생성 실행 |

---

## Supabase 저장 구조 (step_images 컬럼)

```json
{
  "dish": "https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
  "0": "https://.../step_0.jpg",
  "1": "https://.../step_1.jpg",
  "dish_final": "https://.../dish_final.jpg"
}
```

| 키 | 설명 |
|----|------|
| `dish` | YouTube 썸네일 (항상 저장, 갤러리엔 미표시) |
| `0`, `1`, `2`... | 조리 step별 이미지 (연속하지 않아도 됨) |
| `dish_final` | 완성 요리 이미지 (영상 후반부 추출, 있을 때만 존재) |

---

## 프론트엔드 갤러리 렌더링 (`App.js`)

```javascript
const dishFinalSrc = recipeModal.step_images?.dish_final || null;
const stepImgs = Object.entries(recipeModal.step_images || {})
  .filter(([k]) => k !== 'dish' && k !== 'dish_final')  // 썸네일/완성 제외
  .sort(([a], [b]) => Number(a) - Number(b))
  .map(([, src], i) => ({ src, index: i }));

// dish_final 있으면 마지막에 추가, 없으면 마지막 step이 "완성" 라벨
const allImgs = dishFinalSrc
  ? [...stepImgs, { src: dishFinalSrc, index: stepImgs.length, isFinal: true }]
  : stepImgs.map((img, i) => ({ ...img, isFinal: i === stepImgs.length - 1 }));
```

- `isFinal: true` → 주황색 "완성" 라벨 (`.recipe-gallery-final`)
- `dish` 썸네일은 갤러리에 표시하지 않음

---

## API 비용 추정 (Gemini 2.5 Flash)

| 항목 | 비용 |
|------|------|
| YES/NO 체크 (이미지 1장) | ~$0.00002 |
| 완성 요리 후반부 추출 (발생 시) | ~$0.0003 |
| 전체 갤러리 생성 (쇼츠 ~47초) | $0.01~0.02 |
| 전체 갤러리 생성 (일반 ~3분) | $0.03~0.05 |

월 수십 개 등록 기준 → **월 $5 이하**

---

## 관련 파일

- `youtube_automation.py` — 파이프라인 전체
- `api_server.py` — `/analyze-save`, `/save-recipe`, `/generate-gallery`, job 큐
- `src/App.js` — `startGalleryGeneration()`, 갤러리 렌더링
- `scripts/migrate_gallery_jobs.sql` — gallery_jobs 테이블 DDL
