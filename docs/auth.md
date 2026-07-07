# 인증 시스템 (Authentication)

> **2026-07 기준 — Firebase 제거, Supabase 전환 완료**

## 개요

| 방식 | 대상 | 상태 |
|------|------|------|
| 카카오 로그인 | 일반 사용자 | 운영 중 |
| 구글 로그인 | 일반 사용자 | 운영 중 |
| 크리에이터 ID/PW | 등록된 크리에이터 | 운영 중 |

---

## 아키텍처

```
[브라우저]
   │
   ├─ 카카오 버튼 클릭
   │     └─ window.location.href = 카카오 OAuth URL (redirect 방식)
   │           └─ 카카오 동의 → redirect_uri(=현재 페이지)로 ?code=XXX 붙어서 복귀
   │                 └─ App.js useEffect에서 code 감지
   │                       └─ Railway POST /auth/kakao/exchange
   │                             ├─ 카카오 token 교환
   │                             ├─ 카카오 유저 정보 조회
   │                             ├─ Supabase에 kakao{id}@findish.app 계정 생성/로그인
   │                             └─ Supabase session(access_token, refresh_token) 반환
   │                                   └─ supabase.auth.setSession(session)
   │
   ├─ 구글 버튼 클릭
   │     └─ supabase.auth.signInWithOAuth({ provider: 'google' })
   │
   └─ 크리에이터 로그인
         └─ REACT_APP_CREATOR_CREDS 환경변수 대조 (Supabase 사용 안 함)

[Railway Flask 백엔드]
   └─ POST /auth/kakao/exchange
         ├─ 카카오 code + redirect_uri → 카카오 access_token 교환
         ├─ 카카오 /v2/user/me → 유저 ID, 닉네임, 프로필 이미지
         ├─ email = kakao{id}@findish.app, password = SHA256(kakao_{id}_findish_secret)
         ├─ Supabase Admin API: 계정 로그인 시도 → 없으면 계정 생성 후 재로그인
         └─ Supabase session 반환 → 프론트엔드로 전달
```

---

## 카카오 로그인 상세

### 리다이렉트 방식 (팝업 X)
페이지 자체를 카카오 로그인으로 이동시킨 뒤 code와 함께 복귀.

**흐름:**
1. `handleKakaoLogin()` → `window.location.href = kakaoOAuthUrl`
2. 카카오 동의 완료 → `redirect_uri` (현재 도메인)로 복귀, URL에 `?code=XXX` 포함
3. App.js 마운트 시 useEffect: `new URLSearchParams(window.location.search).get('code')`
4. code 있으면 `window.history.replaceState` 로 URL 정리 (code 제거)
5. Railway `POST /auth/kakao/exchange` 호출
6. 반환된 session으로 `supabase.auth.setSession(session)`
7. Supabase `onAuthStateChanged` → `socialUser` state 설정 + localStorage 캐시

### 카카오 계정 매핑 전략
Supabase에 카카오 전용 Provider가 없으므로 이메일/패스워드 방식으로 우회:
- email: `kakao{카카오ID}@findish.app`
- password: `SHA256("kakao_{카카오ID}_findish_secret")`
- 최초 로그인 시 계정 자동 생성 (`email_confirm: true`)

### Kakao Developers 설정
- **앱 키:** `REACT_APP_KAKAO_REST_KEY` (REST API 키)
- **등록된 Redirect URIs:**
  - `https://menu-search.vercel.app`
  - `https://menu-search.vercel.app/` (슬래시 포함 버전도 등록)
- **동의항목:** 닉네임(선택), 프로필 사진(선택)
- **Client Secret:** 활성화됨 → Railway 환경변수 `KAKAO_CLIENT_SECRET` 필요

---

## 구글 로그인 상세

Supabase의 내장 Google OAuth Provider 사용:
```js
supabase.auth.signInWithOAuth({ provider: 'google' })
```
Supabase Dashboard → Authentication → Providers → Google 활성화 필요.  
별도 백엔드 불필요.

---

## 크리에이터 로그인

환경변수 `REACT_APP_CREATOR_CREDS`에 `alias:password:uploaderName` 형식 저장.  
여러 크리에이터는 `|`로 구분.  
예: `chef1:pass123:홍길동|chef2:pass456:김철수`

Supabase를 사용하지 않으며, `creatorUser` state로 별도 관리.

> **보안 주의:** credentials가 빌드 번들에 포함되어 브라우저 개발자 도구로 열람 가능.  
> 크리에이터 수 증가 시 Railway 백엔드 인증으로 이전 필요.

---

## 세션 관리

### socialUser (카카오/구글)
```js
// App.js — Supabase onAuthStateChanged
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session) _applySession(session);
  if (event === 'SIGNED_OUT') _clearSession();
});

// 앱 시작 시 세션 복원
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) _applySession(session);
  setSocialLoading(false);
}).catch(() => setSocialLoading(false));
```

### localStorage 캐시
- `findish_social`: `{ uid, displayName, photoURL, email, provider }` — UI 즉시 복원용
- `findish_creator`: 크리에이터 로그인 정보

### 로그아웃
```js
const handleLogout = async () => {
  await supabase.auth.signOut();
  _clearSession(); // socialUser=null, creatorUser=null, localStorage 정리
};
```

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/App.js` | `socialUser` state, 카카오 code 처리 useEffect, 로그인/로그아웃 핸들러 |
| `src/supabase.js` | Supabase 클라이언트 초기화 |
| `api_server.py` | `/auth/kakao/exchange` 엔드포인트 (Railway 배포) |
