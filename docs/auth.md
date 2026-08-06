# 인증 시스템 (Authentication)

> **2026-08-06 기준 — Supabase Native Kakao OAuth 전환 완료**

## 개요

| 방식 | 대상 | 상태 |
|------|------|------|
| 카카오 로그인 | 일반 사용자 | 운영 중 |
| 크리에이터 ID/PW | 등록된 크리에이터 | 운영 중 |

---

## 아키텍처

```
[브라우저]
   │
   ├─ 카카오 버튼 클릭
   │     └─ supabase.auth.signInWithOAuth({ provider: 'kakao' })
   │           └─ Supabase가 카카오 OAuth 전체 처리
   │                 └─ 카카오 동의 → Supabase callback URL로 복귀
   │                       └─ onAuthStateChange('SIGNED_IN') 발화
   │                             └─ _applySession() → socialUser state 설정
   │
   └─ 크리에이터 로그인
         └─ Flask POST /auth/creator → Supabase session 반환
               └─ supabase.auth.setSession(session)
                     └─ onAuthStateChange('SIGNED_IN') 발화
```

백엔드 별도 카카오 처리 없음. Supabase가 토큰 교환, 유저 생성, 세션 관리 전담.

---

## 카카오 로그인 상세

### Supabase Native OAuth (redirect 방식)

```js
// LoginModal 내부
await supabase.auth.signInWithOAuth({
  provider: 'kakao',
  options: {
    redirectTo: window.location.origin,
    scopes: 'profile_nickname profile_image',
  },
});
```

**흐름:**
1. `signInWithOAuth()` 호출 → Supabase가 카카오 OAuth URL로 리다이렉트
2. 카카오 동의 완료 → `https://[project].supabase.co/auth/v1/callback` 으로 복귀
3. Supabase가 code 교환, 유저 생성/매핑, 세션 발급 처리
4. `redirectTo` URL(앱)로 복귀
5. `onAuthStateChange('SIGNED_IN')` → `_applySession()` → `socialUser` state 설정

### Kakao Developers 설정
- **앱 ID:** 1495721 (Findish)
- **비즈 앱:** 등록 완료 (개인 개발자 본인인증)
- **Redirect URI:** `https://rqyfuzdwhusrnxrhlpps.supabase.co/auth/v1/callback`, `http://localhost:3000`
- **동의항목:** 닉네임(선택), 프로필 사진(선택), 카카오계정 이메일(필수)
- **Client Secret:** 활성화됨 → Supabase Dashboard에 등록

### Supabase Dashboard 설정
- **Provider:** Kakao 활성화
- **REST API Key:** `109581f0c55d3ed9b7b9854f768ebd9e`
- **Client Secret Code:** Kakao 콘솔에서 발급한 값
- **Allow users without an email:** ON

---

## 크리에이터 로그인

Flask 백엔드(`/auth/creator`)에서 hardcoded credentials 대조 후 Supabase session 반환.  
크리에이터 계정은 `@findish.internal` 이메일로 Supabase에 등록되어 있음.

`_applySession()`에서 이메일 도메인으로 분기:
- `@findish.internal` → `creatorUser` state
- 그 외 → `socialUser` state

---

## 세션 관리

### 초기화 (앱 마운트 시)
`onAuthStateChange`의 `INITIAL_SESSION` 이벤트로 기존 세션 복원.  
`getSession()` 별도 호출 없음 — 이중 호출 방지.

```js
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'INITIAL_SESSION') {
    if (session) _applySession(session); // 자동 로그인
    setSocialLoading(false);
  } else if (event === 'SIGNED_IN') {
    _applySession(session); // 신규 로그인
  } else if (event === 'SIGNED_OUT') {
    _clearSession();
  }
});
```

### 토스트 메시지
- `INITIAL_SESSION` + session → "다시 오셨군요, [닉네임]님!"
- `SIGNED_IN` (소셜 유저) → "로그인됐어요, [닉네임]님!"

### localStorage 캐시
- `findish_social`: `{ uid, name, photoURL, email, provider }` — UI 즉시 복원용
- `findish_creator`: 크리에이터 로그인 정보

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/App.js` | `LoginModal`, `_applySession`, `onAuthStateChange` 핸들러 |
| `src/supabase.js` | Supabase 클라이언트 초기화 |
| `api_server.py` | `/auth/creator` 엔드포인트만 존재 (`/auth/kakao/exchange` 삭제됨) |

---

## 이전 방식 대비 변경점 (2026-08-06)

| 항목 | 이전 | 현재 |
|------|------|------|
| 카카오 OAuth 처리 | 커스텀 Flask 엔드포인트 | Supabase Native |
| 카카오 유저 저장 | 가짜 이메일(`kakao{id}@findish.app`) + SHA256 비밀번호 | Supabase가 정식 OAuth 계정 생성 |
| 백엔드 HTTP 호출 | 신규 유저 시 4번 순차 호출 | 0번 (Supabase 내부 처리) |
| 세션 초기화 | `getSession()` + `onAuthStateChange` 이중 호출 | `onAuthStateChange` 단독 |
| 로그인 모달 | "크리에이터 로그인" 타이틀, ID/PW 폼 + 카카오 버튼 | 카카오 버튼 메인, 크리에이터는 하단 링크로 분리 |
