# 🔌 API 명세서

---

## 0. 공통 규칙

| 항목 | 값 |
|---|---|
| **Base URL (로컬)** | `http://localhost:8000` |
| **Base URL (배포)** | 미정 |
| **Content-Type** | `application/json` |
| **인증 방식** | JWT Bearer Token |

### 인증 헤더
로그인 후 발급된 access token을 아래 형식으로 요청 헤더에 포함합니다.
```
Authorization: Bearer <access_token>
```
> `/api/spaces/` 조회 계열은 인증 없이도 사용 가능 (AllowAny)

### HTTP 상태 코드

| Code | 의미 | 사용 시점 |
|---|---|---|
| 200 | OK | 조회·로그아웃 성공 |
| 201 | Created | 회원가입·리뷰 등록 성공 |
| 400 | Bad Request | 필수 필드 누락, 유효성 오류 |
| 401 | Unauthorized | 인증 실패, 토큰 만료·블랙리스트 |
| 404 | Not Found | 해당 리소스 없음 |
| 500 | Server Error | 백엔드 내부 오류 |

---

## 1. 엔드포인트 요약

| # | Method | URL | 설명 | 인증 필요 | 상태 |
|---|---|---|---|---|---|
| 1 | `POST` | `/api/auth/register/` | 회원가입 | ❌ | ✅ |
| 2 | `POST` | `/api/auth/login/` | 로그인 (토큰 발급) | ❌ | ✅ |
| 3 | `POST` | `/api/auth/logout/` | 로그아웃 (토큰 블랙리스트) | ❌ | ✅ |
| 4 | `POST` | `/api/auth/token/refresh/` | access token 재발급 | ❌ | ✅ |
| 5 | `GET` | `/api/spaces/` | 카페 목록 조회 (필터·정렬) | ❌ | ✅ |
| 6 | `GET` | `/api/spaces/<id>/` | 카페 단일 상세 조회 | ❌ | ✅ |
| 7 | `GET` | `/api/spaces/<id>/reviews/` | 카페 리뷰 목록 조회 | ❌ | ✅ |
| 8 | `POST` | `/api/spaces/<id>/reviews/` | 카페 리뷰 등록 | ❌ | ✅ |

> 상태: ⬜ 미구현 / 🟡 개발중 / ✅ 완료

---

## 2. 인증 API

### 1️⃣ `POST /api/auth/register/` — 회원가입

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `username` | string | ✅ | 사용자명 (중복 불가) |
| `email` | string | ✅ | 이메일 |
| `password` | string | ✅ | 비밀번호 (Django 유효성 검사 적용) |

```json
{
  "username": "myuser",
  "email": "my@test.com",
  "password": "Test1234!"
}
```

**Response — 201 Created**
```json
{ "message": "회원가입이 완료됐습니다." }
```

**Response — 400 Bad Request**
```json
{ "username": ["해당 사용자 이름은 이미 존재합니다."] }
```

---

### 2️⃣ `POST /api/auth/login/` — 로그인

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `username` | string | ✅ | 사용자명 |
| `password` | string | ✅ | 비밀번호 |

```json
{
  "username": "myuser",
  "password": "Test1234!"
}
```

