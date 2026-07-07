# 해결된 버그 및 주의사항

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
  `searchResults`가 `sortedData`의 초기값(빈 배열)을 캡처해 async로 불러온 데이터를 반영 안 함
- **해결:** 별도 useEffect로 동기화
  ```js
  useEffect(() => {
    if (!searchActive && selectedIngredients.length === 0) {
      setSearchResults(sortedData);
    }
  }, [recipeData, recipeEdits]); // recipeData: 초기 로드, recipeEdits: 편집 변경
  ```

### 3. 카카오 로그인 "missing OAuth secret" 에러
- **증상:** 카카오 로그인 시 Supabase에서 OAuth secret 오류
- **원인:** Supabase 내장 카카오 Provider를 사용하려다 설정 누락
- **해결:** Supabase 카카오 Provider를 아예 사용하지 않고 완전히 커스텀 구현  
  (카카오 → Railway 백엔드 → Supabase 이메일/패스워드 계정 생성/로그인)

### 4. Railway에서 `/auth/kakao/exchange` 404
- **증상:** 카카오 code 교환 요청이 404 반환
- **원인:** Railway가 GitHub push 시 자동 배포를 하지 않아 서버 코드가 구버전
- **해결:** `railway up --service cooperative-success --detach` 수동 실행

### 5. Vercel ESLint 빌드 에러 (CI=true)
- **증상:** `git push` 후 Vercel 빌드 실패
- **원인:** `filteredResults` useMemo deps에서 `recipeEdits` 제거했으나 deps 배열에는 남아있어 ESLint unused-deps 경고 → CI=true 환경에서 에러 처리
- **해결:** deps 배열에서도 `recipeEdits` 제거

### 6. 재료 개수가 모바일에서 사라지는 문제
- **증상:** "테스트 5개" → 모바일에서 "테스트"만 표시됨
- **원인:** `autoNormalize` 함수가 "개" 단위 suffix를 제거하는 정규식 포함.  
  `openEditMode`에서 display용 재료 목록에 `normalizeIng` 적용해버림
- **해결:** display 경로(openEditMode, 모달 표시)에서 `normalizeIng` 제거.  
  `normalizeIng`은 SEASONINGS 분류와 검색 매칭에만 사용

### 7. 비공개/공개 토글이 모바일/시크릿에서 동작 안 함
- **증상:** 크리에이터가 비공개 설정해도 모바일에서 여전히 레시피 표시됨
- **원인 1 (filteredResults):** `recipeEdits[r.url]?.hidden` 체크 — localStorage 기반이라 모바일/시크릿에서 항상 undefined
  - **해결:** `r.hidden` (sortedData의 hidden 필드) 사용
- **원인 2 (sortedData):** `edit.hidden = false`인데 `status = 'hidden'` → `status==='hidden' || false = true` (비공개 유지)
  - **해결:** `edit?.hidden !== undefined ? edit.hidden : item.status === 'hidden'`

### 8. 썸네일이 모바일/시크릿에서 안 뜨는 문제
- **증상:** 썸네일 업로드 후 데스크탑에선 보이지만 모바일에서 기본 유튜브 썸네일로 표시
- **원인:** `makeCardProps`에서 `thumbnailOverrides` (localStorage)를 우선 참조. 모바일은 localStorage 달라서 override 없음
- **해결:** `sortedData`의 `item.thumbnail` (Supabase에서 불러온 thumbnail_url) 우선 사용

### 9. 제목 수정이 새로고침 없이 반영 안 되는 문제
- **증상:** 크리에이터가 제목 수정 후 카드에 즉시 반영 안 됨
- **원인:** sortedData의 이름이 recipeEdits(localStorage)에서 오는데, searchResults 동기화 useEffect deps에 `recipeEdits` 포함 안 됨
- **해결:** `[recipeData, recipeEdits]` deps에 recipeEdits 추가

### 10. 페이드인 애니메이션 미적용
- **증상:** `animation: fadeInUp` CSS 추가했으나 효과 없음
- **원인:** `.menu-card` 블록에 `transform: translateZ(0)` 이 있어 animation의 transform과 충돌
- **해결:** `transform: translateZ(0)` 제거, animation을 메인 `.menu-card` 블록에 직접 정의

---

## 2026-06 이전 버그 (Firebase 시절)

### Firestore "Missing or insufficient permissions"
- Firestore Rules 미설정 → `firebase deploy --only firestore:rules` 로 해결
- **현재:** Firebase 완전 제거됨, 해당 없음

### 환경변수 trailing newline 버그
- Vercel CLI로 env var 추가 시 값 끝에 `\n` 자동 삽입
- `REACT_APP_KAKAO_REST_KEY`, `REACT_APP_API_BASE` 등 영향 받음
- **해결:** Vercel 대시보드 웹 UI로 직접 입력

### KOE006 — Redirect URI 불일치
- URI 슬래시 유무 불일치 → Kakao Developers에 슬래시 있는/없는 URI 둘 다 등록

---

## 현재 남은 주의사항

### Railway 수동 배포
- Railway가 GitHub push 자동 배포 안 함
- 백엔드 코드 변경 시 반드시: `railway up --service cooperative-success --detach`

### 크리에이터 로그인 보안
- `REACT_APP_CREATOR_CREDS` 가 빌드 번들에 포함 → 브라우저 개발자 도구로 열람 가능
- 크리에이터 수 증가 시 Railway 백엔드 인증으로 이전 필요

### localStorage 캐시 (findish_recipes_kr_v1)
- stale-while-revalidate 패턴: 캐시 즉시 표시 → Supabase로 백그라운드 갱신
- 모바일/시크릿에서는 캐시 없으므로 Supabase 응답 전까지 스켈레톤 표시

### Kakao Redirect URI
- 새 도메인 추가 시 Kakao Developers → 내 애플리케이션 → 카카오 로그인 → Redirect URI에 등록 필요
- 현재 등록: `https://menu-search.vercel.app`, `https://menu-search.vercel.app/`
