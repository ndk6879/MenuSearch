# Findish — 프로젝트 문서 인덱스

> 이 폴더는 AI가 프로젝트 맥락을 정확히 파악하고 이어서 작업할 수 있도록 작성된 문서 모음입니다.

## 문서 목록

| 파일 | 내용 |
|------|------|
| [auth.md](./auth.md) | 소셜 로그인(카카오/구글) 전체 아키텍처 및 구현 상세 (Supabase 기반) |
| [deployment.md](./deployment.md) | Vercel + Railway 배포 환경 및 환경변수 |
| [known-issues.md](./known-issues.md) | 해결된 버그 및 현재 주의사항 |
| [login-modal-ui.md](./login-modal-ui.md) | 로그인 모달 UI 디자인 결정 사항 |
| [business-strategy.md](./business-strategy.md) | 비즈니스 전략, 수익모델, Phase별 실행 계획 |
| [session-2026-07.md](./session-2026-07.md) | 2026-07 세션 작업 로그 (Firebase→Supabase, 버그 수정, 성능/UI 개선) |

## 프로젝트 한 줄 요약

**Findish** — 가지고 있는 재료로 만들 수 있는 레시피를 검색하는 웹앱.  
프론트엔드: React (Vercel 배포), 백엔드: Python Flask (Railway 배포), DB/Auth: Supabase.  
라이브: https://menu-search.vercel.app

## 현재 스택 (2026-07 기준)

| 역할 | 기술 | 비고 |
|------|------|------|
| 프론트엔드 | React (CRA) | Vercel 자동 배포 (main 브랜치) |
| 백엔드 | Python Flask | Railway 수동 배포 필요 |
| DB | Supabase (PostgreSQL) | recipes 테이블 |
| Auth | Supabase Auth | 카카오는 커스텀 구현 |
| 카카오 OAuth | 카카오 Developers | Railway가 code 교환 처리 |

## AI가 이어서 작업할 때 주의사항

1. **Firebase 없음** — `src/firebase.js`는 빈 파일. Supabase만 사용.
2. **Railway 수동 배포** — 백엔드 변경 후 `railway up --service cooperative-success --detach` 실행.
3. **Vercel CI=true** — ESLint warning이 빌드 에러로 처리됨. push 전 `CI=true npm run build` 확인.
4. **recipeEdits** — localStorage 기반. 모바일/시크릿에서는 항상 비어있음. 숨김/표시 등 핵심 로직에는 Supabase 데이터(sortedData) 사용.
5. **normalizeIng** — 단위 제거 정규식 포함. display 경로에 사용 금지, 검색/분류에만 사용.
