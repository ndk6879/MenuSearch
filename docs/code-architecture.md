# Code Architecture

## 전체 구조

```
[브라우저 React]
      │  
      ├─ 레시피 읽기 ──────────────────→ Supabase (직접)
      ├─ 인증 (구글) ──────────────────→ Supabase Auth (직접)
      ├─ 인증 (카카오) ────────────────→ Railway → Supabase Auth
      └─ 레시피 쓰기/분석/썸네일 ──────→ Railway Flask
                                              └─→ Supabase REST API
                                              └─→ YouTube API
                                              └─→ Gemini/Groq (레시피 파싱)
```

> 읽기는 프론트에서 Supabase 직접. 쓰기는 Service Role Key가 필요해 Railway 경유.  
> 프론트는 anon key만 가짐 → 직접 insert/update 불가.

---

## 프론트엔드 (src/)

### App.js — 거의 모든 것
단일 파일에 상태, 로직, 주요 컴포넌트가 집중되어 있음.  
의도적 선택: 소규모 솔로 프로젝트에서 파일 분산은 컨텍스트 비용만 증가.

**핵심 상태 흐름:**
```
Supabase fetch
    ↓
recipeData (raw)
    ↓ useMemo (+ recipeEdits merge)
sortedData
    ↓ useMemo (+ hidden filter + chef filter)
validRecipes
    ↓ (검색 시) searchResults / (기본) searchResults = sortedData
    ↓ useMemo (+ deletedKeys + selectedChef + liveFilteredData)
filteredResults
    ↓ sort (name | date)
sortedResults → 렌더링
```

**주요 state:**
| state | 타입 | 초기값 출처 |
|-------|------|------------|
| `recipeData` | `Recipe[]` | Supabase fetch |
| `recipeEdits` | `{[url]: edit}` | localStorage |
| `thumbnailOverrides` | `{[url]: string}` | localStorage (deprecated) |
| `socialUser` | `User\|null` | localStorage → Supabase 검증 |
| `creatorUser` | `User\|null` | localStorage |
| `recipeLoading` | `boolean` | true → false (첫 데이터 도착 시) |
| `deletedKeys` | `Set<string>` | 메모리만 (새로고침 시 초기화) |

**재료 처리 규칙 — 중요:**
- `parseIngText(str)`: "다진마늘 2큰술" → `{ name: "다진마늘", amount: "2큰술" }` — display용
- `normalizeIng(str)`: 동의어 정규화 ("파" → "대파") — **검색/SEASONINGS 분류 전용**
- `normalizeIng`을 display 경로에 쓰면 단위가 유실됨. 과거에 버그 발생한 이력 있음.

### 컴포넌트 분리 기준
컴포넌트 분리는 **re-render 방지**가 목적일 때만. UI 정리 목적의 분리는 하지 않음.
- `RecipeCard`: React.memo — 리스트 아이템이라 잦은 re-render 대상
- `RecipeEditPanel`: 자체 state 관리 — App 리렌더 방지
- `SortableIngRow`: dnd-kit 연동 필요해서 분리

### 크리에이터 페이지
`/:slug` 라우트 → `chefConfig`에서 slug → chefKey 역변환 → `CHEF_FILTER` 설정  
동일한 App 컴포넌트, `CHEF_FILTER`가 있으면 해당 크리에이터 레시피만 필터링.

---

## 백엔드 (api_server.py)

### 역할
- 레시피 CRUD (Supabase Service Role Key 사용)
- 카카오 OAuth code 교환
- YouTube 분석 (텍스트 → Groq, 부족 시 Gemini 영상 분석)
- 썸네일 업로드 (S3/Storage)
- 북마크 CRUD (Supabase)
- AI 채팅 (`/api/chat`)

### YouTube 레시피 추출 파이프라인 (`youtube_automation.py`)

```
1순위: 고정댓글 + 더보기란 텍스트 → Groq (무료, 병렬)
    ↓ 재료 4개 미만 OR 순서 3단계 미만이면
2순위: Gemini 2.5 Flash 영상 직접 분석 (유료, ~35원/영상)
    ↓ 영상 분석도 실패하면
    → 에러 반환 (레스토랑/먹방 등 요리 영상 아님 안내)
```

**설계 결정:**
- 자막(transcript)·Whisper 제거 — 정확도 대비 효용 낮음
- Gemini가 2순위인 이유: 영상을 직접 보므로 Whisper(음성만)보다 정확
- 텍스트 소스가 충분하면 Gemini 미실행 → 비용 절감
- 재료/순서 중 하나만 부족해도 Gemini 트리거 → 부분 보완 가능

**품질 판단 기준:**
- 재료 ≥ 4개 AND 순서 ≥ 3단계 → 텍스트 소스 충분, Gemini 생략
- 미달 시 → Gemini로 부족한 항목 보완 (재료·순서 다른 소스에서 각각 채택 가능)

