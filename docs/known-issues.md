# 해결된 버그 및 주의사항

## 2026-08 세션에서 해결된 버그

### 11. 카카오 로그인 후 URL에 access_token 노출
- **증상:** 로그인 후 또는 뒤로가기 시 `/#access_token=eyJ...` 가 URL에 노출됨
- **원인:** Supabase OAuth 콜백이 토큰을 URL 해시로 전달하는 방식, 히스토리에 잔류
- **해결:** `SIGNED_IN` 이벤트 및 앱 마운트 시 `window.history.replaceState`로 즉시 제거

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
