# Data Schema

## Supabase (PostgreSQL) — 서버 상태

### recipes
```
name                 text          레시피 이름
url                  text  UNIQUE  유튜브 URL (PK 역할)
uploader             text          크리에이터 키 (chefConfig 키와 일치)
upload_date          text          YYYY-MM-DD
ingredients          text[]        원본 재료명 그대로 저장 ("다진마늘", "바지락")
ingredients_measured text[]        재료별 용량 문자열 ("바지락 400g"). ingredients와 인덱스 동기화
ingredients_sources  text[]        재료별 용량 출처 ("groq"|"고정댓글"|"더보기란"|"video_audio" 등). ingredients와 인덱스 동기화
steps                text[]        조리 순서
tips                 text[]        크리에이터 TIP — Gemini가 영상에서 추출, 최소 3개 (부족시 Gemini 지식으로 보충)
servings             text          분량 ("2인분", "4인분" 등)
tags                 text[]        분류 태그 (아래 태그 체계 참고)
source               text          출처/셰프명
status               text          'active' | 'hidden'
thumbnail_url        text          S3/Storage URL (없으면 유튜브 썸네일 fallback)
language             text          'kr' | 'en'
step_images          jsonb         단계별 이미지 URL 맵 (2026-07-31 추가)
```
> url이 사실상 PK. 중복 체크, upsert 모두 url 기준.  
> ingredients는 파싱 안 하고 원본 저장 — 파싱은 프론트에서 `parseIngText()`로 런타임에 처리.  
> ingredients_measured는 Groq(llama-3.3-70b)가 Gemini 확정 재료 기반으로 용량 추정. ingredients와 인덱스 동기화 필수.  
> ingredients_sources는 각 용량의 출처. "groq"(추정), "고정댓글"/"더보기란"(크리에이터 명시). 신규 분석 레시피부터 저장됨.

**태그 체계:**
| 카테고리 | 값 |
|---------|-----|
| 분량 | "1인분", "2인분", "3~4인분", "파티용" |
| 음식 종류 | "밥", "면류", "파스타", "고기", "해산물", "샐러드", "국물요리" |
| 조리 특성 | "30분 이내", "초보 가능", "재료해치우기", "밀프랩/도시락", "에어프라이어", "오븐" |
| 상황 | "다이어트", "술안주", "단백질", "브런치", "야식", "아이반찬", "손님상" |

> servings는 tags에서 분량 값과 동일하게 저장 (UI에서 별도 강조 표시용).  
> 태그 중복 제거: 프론트에서 servings와 겹치는 태그는 extraTags 렌더링에서 필터링.

**step_images 구조:**
```json
{
  "dish": "https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
  "0": "https://.../recipe-images/{video_id}/step_0.jpg",
  "3": "https://.../recipe-images/{video_id}/step_3.jpg"
}
```
- `"dish"`: 완성 요리 사진. YouTube `maxresdefault.jpg` 썸네일 직접 사용 (크리에이터가 선택한 고화질 컷)
- `"0"`, `"3"` ...: 순서 배열 인덱스(0-based) → Supabase Storage 업로드 URL
- 이미지가 없는 단계는 키 자체가 없음 (null 아님)

**Supabase Storage 버킷:** `recipe-images` (public)  
**경로 규칙:** `{video_id}/step_{n}.jpg`

### bookmarks
```
user_id    text    Supabase auth uid
recipe_url text    recipes.url 참조
```
> 소셜 유저(카카오/구글)만 사용. 크리에이터는 bookmarks 없음.

---

## localStorage — 클라이언트 캐시

| 키 | 값 형식 | 용도 |
|----|---------|------|
| `findish_recipes_kr_v1` | `Recipe[]` JSON | 레시피 데이터 stale-while-revalidate 캐시 |
| `findish_social` | `{ uid, displayName, photoURL, email, provider }` | 소셜 유저 세션 즉시 복원 |
| `findish_creator` | `{ alias, uploaderName }` | 크리에이터 세션 유지 |
| `findish_recipe_edits` | `{ [url]: { name, mainIngredients, seasonings, hidden } }` | 크리에이터 편집 중 로컬 임시 저장 |
| `findish_thumbnails` | `{ [url]: string }` | 썸네일 업로드 후 로컬 override (deprecated — Supabase 반영 후 불필요) |
| `findish_dark` | `'true' \| 'false'` | 다크모드 설정 |
| `draft_edit_{url}` | `{ draft, ingredientsList, stepsList, savedAt }` | 편집 패널 미저장 draft |

> **주의:** `recipeEdits`, `thumbnailOverrides`는 localStorage 기반이라 모바일/시크릿에서 항상 비어있음.  
> 숨김 여부 등 핵심 상태는 반드시 Supabase에서 온 `sortedData` 기준으로 판단.

---

## 프론트엔드 런타임 데이터 구조

### sortedData (useMemo)
`recipeData` (Supabase raw) + `recipeEdits` (localStorage) 머지 결과.
```js
{
  name: string,                    // edit?.name || item.name
  url: string,
  uploader: string,
  upload_date: string,
  ingredients: string[],           // edit?.mainIngredients + edit?.seasonings || item.ingredients
  ingredients_measured: string[],  // item.ingredients_measured (Groq 추정 용량, 인덱스 동기화)
  ingredients_sources: string[],   // item.ingredients_sources ("groq"|"고정댓글"|"더보기란" 등)
  steps: string[],
  tips: string[],                  // item.tips (Gemini 추출, 최소 3개)
  servings: string,                // edit?.servings || item.servings
  tags: string[],                  // item.tags
  source: string,
  hidden: boolean,                 // edit?.hidden !== undefined ? edit.hidden : status === 'hidden'
  thumbnail: string|null,          // thumbnailOverrides[url] || item.thumbnail_url || null
  language: string,
}
```

### chefConfig (src/chefConfig.js)
크리에이터 메타데이터. `uploader` 키로 접근.
```js
{
  "minyokki": { displayName: "민쪽이", slug: "minyokki", ... }
}
```
