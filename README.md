# TrackLook 🗺️

성동구 카공족(노트북 작업자/학생)을 위한 카페 추천 서비스.
네이버 리뷰를 AI로 분석해 콘센트·와이파이·소음·눈치·테이블 5대 지표를 점수화합니다.

---

## 셋업 방법

### 1. 클론 및 환경 설정
```bash
git clone https://github.com/sznii161/LikeLIon_
cd LikeLIon_/backend

# 가상환경 생성 및 패키지 설치
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# 환경변수 설정
cp .env.example .env
# .env 파일 열어서 SECRET_KEY 입력 (나머지는 데이터 업데이트 시에만 필요)
```

### 2. DB 초기화 및 데이터 로드
```bash
python manage.py migrate
python manage.py loaddata seongdong_cafes   # 성동구 카페 258개 점수 데이터 즉시 로드
```

### 3. 서버 실행
```bash
python manage.py runserver
# → http://localhost:8000
```

---

## API 사용법

### 기본 엔드포인트
```
GET /api/spaces/
```

### 필터 파라미터

| 파라미터 | 설명 | 예시 |
|---|---|---|
| `ordering` | 정렬 기준 (앞에 `-` 붙이면 내림차순) | `?ordering=-score_comfort` |
| `min_score_plug` | 콘센트 최소 점수 | `?min_score_plug=4` |
| `min_score_wifi` | 와이파이 최소 점수 | `?min_score_wifi=4` |
| `min_score_noise` | 소음 최소 점수 (높을수록 조용함) | `?min_score_noise=4` |
| `min_score_comfort` | 눈치 최소 점수 (높을수록 편함) | `?min_score_comfort=4` |
| `min_score_table` | 테이블 최소 점수 (0 또는 5) | `?min_score_table=5` |

### 사용 예시

```bash
# 눈치 안 보이는 카페 순
GET /api/spaces/?ordering=-score_comfort

# 콘센트 + 와이파이 모두 4점 이상
GET /api/spaces/?min_score_plug=4&min_score_wifi=4

# 조용하고 테이블 좋은 카페
GET /api/spaces/?min_score_noise=4&min_score_table=5

# 카공 최적 종합 (콘센트·와이파이 4점↑, 눈치 점수 높은 순)
GET /api/spaces/?min_score_plug=4&min_score_wifi=4&ordering=-score_comfort
```

### 응답 예시

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
    "last_scored_at": "2026-05-28T12:27:49Z"
  }
]
```

---

## 5대 지표 설명

| 지표 | 의미 | 점수 기준 |
|---|---|---|
| `score_plug` | 콘센트 개수·접근성 | 5=자리마다 / 3=벽면만 / 1=없음 |
| `score_wifi` | 와이파이 속도·안정성 | 5=기가급 빠름 / 3=무난 / 1=먹통 |
| `score_noise` | 소음 수준 | 5=독서실 수준 / 3=백색소음 / 1=클럽 수준 |
| `score_comfort` | 눈치·체류 편의 | 5=눈치 제로 / 3=적당 / 1=가시방석 |
| `score_table` | 테이블 크기·높이 | 5=작업하기 좋음 / 0=좁거나 언급 없음 |

> 채점 기준 상세: `backend/prompt_rule.md` 참고

---

## 데이터 업데이트 (선택사항)

새로 크롤링·점수화가 필요할 때는 `.env`에 API 키를 모두 입력 후 아래 순서로 실행:

```bash
python manage.py fetch_cafes        # 카카오맵 API로 카페 목록 수집
python manage.py crawl_reviews      # 네이버 블로그 리뷰 크롤링
python manage.py score_workspaces   # L40 GPU 서버(Qwen3.5:122b)로 점수화
```

주간 자동 업데이트는 crontab에 등록되어 있습니다 (매주 월요일 03:00).

---

## 기술 스택

- **Backend**: Django 6.0 / Django REST Framework / SQLite
- **크롤링**: 카카오 로컬 API, 네이버 블로그 검색 API
- **AI 분석**: Qwen3.5:122b-1m (Ollama, NVIDIA L40 GPU)
- **데이터**: 성동구 카페 258개 / 리뷰 3,693건
