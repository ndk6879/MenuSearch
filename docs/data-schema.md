# Data Schema

## Supabase (PostgreSQL) — 서버 상태

### recipes
```
name           text          레시피 이름
url            text  UNIQUE  유튜브 URL (PK 역할)
uploader       text          크리에이터 키 (chefConfig 키와 일치)
upload_date    text          YYYY-MM-DD
ingredients    text[]        원본 문자열 그대로 저장 ("다진마늘 2큰술")
steps          text[]        조리 순서
source         text          출처/셰프명
status         text          'active' | 'hidden'
thumbnail_url  text          S3/Storage URL (없으면 유튜브 썸네일 fallback)
language       text          'kr' | 'en'
step_images    jsonb         단계별 이미지 URL 맵 (2026-07-31 추가)
```
> url이 사실상 PK. 중복 체크, upsert 모두 url 기준.  
> ingredients는 파싱 안 하고 원본 저장 — 파싱은 프론트에서 `parseIngText()`로 런타임에 처리.

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
  name: string,           // edit?.name || item.name
  url: string,
  uploader: string,
  upload_date: string,
  ingredients: string[],  // edit?.mainIngredients + edit?.seasonings || item.ingredients
  steps: string[],
  source: string,
  hidden: boolean,        // edit?.hidden !== undefined ? edit.hidden : status === 'hidden'
  thumbnail: string|null, // thumbnailOverrides[url] || item.thumbnail_url || null
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
