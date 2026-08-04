# CLAUDE.md

This file provides guidance to Claude Code when working in the MenuSearch/ directory.

## Project Overview

**Findish** — 재료 기반 레시피 검색 플랫폼. 크리에이터(요리 유튜버)가 레시피를 등록하면 유저가 냉장고 재료로 검색하는 구조.

Live: https://menu-search.vercel.app/  
Branch 전략: `main` (production) / `dev` (개발)

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js (CRA) |
| Backend | Python Flask (:8000) |
| Database | Supabase (PostgreSQL) |
| Storage | Supabase Storage (`recipe-images` bucket) |
| AI - 영상 분석 | Gemini 2.5 Flash |
| AI - 용량 추정 | Groq (llama-3.3-70b-versatile) |
| Auth | Supabase Auth (Google/Kakao 소셜 + 크리에이터 커스텀) |
| Deploy | Vercel (frontend only; Flask는 로컬/별도 서버) |

## Common Commands

### Frontend (from MenuSearch/)
```bash
npm start                           # dev server http://localhost:3000
npm run build                       # production build
npm test -- --watchAll=false        # run tests once
```

### Backend (from MenuSearch/)
```bash
python api_server.py                # Flask API http://localhost:8000
```

Python dependencies:
```bash
pip install flask flask-cors google-generativeai groq python-dotenv requests
```

## Environment Variables

`.env` in MenuSearch/:
```
YOUTUBE_API_KEY=<your_key>
GEMINI_API_KEY=<your_key>
GROQ_API_KEY=<your_key>
REACT_APP_SUPABASE_URL=<your_key>
REACT_APP_SUPABASE_ANON_KEY=<your_key>
SUPABASE_URL=<your_key>
SUPABASE_ANON_KEY=<your_key>
SUPABASE_SERVICE_ROLE_KEY=<your_key>
```
> `REACT_APP_*` — 프론트엔드용 (빌드 시 번들). 나머지는 Flask 서버용.

## Architecture

```
React Frontend (:3000)
    ↓ /analyze-save, /save-recipe, /check-duplicate
Flask Backend (:8000)
    ↓ Gemini 2.5 Flash (영상 관찰 → 재료/순서/tips/servings/tags)
    ↓ Groq llama-3.3-70b (용량 추정 → ingredients_measured)
    ↓
Supabase PostgreSQL (recipes 테이블)
Supabase Storage (step images)
```

## Key Files

| File | Purpose |
|------|---------|
| `src/App.js` | 메인 컴포넌트 — Supabase 데이터 로드, 재료 정규화(200+ 매핑), 검색, 레시피 모달 |
| `src/components/AnalyzePanel.js` | YouTube URL 분석 UI — 3탭(영상/채널/최근분석), 저장/덮어쓰기 |
| `src/chefConfig.js` | 크리에이터 메타데이터 (`uploader` 키로 접근) |
| `src/supabase.js` | Supabase 클라이언트 초기화 |
| `src/firebase.js` | Firebase/소셜 인증 |
| `api_server.py` | Flask REST API |
| `youtube_automation.py` | Gemini+Groq 레시피 추출 파이프라인 |
| `src/index.css` | 전역 스타일 (다크모드 포함) |
| `docs/` | 설계 문서 (data-schema, adr, session 로그 등) |

## Supabase recipes 테이블 주요 컬럼

```
url                  text UNIQUE   유튜브 URL (사실상 PK)
name                 text          레시피 이름
uploader             text          크리에이터 키 (chefConfig 키와 일치)
ingredients          text[]        재료명 원본
ingredients_measured text[]        용량 문자열 — ingredients와 인덱스 동기화
steps                text[]        조리 순서
tips                 text[]        크리에이터 팁 (최소 3개)
servings             text          분량 ("2인분" 등)
tags                 text[]        분류 태그
status               text          'active' | 'hidden'
step_images          jsonb         단계별 이미지 URL 맵
```

> 전체 스키마: `docs/data-schema.md` 참고

## Code Patterns

- **재료 정규화**: `App.js`의 대형 매핑 객체로 한국어 재료명 표준화
- **sortedData**: Supabase raw + localStorage recipeEdits 머지 결과 (useMemo)
- **저장 후 즉시 갱신**: `refreshRecipes` 콜백을 `AnalyzePanel`에 `onSaveSuccess` prop으로 전달
- **덮어쓰기**: UNIQUE constraint 기준이라 POST merge-duplicates 불가 → PATCH + `url` filter
- **다크모드**: `darkMode` prop으로 컴포넌트 트리 전달
- **분석 타임아웃**: 25초 AbortController (Gemini 영상 분석이 오래 걸림)
