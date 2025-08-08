# Naver Place Review API

네이버 플레이스에서 리뷰 날짜를 추출하는 API 서버입니다.

## 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 서버 실행
```bash
# 프로덕션 모드
npm start

# 개발 모드 (nodemon 사용)
npm run dev
```

서버는 기본적으로 `http://localhost:3000`에서 실행됩니다.

## API 사용법

### 1. 리뷰 날짜 추출
```
GET /api/reviews/{placeId}/dates
```

**예시 요청:**
```bash
curl "http://localhost:3000/api/reviews/1688300738/dates"
```

**응답 예시:**
```json
{
  "success": true,
  "placeId": "1688300738",
  "url": "https://m.place.naver.com/restaurant/1688300738/review/visitor?reviewSort=recent",
  "dates": [
    "8.8.금",
    "8.8.금",
    "8.7.목",
    "8.6.수"
  ],
  "count": 4,
  "extractedAt": "2025-08-09T10:30:00.000Z"
}
```

### 2. 모든 날짜별 리뷰 개수 조회
```
GET /api/reviews/{placeId}/count
```

**예시 요청:**
```bash
curl "http://localhost:3000/api/reviews/1688300738/count"
```

**응답 예시:**
```json
{
  "success": true,
  "placeId": "1688300738",
  "dateCounts": {
    "8.8": 7,
    "8.7": 1,
    "8.6": 1,
    "8.5": 1
  },
  "totalReviews": 10,
  "url": "https://m.place.naver.com/restaurant/1688300738/review/visitor?reviewSort=recent",
  "extractedAt": "2025-08-09T10:30:00.000Z"
}
```

### 3. 특정 날짜의 리뷰 개수 조회
```
GET /api/reviews/{placeId}/count/{date}
```

**예시 요청:**
```bash
curl "http://localhost:3000/api/reviews/1688300738/count/8.8"
```

**응답 예시:**
```json
{
  "success": true,
  "placeId": "1688300738",
  "targetDate": "8.8",
  "count": 7,
  "url": "https://m.place.naver.com/restaurant/1688300738/review/visitor?reviewSort=recent",
  "extractedAt": "2025-08-09T10:30:00.000Z"
}
```

### 헬스체크
```
GET /health
```

### 기본 정보
```
GET /
```

## 기술 스택

- **Node.js**: 런타임 환경
- **Express**: 웹 프레임워크
- **Puppeteer**: 웹 스크래핑 (Headless Chrome)
- **CORS**: Cross-Origin Resource Sharing 지원

## 주의사항

1. 이 API는 교육/개발 목적으로만 사용해주세요.
2. 네이버 서비스 이용약관을 준수해주세요.
3. 과도한 요청은 피해주세요 (Rate Limiting 고려).
4. robots.txt 및 사이트 정책을 확인해주세요.

## 환경변수

- `PORT`: 서버 포트 (기본값: 3000)

## 에러 처리

API는 다음과 같은 에러 상황을 처리합니다:

- 잘못된 placeId
- 네트워크 연결 문제
- 페이지 로딩 실패
- 리뷰 목록을 찾을 수 없는 경우

에러 발생 시 `success: false`와 에러 메시지를 반환합니다.

## 사용된 CSS 셀렉터

```javascript
document.querySelectorAll('#_review_list > li > div > div > div > span:nth-child(1) > time')
```

이 셀렉터를 사용하여 네이버 플레이스 리뷰 목록에서 각 리뷰의 작성 날짜를 추출합니다.
