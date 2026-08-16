# Gallery 이미지 추출 파이프라인

> 최종 업데이트: 2026-08-16

## 개요

레시피 카드의 GALLERY 섹션에 표시되는 이미지를 YouTube 영상에서 자동 추출하는 파이프라인.
`youtube_automation.py` 내부에 구현되어 있으며, `api_server.py`가 호출함.

---

## 전체 흐름

```
① 타임스탬프 추출 (Gemini)
        ↓
② 각 타임스탬프 ±5초 구간에서 ffmpeg로 20장 추출
        ↓
③ Gemini가 20장 중 최적 1장 선택
   → 적합한 프레임 없으면 NONE 반환
   → NONE이면 ±15초 구간 확장 재탐색
   → 그래도 없으면 해당 step 건너뜀
        ↓
④ imagehash로 중복 제거
        ↓
⑤ Supabase Storage 업로드
        ↓
⑥ Supabase DB step_images 컬럼 저장
```

---

## 함수별 역할 및 위치

### `process_step_images()` — line 719
진입점. 썸네일 URL 가져오고 extract → upload 순서로 호출.

### `extract_step_frames()` — line 538
- yt-dlp로 stream URL 추출
- 스텝별 `_extract_one_step()` 병렬 실행 (ThreadPoolExecutor, max_workers=3)
- imagehash 중복 감지 → 중복 시 타임스탬프 +15초 구간 재추출

### `_extract_one_step()` — line 568 (내부 함수)
스텝 하나 처리:
1. ffmpeg 단일 호출 → 10초 구간 fps=2 → 20장
2. Gemini 프레임 선택 (`_select_best_frame_with_gemini`)
3. NONE이면 ±15초 확장 재탐색 (ffmpeg 30초 구간)
4. 그래도 NONE이면 None 반환 → 해당 step 갤러리에서 제외

### `_select_best_frame_with_gemini()` — line 483
후보 이미지들을 Gemini에 보내 최적 1장 선택.
- 반환값: 파일 경로 또는 `None` (NONE 응답 시)

**현재 프롬프트 기준 (2026-08-16):**
```
탈락 기준:
❌ 얼굴·상반신·전신이 화면의 주 피사체 (크리에이터가 카메라 보고 말하는 장면)
❌ 자막·텍스트가 화면 많은 부분 차지
✅ 손·팔 일부 보여도 음식·재료·팬이 주 피사체면 통과

선택 기준 (탈락하지 않은 프레임 중):
1. 조리 단계와 어울리는 음식/조리과정
2. 선명하고 흔들림 없음
3. 식욕을 돋우는 비주얼

적합한 프레임 없으면 → NONE 반환 (강제 선택 없음)
```

### `upload_step_frames_to_supabase()` — line 677
Supabase Storage `recipe-images/{video_id}/step_{N}.jpg` 경로로 업로드.

---

## 타임스탬프 추출 — 두 가지 경로

### 경로 A: 레시피 첫 저장 시
`analyze_video_with_gemini()` (line 326)
- 레시피 전체(메뉴/재료/순서/tips/tags) + step_images 타임스탬프를 **한 번에** 추출
- 📸 섹션 프롬프트 (line 382~391):
  - 얼굴·상반신 메인 장면 선택 금지
  - 손·팔 일부 + 음식 메인이면 허용
  - 조리 결과물이 보이는 직후 장면
  - 오름차순 순서 유지

### 경로 B: 갤러리 재생성 버튼(↺) 시
`generate_step_timestamps()` (line 778)
- 저장된 steps 텍스트를 Gemini에 보내 타임스탬프만 따로 추출
- 코드 레벨 검증 포함:
  - step_index 중복 제거
  - 유효 범위 체크 (0 ~ len(steps)-1)
  - timestamp 오름차순 검증 → 역전 항목 자동 제거

---

## Supabase 저장 구조

`step_images` JSONB 컬럼:
```json
{
  "dish": "https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
  "0": "https://.../step_0.jpg",
  "2": "https://.../step_2.jpg",
  "4": "https://.../step_4.jpg"
}
```
- `dish`: YouTube 썸네일 (완성 요리 대표 이미지)
- 숫자 키: step_index (모든 step에 이미지가 있을 필요 없음)

---

## 프론트엔드 갤러리 렌더링 (`App.js`)

```javascript
// dish 제외, 숫자 키 오름차순 정렬, 순서대로 표시
const stepImgs = Object.entries(recipeModal.step_images || {})
  .filter(([k]) => k !== 'dish')
  .sort(([a], [b]) => Number(a) - Number(b))
  .map(([, src], i) => ({ src, index: i }));
```
- step 개수와 갤러리 사진 수는 **일치하지 않아도 됨**
- 라이트박스 클릭 시 step 캡션 없이 이미지만 표시

---

## 알려진 한계 및 개선 예정

| 문제 | 현재 상태 | 개선 예정 |
|------|-----------|-----------|
| 타임스탬프 하나에 의존 | ±5초 구간 20장 | 후보 2~3개로 확장 (3순위) |
| 두 가지 타임스탬프 경로 | A/B 경로 분리 | 단일 파이프라인 통일 (5순위) |
| 저장 전 Validator 없음 | Gemini 결과 바로 저장 | 코드 레벨 검증 추가 (4순위) |
| 사람 사진 완전 제거 불가 | NONE + 재탐색으로 개선 | 근본 해결 미완 |

---

## 관련 파일

- `youtube_automation.py` — 파이프라인 전체
- `api_server.py` — `/save-recipe`, `/analyze-save`, `/generate-gallery` 엔드포인트
- `src/App.js` — `startGalleryGeneration()`, 갤러리 렌더링, 라이트박스
