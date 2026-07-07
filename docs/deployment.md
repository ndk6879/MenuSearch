# 배포 환경 및 환경변수

> **2026-07 기준 — Firebase 제거, Supabase 전환 완료**

## 배포 구조

| 서비스 | 플랫폼 | URL |
|--------|--------|-----|
| 프론트엔드 (React) | Vercel | https://menu-search.vercel.app |
| 백엔드 (Flask) | Railway | https://cooperative-success-production.up.railway.app |
| DB / Auth | Supabase | 대시보드에서 확인 |

---

## Vercel 환경변수 (REACT_APP_*)

> `REACT_APP_*` 변수는 빌드 시 번들에 포함됨. 변경 후 반드시 재배포 필요.  
> **Production + Preview 양쪽 모두 설정해야 함** — 한쪽만 설정하면 Preview 빌드에서 초기화 실패.

| 변수명 | 용도 |
|--------|------|
| `REACT_APP_SUPABASE_URL` | Supabase 프로젝트 URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Supabase 공개 anon 키 |
| `REACT_APP_KAKAO_REST_KEY` | 카카오 REST API 키 |
| `REACT_APP_API_BASE` | Railway 백엔드 URL (trailing newline 없어야 함) |
| `REACT_APP_CREATOR_CREDS` | 크리에이터 로그인 정보 (`alias:pass:name\|alias2:pass2:name2`) |

> **주의:** Vercel CLI로 env var 추가 시 값에 `\n`이 붙는 버그 있었음.  
> 안전한 방법: Vercel 대시보드 웹에서 직접 입력.

---

## Railway 환경변수

| 변수명 | 용도 |
|--------|------|
| `KAKAO_REST_API_KEY` | 카카오 REST API 키 (서버에서 토큰 교환 시 사용) |
| `KAKAO_CLIENT_SECRET` | 카카오 Client Secret |
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_KEY` | Supabase Service Role 키 (Admin 권한 — 절대 프론트에 노출 금지) |
| `YOUTUBE_API_KEY` | YouTube Data API 키 |

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

### 테이블 구조 (recipes)
```
recipes
  id             uuid (PK)
  name           text
  url            text (unique)
  uploader       text
  upload_date    text
  ingredients    text[]
  steps          text[]
  source         text
  status         text  ('active' | 'hidden')
  thumbnail_url  text
  language       text  ('kr' | 'en')
```

### RLS (Row Level Security)
- 레시피 읽기: 전체 공개
- 레시피 쓰기: Service Role만 가능 (프론트엔드 직접 쓰기 불가)

---

## 브랜치 전략

| 브랜치 | 용도 | Vercel 환경 |
|--------|------|------------|
| `main` | Production 배포 | Production |
| `dev` | 개발/테스트 | Preview |

작업 흐름: `dev`에서 작업 → 빌드 확인 → `main`에 merge → prod 자동 배포