**Response — 200 OK**
```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

> - `access` token 유효기간: **30분**
> - `refresh` token 유효기간: **7일**

**Response — 401 Unauthorized**
```json
{ "detail": "지정된 자격 증명에 해당하는 활성화된 사용자를 찾을 수 없습니다" }
```

---

### 3️⃣ `POST /api/auth/logout/` — 로그아웃

refresh token을 블랙리스트에 등록합니다.

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `refresh` | string | ✅ | 로그인 시 발급받은 refresh token |

```json
{ "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

**Response — 200 OK**
```json
{ "message": "로그아웃됐습니다." }
```

**Response — 400 Bad Request**
```json
{ "error": "유효하지 않은 토큰입니다." }
```

---

### 4️⃣ `POST /api/auth/token/refresh/` — access token 재발급

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `refresh` | string | ✅ | 유효한 refresh token |

```json
{ "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

**Response — 200 OK**
```json
{
  "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

> `ROTATE_REFRESH_TOKENS = True` 설정으로 재발급 시 refresh token도 함께 교체됩니다.

**Response — 401 Unauthorized**
```json
{ "detail": "블랙리스트에 추가된 토큰입니다", "code": "token_not_valid" }
```

---

## 3. 카페 공간 API

### 5️⃣ `GET /api/spaces/` — 카페 목록 조회

**Query Parameters**

| 파라미터 | 타입 | 필수 | 설명 | 예시 |
|---|---|---|---|---|
| `ordering` | string | ❌ | 정렬 기준 (`-`는 내림차순) | `-score_comfort` |
| `min_score_plug` | float | ❌ | 콘센트 최소 점수 | `4` |
| `min_score_wifi` | float | ❌ | 와이파이 최소 점수 | `4` |
| `min_score_noise` | float | ❌ | 소음 최소 점수 | `4` |
| `min_score_comfort` | float | ❌ | 눈치 최소 점수 | `4` |
| `min_score_table` | float | ❌ | 테이블 최소 점수 (0 또는 5) | `5` |

**ordering 허용값**
```
score_plug, -score_plug
score_wifi, -score_wifi
score_noise, -score_noise
score_comfort, -score_comfort
score_table, -score_table
name, -name
```

**Response — 200 OK**
```json
[
  {
    "id": 1,
    "name": "아우프글렛 금호점",
    "address": "서울 성동구 독서당로51길 7",
    "latitude": "37.5488664",
    "longitude": "127.0262200",
    "score_plug": 3.0,
    "score_wifi": 3.0,
    "score_noise": 3.0,
    "score_comfort": 5.0,
    "score_table": 5.0,
    "total_review_count": 10,
    "last_scored_at": "2026-05-28T12:27:49Z",
    "kakao_place_id": "12345678",
    "phone": "02-1234-5678",
    "kakao_url": "http://place.map.kakao.com/12345678"
  }
]
```

**호출 예시**
```bash
# 눈치 점수 높은 순
curl "http://localhost:8000/api/spaces/?ordering=-score_comfort"

# 콘센트 + 와이파이 모두 4점 이상
curl "http://localhost:8000/api/spaces/?min_score_plug=4&min_score_wifi=4"

# 조용하고 테이블 좋은 카페
curl "http://localhost:8000/api/spaces/?min_score_noise=4&min_score_table=5"
```

---

### 6️⃣ `GET /api/spaces/<id>/` — 카페 단일 상세 조회

**Path Parameter**

| 파라미터 | 타입 | 설명 |
|---|---|---|
| `id` | integer | 카페 고유 ID |

**Response — 200 OK** : 5️⃣ 목록 응답의 단일 객체와 동일

**Response — 404 Not Found**
```json
{ "detail": "찾을 수 없습니다." }
```

---

### 7️⃣ `GET /api/spaces/<id>/reviews/` — 리뷰 목록 조회

**Response — 200 OK**
```json
[
  {
    "id": 1,
    "workspace": 1,
    "score_plug": 4.0,
    "score_wifi": 3.5,
    "score_noise": 5.0,
    "score_comfort": 4.5,
    "comment": "조용하고 콘센트 많아요!",
    "created_at": "2026-06-01T10:00:00Z"
  }
]
```

---

### 8️⃣ `POST /api/spaces/<id>/reviews/` — 리뷰 등록

**Request Body**

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `score_plug` | float | ✅ | 콘센트 점수 (1~5, 0.5 단위) |
| `score_wifi` | float | ✅ | 와이파이 점수 (1~5, 0.5 단위) |
| `score_noise` | float | ✅ | 소음 점수 (1~5, 0.5 단위) |
| `score_comfort` | float | ✅ | 눈치 점수 (1~5, 0.5 단위) |
| `comment` | string | ❌ | 한 줄 후기 |

```json
{
  "score_plug": 4.0,
  "score_wifi": 3.5,
  "score_noise": 5.0,
  "score_comfort": 4.5,
  "comment": "조용하고 콘센트 많아요!"
}
```

**Response — 201 Created** : 7️⃣ 목록 응답의 단일 객체와 동일

**Response — 400 Bad Request**
```json
{ "score_plug": ["이 필드는 필수 항목입니다."] }
```

---

## 4. 5대 지표 설명

| 필드 | 범위 | 의미 |
|---|---|---|
| `score_plug` | 1.0 ~ 5.0 | 콘센트 개수·접근성 (5=자리마다 / 3=벽면만 / 1=없음) |
| `score_wifi` | 1.0 ~ 5.0 | 와이파이 속도·안정성 (5=기가급 / 3=무난 / 1=먹통) |
| `score_noise` | 1.0 ~ 5.0 | 소음 수준 (5=독서실 / 3=백색소음 / 1=클럽) |
| `score_comfort` | 1.0 ~ 5.0 | 눈치·체류 편의 (5=눈치제로 / 3=적당 / 1=가시방석) |
| `score_table` | 0.0 또는 5.0 | 테이블 크기·높이 (5=작업하기 좋음 / 0=좁거나 언급없음) |

> 채점 기준 상세: `backend/prompt_rule.md` 참고

---

## 5. 외부 API

| API | 용도 | 인증 | 호출 주체 |
|---|---|---|---|
| 카카오 로컬 API | 성동구 카페 목록 수집 | REST API Key | 백엔드 (관리 커맨드) |
| 카카오맵 JavaScript SDK | 프론트 지도 렌더링 | JavaScript Key | 프론트엔드 |
| 네이버 블로그 검색 API | 카페별 리뷰 크롤링 | Client ID/Secret | 백엔드 (관리 커맨드) |

> **주의:** JavaScript Key는 브라우저에 노출되므로 카카오 콘솔에서 **허용 도메인 등록** 필수
> - 개발: `http://localhost:3000`
> - 배포: 실제 도메인 추가

---

## 6. CORS 설정

```python
# backend/config/settings.py
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
]
# 배포 시 VERCEL_URL 환경변수로 추가 도메인 등록 가능
```
