# Gallery 이미지 추출 파이프라인

> 최종 업데이트: 2026-08-18

## 개요

레시피 카드의 GALLERY 섹션에 표시되는 이미지를 YouTube 영상에서 자동 추출하는 파이프라인.
`youtube_automation.py` 내부에 구현되어 있으며, `api_server.py`가 호출함.

Analyze(영상분석/채널분석) → 저장 시 자동 실행되며, 별도로 `/generate-gallery` 엔드포인트로도 재생성 가능.

---

## 전체 흐름 (현재 v3, 2026-08-18)

```
① 타임스탬프 추출
   - yt-dlp로 자막(VTT) 파싱 → Gemini Text로 step별 타임스탬프 매칭
   - 자막 없으면 Gemini Video API fallback
   - 코드 레벨 검증: 오름차순 역전 항목 자동 제거
        ↓
② [NEW] 타임스탬프 정확히 1장 추출 (ffmpeg -t 1 -vf fps=1)
        ↓
③ [NEW] Gemini YES/NO 판단
   "이 프레임이 [조리 단계]에 해당하는 장면입니까?"
   YES → 바로 사용 ✅ (끝)
   NO  → ④로 진행
        ↓
④ ±5초 구간 ffmpeg 다중 프레임 추출 (fps=3, ~20장)
   → blur/hash 필터 → 6장 샘플링
   → Gemini Vision: 6장 중 최적 1장 선택
   → NONE이면 ±8초 확장 재탐색
        ↓
⑤ 1차 NONE 남은 step → 2차 배치 탐색
   (Gemini Video API로 누락 step 전체 타임스탬프 재추출 → ②~④ 반복)
        ↓
⑥ Supabase Storage 업로드 → DB step_images 컬럼 저장
```

---

## 함수별 역할

### `_check_frame_matches_step(image_path, step_text)` — YES/NO 판단 (NEW)
단일 프레임 1장을 Gemini에 보내 해당 조리 단계와 맞는지 YES/NO만 판단.
- YES → 바로 사용, Gemini Vision 호출 없음 (비용/시간 절감)
- NO → 기존 다중 프레임 선택 방식으로 넘김

### `_select_best_frame_with_gemini(candidate_paths, step_text)` — Vision 선택
후보 6장을 Gemini에 보내 최적 1장 선택.

**현재 프롬프트 (v4, 2026-08-18):**
```
선택 기준:
1. 조리 단계와 가장 어울리는 음식/재료/조리과정
2. 조리 과정이 화면에 보이면 선택 (약간 흔들려도 무방)
→ 기준에 맞는 프레임 없으면 NONE
```

### `process_step_images(video_id, step_images, steps)` — 진입점
썸네일 + extract + upload 순서 호출.

### `get_step_timestamps(video_id, steps)` — 타임스탬프 추출 (단일 파이프라인)
첫 저장 / 갤러리 재생성 모두 동일 경로. 자막 → Gemini Text → Video fallback 순.

### `extract_step_frames(video_id, step_images, steps)` — 프레임 추출
YES/NO → 다중 프레임 → 2차 배치 전체 흐름 담당.

---

## 프롬프트 튜닝 이력

| 버전 | 기준 구성 | 효종갱(9) | 오레끼에떼(6) |
|------|----------|:---:|:---:|
| v1 | 탈락기준 3개 + 선택기준 3개 | 7 | 2 |
| v2 | 탈락기준 제거 + 선택기준 3개 | - | 0 |
| v3 | 탈락기준 제거 + 선택기준 2개(식욕 제거) | - | 1 |
| v4 현재 | 선택기준 2개(흔들림 완화, 식욕 제거) | - | - |

> 탈락기준 제거 시 Gemini가 판단 기준을 잃어 오히려 악화됨 (역설적 결과)

---

## YES/NO 방식 도입 후 테스트 결과 (2026-08-18)

| 영상 | 길이 | step 수 | 이전 최고 | YES/NO 방식 |
|------|------|:-------:|:--------:|:-----------:|
| 오레끼에떼 (미뇨끼) | 39초 쇼츠 | 6 | 2개 | **6개** ✅ |
| 브루스케타 (미뇨끼) | 47초 쇼츠 | 8 | - | **8개** ✅ |
| 라따뚜야 (미뇨끼) | ~40초 쇼츠 | 9 | - | **8개** (step 3 타임스탬프 미매칭) |

---

## API 비용 추정 (Gemini 2.5 Flash, 2026-08-18 요금 기준)

- 입력: $0.30/1M tokens / 출력: $2.50/1M tokens / 영상: 263 tokens/초

| 영상 길이 | 예상 비용 |
|----------|----------|
| 쇼츠 (~47초) | $0.01~0.02 |
| 일반 영상 (~3분) | $0.03~0.05 |

- 월 수십 개 등록 기준 → **월 $5 이하**
- 현재 무료 tier 범위 내이면 $0

---

## Supabase 저장 구조

```json
{
  "dish": "https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
  "0": "https://.../step_0.jpg",
  "2": "https://.../step_2.jpg"
}
```
- `dish`: YouTube 썸네일
- 숫자 키: step_index (연속하지 않아도 됨)

---

## 프론트엔드 갤러리 렌더링 (`App.js`)

```javascript
const stepImgs = Object.entries(recipeModal.step_images || {})
  .filter(([k]) => k !== 'dish')
  .sort(([a], [b]) => Number(a) - Number(b))
  .map(([, src], i) => ({ src, index: i }));
```

---

## 관련 파일

- `youtube_automation.py` — 파이프라인 전체
- `api_server.py` — `/analyze-save`, `/save-recipe`, `/generate-gallery`
- `src/App.js` — `startGalleryGeneration()`, 갤러리 렌더링, 라이트박스
