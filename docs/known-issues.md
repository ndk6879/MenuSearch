# 해결된 버그 및 주의사항

## 2026-08-16 갤러리 이미지 파이프라인 개선

### 갤러리 사람 사진 문제
- **증상:** 갤러리에 크리에이터 얼굴·상반신 사진이 섞여 나옴
- **원인 (복합):**
  1. Gemini가 강제로 1장 선택 — 후보 전부 사람 사진이어도 하나를 골라야 했음
  2. 선명도 pre-filter가 사람 사진을 오히려 우선 후보로 올리는 역효과
  3. 세 곳(analyze_video, generate_step_timestamps, _select_best_frame)의 사람 기준이 서로 달랐음
- **해결:**
  - NONE 반환 도입: 적합한 프레임 없으면 NONE → ±15초 확장 재탐색 → 그래도 없으면 step 건너뜀
  - 선명도 pre-filter 제거 → 20장 전부 Gemini에 전달
  - 사람 기준 통일: 얼굴·상반신 메인 → ❌ / 손·팔 일부 + 음식 메인 → ✅
  - 타임스탬프 코드 레벨 검증 추가 (오름차순, 중복, 범위)

### 갤러리 UX 변경 (2026-08-16)
- 라이트박스 하단 step 캡션 제거
- 갤러리가 step 순서와 1:1 매핑 강제 해제 → 없는 step은 그냥 빠짐
- 사진 개수 ≠ step 개수 허용

---

## 2026-08 세션에서 해결된 버그

