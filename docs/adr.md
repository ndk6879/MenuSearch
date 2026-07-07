# Architecture Decision Records (ADR)

형식: 결정 사항 / 이유 / 포기한 대안

---

## ADR-001: Firebase → Supabase 전환 (2026-07)

**결정:** 인증과 DB를 Firebase/Firestore에서 Supabase로 전환.

**이유:**
- Firestore 쿼리가 재료 기반 검색에 부적합 (배열 필드 복합 필터 불가)
- Firebase 무료 티어 한계 (읽기 횟수)
- Supabase: PostgreSQL이라 배열 컬럼, 추후 full-text search 확장 용이

**포기한 대안:** Firebase 유지 + Elasticsearch 병행 → 운영 복잡도 과다

---

## ADR-002: 카카오 로그인 — Supabase Provider 미사용, 커스텀 구현

**결정:** Supabase 내장 카카오 Provider 대신 Railway 백엔드가 code 교환 후 이메일/패스워드 계정으로 매핑.

**이유:**
- Supabase 카카오 Provider: "missing OAuth secret" 에러, 설정 복잡
- 커스텀 방식: `kakao{id}@findish.app` 이메일로 Supabase 계정 생성 → Supabase 세션 그대로 활용
- 백엔드가 이미 Railway에 있어 추가 인프라 불필요

**트레이드오프:** 카카오 계정이 이메일 계정으로 위장됨 → Supabase Auth 대시보드에서 실사용자 구분 어려움.  
현재 볼륨(소수 사용자)에선 허용 가능.

**포기한 대안:** 팝업 방식(window.open) → 모바일 팝업 차단 이슈, 코드 복잡도 증가로 redirect 방식으로 전환

---

## ADR-003: 레시피 쓰기는 Railway 경유, 읽기는 프론트 직접

**결정:** 읽기(`SELECT`)는 프론트에서 Supabase anon key로 직접. 쓰기(`INSERT/UPDATE/DELETE`)는 Railway가 Service Role Key로 처리.

**이유:**
- Service Role Key는 RLS를 우회하는 전체 권한 → 프론트 번들에 포함 불가
- 읽기는 공개 데이터이므로 anon key로 충분
- 쓰기 검증 로직(YouTube 파싱, 중복 체크 등)이 어차피 백엔드에 있음

---

## ADR-004: App.js 단일 파일 집중

**결정:** 상태, 비즈니스 로직, 주요 컴포넌트를 App.js 하나에 집중.

**이유:**
- 솔로 개발 + AI 에이전트 협업 환경에서 파일 분산은 컨텍스트 비용 증가
- 컴포넌트 분리는 re-render 방지가 명확히 필요할 때만 (`RecipeCard`, `RecipeEditPanel`)
- 파일 수 줄이면 AI가 한 번에 전체 흐름 파악 가능

**트레이드오프:** App.js가 거대해짐(2500+ 줄). 향후 사용자 규모 커지면 재검토.

---

## ADR-005: ingredients 원본 저장, 파싱은 런타임

**결정:** Supabase에 `"다진마늘 2큰술"` 형태 원본 문자열 저장. 이름/수량 분리는 프론트 `parseIngText()`가 런타임에 처리.

**이유:**
- 파싱 규칙이 자주 바뀜 → DB 저장 시 파싱하면 레거시 데이터 마이그레이션 필요
- 원본 보존하면 파싱 개선 시 재처리 가능

**주의:** `normalizeIng()`은 동의어 정규화 함수로, display에 쓰면 단위 유실 버그 발생한 이력 있음. 검색/분류 전용으로만 사용.

---

## ADR-006: 숨김 상태 — Supabase status 필드가 최종 소스

**결정:** 레시피 숨김 여부는 `Supabase.recipes.status` 필드 기준. localStorage `recipeEdits.hidden`은 편집 중 임시 override만.

**이유:**
- localStorage는 기기/세션별로 다름 → 모바일/시크릿에서 localStorage 비어있으면 숨김 무시됨 (과거 버그)
- 크리에이터가 비공개 설정 → 모든 환경에서 일관되게 적용되어야 함

**구현 규칙:**
```js
hidden = edit?.hidden !== undefined ? edit.hidden : status === 'hidden'
// edit.hidden이 명시적으로 false여도 존중 (|| 연산자 사용 금지)
```

---

## ADR-007: 크리에이터 로그인 — 프론트엔드 환경변수 방식 (임시)

**결정:** 크리에이터 계정 정보를 `REACT_APP_CREATOR_CREDS` 환경변수에 저장, 프론트에서 대조.

**이유:** 크리에이터가 현재 1명. 빠른 구현 우선.

**알려진 한계:** 빌드 번들에 포함 → 브라우저 개발자 도구 열람 가능.

**마이그레이션 트리거:** 크리에이터 수 증가 또는 민감 기능(결제, 개인정보) 추가 시 Railway `/auth/creator` 백엔드 인증으로 이전.

---

## ADR-008: Railway 수동 배포

**결정:** Railway GitHub 자동 배포 비활성화, `railway up` 수동 실행.

**이유:** 자동 배포 설정 시 main push마다 서버 재시작 → 프론트 배포와 타이밍 불일치 위험. 백엔드 변경이 드물어 수동으로 충분.

**명령어:** `railway up --service cooperative-success --detach`
