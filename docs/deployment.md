# 배포 환경 및 환경변수

> **2026-08-06 기준 — Supabase Native Kakao OAuth 전환 완료**

## 배포 구조

| 서비스 | 플랫폼 | URL |
|--------|--------|-----|
| 프론트엔드 (React) | Vercel | https://menu-search.vercel.app |
| 백엔드 (Flask) | Railway | https://cooperative-success-production.up.railway.app |
| DB / Auth | Supabase | 대시보드에서 확인 |

---

## Vercel 환경변수 (REACT_APP_*)

> `REACT_APP_*` 변수는 빌드 시 번들에 포함됨. 변경 후 반드시 재배포 필요.
> **Production + Preview 양쪽 모두 설정해야 함**

| 변수명 | 용도 |
|--------|------|
| `REACT_APP_SUPABASE_URL` | Supabase 프로젝트 URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Supabase 공개 anon 키 |
| `REACT_APP_API_BASE` | Railway 백엔드 URL |

> **주의:** Vercel CLI로 env var 추가 시 값에 `\n`이 붙는 버그 있음.
> 안전한 방법: Vercel 대시보드 웹에서 직접 입력.

> **삭제된 변수:** `REACT_APP_KAKAO_REST_KEY`, `REACT_APP_CREATOR_CREDS`
> - 카카오 인증이 Supabase로 이전되어 프론트에서 REST Key 불필요
> - 크리에이터 인증이 백엔드로 이전되어 프론트에 credentials 불필요

---

## Railway 환경변수 (백엔드 Flask)

| 변수명 | 용도 |
|--------|------|
| `CREATOR_CREDS` | ~~크리에이터 로그인~~ 더 이상 사용 안 함 (08-07에 Supabase 계정으로 전환) |
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role 키 (Admin 권한 — 절대 프론트 노출 금지) |
| `SUPABASE_ANON_KEY` | Supabase anon 키 |
| `YOUTUBE_API_KEY` | YouTube Data API 키 |
| `GEMINI_API_KEY` | Gemini 영상 분석 키 |
| `GROQ_API_KEY` | Groq 용량 추정 키 |

> **삭제된 변수:** `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`
> - `/auth/kakao/exchange` 엔드포인트 삭제로 불필요

---

## 배포 명령어

```bash
# 프론트엔드 — git push만 하면 Vercel 자동 배포
git push origin main   # prod 배포
git push origin dev    # preview 배포

# 백엔드 — Railway는 자동 배포 비활성화 상태, 수동 배포 필요
railway up --service cooperative-success --detach
```

> **Railway 주의:** GitHub push 시 자동 배포가 안 됨.
> 백엔드 코드 변경 후 반드시 `railway up` 수동 실행.

---

## Supabase 설정

### Auth Providers
| Provider | 상태 | 비고 |
|----------|------|------|
| Kakao | 활성화 | REST API Key + Client Secret 등록, Allow without email ON |
| Google | 활성화 | Supabase 기본 설정 |

### Kakao 관련 외부 설정
- **카카오 개발자 콘솔 앱 ID:** 1495721 (Findish)
- **비즈 앱:** 등록 완료
- **Redirect URI:** `https://rqyfuzdwhusrnxrhlpps.supabase.co/auth/v1/callback`, `http://localhost:3000`
- **동의항목:** 닉네임(선택), 프로필 사진(선택), 이메일(필수)

### RLS (Row Level Security)
- 레시피 읽기: 전체 공개
- 레시피 쓰기: Service Role만 가능

---

## 브랜치 전략

| 브랜치 | 용도 | Vercel 환경 |
|--------|------|------------|
| `main` | Production 배포 | Production |
| `dev` | 개발/테스트 | Preview |

작업 흐름: `dev`에서 작업 → 빌드 확인 → `main`에 merge → prod 자동 배포