### 11. 카카오 로그인 후 URL에 access_token 노출
- **증상:** 로그인 후 또는 뒤로가기 시 `/#access_token=eyJ...` 가 URL에 노출됨
- **원인:** Supabase OAuth 콜백이 토큰을 URL 해시로 전달하는 방식, 히스토리에 잔류
- **해결:** `SIGNED_IN` 이벤트에서 `window.history.replaceState`로 제거 (앱 마운트 시 제거는 #14 버그 참고)

### 14. 카카오 로그인 후 UI 안 바뀜 (로그인 버튼 그대로)
- **증상:** 카카오 인증 완료 후 메인으로 리다이렉트 되는데 이름/프로필 미표시, 로그인 버튼 그대로
- **원인:** 앱 마운트 시 `#access_token=...`을 지우는 useEffect가 Supabase의 token 읽기보다 먼저 실행 → Supabase가 세션 수립 못 함 → `SIGNED_IN` 이벤트 미발화
- **해결:** 앱 마운트 hash 정리 useEffect 삭제. `SIGNED_IN` 핸들러의 hash 정리만 유지 (Supabase가 token 읽은 후 실행)

### 15. 크리에이터 로그인 prod에서 안 됨
- **증상:** prod에서 minyokki/111111 로그인 실패
- **원인:** Railway에 `CREATOR_CREDS` 미등록 + Flask `/auth/creator` 구조 자체의 이중 관리 문제
- **해결:** 크리에이터 인증을 `supabase.auth.signInWithPassword({ email: 'alias@findish.internal' })`로 전환. Railway 불필요.

### 16. 북마크 다른 기기/시크릿에서 안 보임
- **증상:** 북마크 후 같은 세션에서는 보이나 다른 기기/시크릿에서 미표시
- **원인:** Supabase RLS INSERT 정책 없어서 실제 저장 실패, optimistic update로만 화면에 표시
- **해결:** `users_own_bookmarks` RLS 정책 추가 + bookmarkUid를 실제 Supabase UUID로 변경

### 17. 로그아웃 후 로그인 모달이 크리에이터 폼으로 뜸
- **증상:** 크리에이터 로그인 후 로그아웃 → 로그인 버튼 누르면 카카오 화면 대신 크리에이터 ID/PW 폼이 바로 뜸
- **원인:** `LoginModal`이 항상 마운트 상태라 `showCreatorForm` state가 로그아웃 시 리셋 안 됨
- **해결:** `useEffect(() => { if (!open) setShowCreatorForm(false); }, [open])` 추가

### 18. 재료 편집 후 재료명-용량 인덱스 어긋남 (1차 수정 — 불완전)
- **증상:** 크리에이터가 재료 편집 저장 후 "생크림" 칩에 "파스타 150~200g" 표시 등 재료-용량 불일치
- **원인:** `saveEditDraft`가 `ingredients`만 PATCH, `ingredients_measured`는 갱신 안 함
- **해결:** `measuredAmountMap`을 saveEditDraft로 전달, PATCH body에 `ingredients_measured` 포함
- **주의:** 아래 #19에서 근본 원인 추가 수정됨

### 19. ingredients_measured 인덱스 어긋남 근본 수정 (2026-08-08)
- **증상:** 재료 순서 변경 후 저장하면 재료명-용량이 한 칸씩 밀림 (#18 수정 후에도 잔존)
- **원인:** `sortedData`에서 recipeEdits가 있으면 `ingredients`를 재배열 버전으로 교체하지만 `measuredRaw`는 DB 원본 인덱스 기준 → `ingMeasuredMap` 오염. display `measuredAmountMap`도 동일 문제.
- **해결:** index 기반 → **이름 prefix 기반** 파싱으로 전환. `ingredients_measured` 각 항목이 `"재료명 용량"` 형식임을 이용해 `startsWith(ing.trim() + ' ')`로 매칭. 기존 DB 오염 데이터도 자동 복구됨.

### 20. 북마크 해제 시 MY NOTE 유실 (2026-08-08)
- **증상:** 북마크 해제 후 재등록하면 작성했던 메모가 사라짐
- **원인:** 북마크 해제 시 `bookmarks` row를 DELETE → `note` 컬럼도 삭제
- **해결:** soft-delete 전환. `bookmarked boolean` 컬럼 추가, 해제 시 `UPDATE SET bookmarked=false`, 재등록 시 `upsert + bookmarked=true`. note 영구 보존.

### 12. 크리에이터 로그인 실패 (로컬)
- **증상:** `minyokki/111111` 로그인 안 됨
- **원인:** Flask 백엔드가 읽는 `CREATOR_CREDS` 환경변수가 `.env`에 없었음 (`.env.vercel`에만 `REACT_APP_` 버전으로 존재)
- **해결:** `.env`에 `CREATOR_CREDS=minyokki:111111:미뇨끼|...` 추가

### 13. KOE205 — account_email 동의항목 미설정
- **증상:** 카카오 로그인 시 "설정하지 않은 동의 항목: account_email" 에러
- **원인:** Supabase Native OAuth가 `account_email` 스코프를 항상 요청하는데, 비즈 앱이 아니면 이 항목 활성화 불가
- **해결:** 카카오 비즈 앱 전환 (개인 개발자 본인인증) → 이메일 필수 동의항목 활성화

---

## 2026-07 세션에서 해결된 버그 (Firebase→Supabase 마이그레이션 이후)

### 1. socialLoading stuck after logout
- **증상:** 로그아웃 후 소셜 버튼 대신 로딩 스피너가 무한으로 표시
- **원인:** `SIGNED_OUT` 이벤트 핸들러에서 `setSocialLoading(false)` 누락
- **해결:**
  ```js
  const _clearSession = () => {
    setSocialUser(null); setCreatorUser(null);
    localStorage.removeItem('findish_social');
    localStorage.removeItem('findish_creator');
    setSocialLoading(false); // 추가
  };
  ```

### 2. 레시피 카드가 prod/dev에서 안 보이는 문제
- **증상:** 페이지 로드 후 레시피가 표시 안 됨
- **원인:** `useState(sortedData)` — 초기값 캡처 트랩.
- **해결:** 별도 useEffect로 동기화

### 3. 카카오 로그인 커스텀 구현 → Native OAuth 전환 (2026-08-06)
- **구버전:** Railway 백엔드 `/auth/kakao/exchange`에서 가짜 이메일(`kakao{id}@findish.app`) + SHA256 비밀번호로 Supabase 계정 생성
- **현재:** `supabase.auth.signInWithOAuth({ provider: 'kakao' })` 한 줄. Supabase가 전부 처리.

### 4. Vercel ESLint 빌드 에러 (CI=true)
- **증상:** `git push` 후 Vercel 빌드 실패
- **원인:** `filteredResults` useMemo deps 불일치 → ESLint 에러
- **해결:** deps 배열 정리

### 5~10. (생략 — 레시피 카드/썸네일/애니메이션 관련)
- 상세 내용은 git log 참고

---

## 현재 남은 주의사항

### 크리에이터 비밀번호 강도
- 현재 `111111` — 추후 강화 필요
- Supabase Dashboard → Authentication → Users에서 변경

### Railway 수동 배포
- Railway가 GitHub push 자동 배포 안 함
- 백엔드 코드 변경 시 반드시: `railway up --service cooperative-success --detach`
- **북마크/인증은 이제 Railway 불필요** — 레시피 편집(PATCH)만 Railway 사용

### Kakao Redirect URI
- 새 도메인 추가 시 두 곳에 등록 필요:
  1. 카카오 개발자 콘솔 → 앱 → 플랫폼 키 → REST API 키 → 로그인 리다이렉트 URI
  2. (Supabase callback URL은 고정: `https://rqyfuzdwhusrnxrhlpps.supabase.co/auth/v1/callback`)
- 현재 등록: Supabase callback URL, `http://localhost:3000`

### localStorage 캐시 (findish_recipes_kr_v1)
- stale-while-revalidate 패턴: 캐시 즉시 표시 → Supabase로 백그라운드 갱신
- 모바일/시크릿에서는 캐시 없으므로 Supabase 응답 전까지 스켈레톤 표시
