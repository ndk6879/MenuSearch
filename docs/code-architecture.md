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
- YouTube 분석 (transcript → AI 파싱 → 레시피 추출)
- 썸네일 업로드 (S3/Storage)
- 북마크 CRUD (Supabase)
- AI 채팅 (`/api/chat`)

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