**레스토랑/먹방 감지:**
- 3개 프롬프트(Groq, Gemini 텍스트, Gemini 영상) 모두에 명시적 거부 규칙 포함
- 분석 불가 시 에러 메시지에 이유 설명

**Gemini 모델 선택:**
- `gemini-2.5-flash` 사용 — 영상 직접 분석 지원 모델 중 가장 안정적
- 2.0 Flash 계열은 영상 입력 미지원(404), 2.5 Flash Lite는 수요 불안정(503)

### 단계별 이미지 추출 파이프라인 (`youtube_automation.py`)

Gemini 1차 분석 시 `step_images` 타임스탬프를 함께 추출하고, 별도 파이프라인으로 이미지를 Supabase Storage에 업로드.

```
Gemini 1차 호출 (레시피 분석)
    └─ step_images: [{ step_index, timestamp }] (최대 4개)
         ↓
yt-dlp -g: bestvideo 스트림 URL 추출 (다운로드 없음)
         ↓
ffmpeg: 타임스탬프 ±4초 범위 7장 후보 프레임 추출
        (pre-seek 2s + 정밀 시킹 2s, quality -q:v 1)
         ↓
Laplacian 분산 상위 50% 필터 (블러 제거)
         ↓
Gemini Vision 2차 호출: 후보 중 최적 1장 선택
    선택 기준: 손/팔 없음, 동작 끝난 결과물, 음식이 주인공
         ↓
Supabase Storage: recipe-images/{video_id}/step_{n}.jpg 업로드
         ↓
recipes.step_images JSONB 저장
    {
      "dish": "https://img.youtube.com/vi/{id}/maxresdefault.jpg",
      "0": "https://.../step_0.jpg",
      "3": "https://.../step_3.jpg"
    }
```

**완성 요리 사진 (`dish`):** YouTube `maxresdefault.jpg` 썸네일 직접 사용. 크리에이터가 선택한 고화질 컷으로 별도 추출 불필요.

**핵심 함수:**
| 함수 | 역할 |
|------|------|
| `get_best_thumbnail_url(video_id)` | maxresdefault → sddefault → hqdefault 순서로 10KB 이상인 최고화질 썸네일 URL 반환 |
| `extract_step_frames(video_id, step_images, output_dir)` | yt-dlp 스트림 + ffmpeg 더블 시킹으로 단계별 최적 프레임 추출 |
| `_select_best_frame_with_gemini(candidate_paths)` | Gemini Vision으로 후보 중 최적 프레임 인덱스 반환 |
| `upload_step_frames_to_supabase(video_id, frame_paths)` | recipe-images 버킷에 업로드, `{step_index: url}` 반환 |
| `process_step_images(video_id, step_images)` | 위 함수들을 조율하는 오케스트레이터, dish 키 추가 후 최종 dict 반환 |

### Supabase 접근 방식
SDK 미사용. `requests`로 Supabase REST API 직접 호출.
```python
_http.post(f'{_supabase_url}/rest/v1/recipes', headers=supabase_headers, json=payload)
```
이유: Railway Python 환경에서 supabase-py 의존성 관리 복잡도 회피.

### 주요 엔드포인트
| 메서드 | 경로 | 역할 |
|--------|------|------|
| POST | `/analyze` | YouTube URL → 레시피 파싱 (저장 안 함) |
| POST | `/analyze-save` | YouTube URL → 파싱 + Supabase 저장 |
| POST | `/save-recipe` | 레시피 수동 저장 |
| POST | `/delete-recipe` | 레시피 삭제 |
| PATCH | `/api/recipes` | 레시피 부분 수정 (제목, 재료, 숨김 등) |
| POST | `/upload-thumbnail` | 썸네일 업로드 |
| POST | `/auth/kakao/exchange` | 카카오 code → Supabase 세션 |
| GET/POST/DELETE | `/api/bookmarks` | 북마크 CRUD |
| POST | `/api/chat` | AI 채팅 |

---

## 데이터 흐름 — 레시피 숨김 처리

모바일/시크릿 버그를 겪은 이후 확립된 규칙:

```
Supabase status 필드
    ↓ sortedData 생성 시
hidden = edit?.hidden !== undefined ? edit.hidden : status === 'hidden'
    ↓ filteredResults
.filter(r => !r.hidden || isCreator)   ← r.hidden 사용 (localStorage 아님)
```

localStorage `recipeEdits`는 크리에이터 편집 임시 저장용.  
숨김 상태 판단의 최종 소스는 sortedData.hidden.

---

## 성능 전략

**레시피 로드 (stale-while-revalidate):**
1. localStorage 캐시 있으면 즉시 표시 → recipeLoading=false
2. 백그라운드로 Supabase fetch → 완료 시 갱신 + 캐시 업데이트
3. 캐시 없으면 (첫 방문): skeleton 12개 표시 → 데이터 도착 시 교체

**애니메이션:** CSS only (`fadeInUp`, `shimmer`) — JS 부하 없음.
