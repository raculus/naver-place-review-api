const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors());
app.use(express.json());

// 네이버 플레이스 리뷰 날짜 추출 함수
async function extractReviewDates(placeId) {
  let browser = null;
  
  try {
    console.log('브라우저 시작...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-features=VizDisplayCompositor'
      ],
      timeout: 60000
    });

    const page = await browser.newPage();
    
    // User-Agent 설정 (네이버 차단 방지)
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // 뷰포트 설정
    await page.setViewport({ width: 1280, height: 800 });

    // 타임아웃 설정
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);

    const url = `https://m.place.naver.com/restaurant/${placeId}/review/visitor?reviewSort=recent`;
    console.log(`페이지 로딩: ${url}`);
    
    // 페이지 로딩 시도
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 45000 
    });

    // 페이지가 완전히 로드될 때까지 대기
    await page.waitForTimeout(5000);

    // 리뷰 목록이 로드될 때까지 대기
    try {
      await page.waitForSelector('#_review_list', { timeout: 15000 });
      console.log('리뷰 목록 찾음');
    } catch (error) {
      console.log('리뷰 목록을 찾을 수 없습니다. 다른 셀렉터 시도...');
      
      // 대안 셀렉터들 시도
      const alternativeSelectors = [
        '.place_review_list',
        '[data-nclicks="rev.lst"]',
        '.review_list_wrap'
      ];
      
      let found = false;
      for (const selector of alternativeSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          console.log(`대안 셀렉터 찾음: ${selector}`);
          found = true;
          break;
        } catch (e) {
          console.log(`${selector} 찾을 수 없음`);
        }
      }
      
      if (!found) {
        return { success: false, error: 'Review list not found with any selector', dates: [] };
      }
    }

    // 스크롤을 통해 더 많은 리뷰 로드
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(3000);

    // 리뷰 날짜 추출 - 여러 셀렉터 시도
    const reviewDates = await page.evaluate(() => {
      const selectors = [
        '#_review_list > li > div > div > div > span:nth-child(1) > time',
        '#_review_list time',
        '.review_list time',
        '[data-nclicks="rev.lst"] time'
      ];
      
      let dates = [];
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          dates = Array.from(elements).map(el => el.textContent.trim());
          console.log(`셀렉터 ${selector}로 ${dates.length}개 날짜 추출`);
          break;
        }
      }
      
      return dates;
    });

    console.log(`추출된 리뷰 날짜 개수: ${reviewDates.length}`);
    
    return {
      success: true,
      placeId: placeId,
      url: url,
      dates: reviewDates,
      count: reviewDates.length,
      extractedAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('에러 발생:', error);
    return {
      success: false,
      error: error.message,
      dates: []
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        console.error('브라우저 종료 중 에러:', e);
      }
    }
  }
}

// 날짜별 리뷰 개수 카운트 함수
function countReviewsByDate(dates, targetDate) {
  if (!targetDate) {
    // 모든 날짜별 개수 반환
    const dateCounts = {};
    dates.forEach(date => {
      const shortDate = date.split('.').slice(0, 2).join('.'); // "8.8.금" -> "8.8"
      dateCounts[shortDate] = (dateCounts[shortDate] || 0) + 1;
    });
    return dateCounts;
  } else {
    // 특정 날짜의 개수만 반환
    const count = dates.filter(date => {
      const shortDate = date.split('.').slice(0, 2).join('.'); // "8.8.금" -> "8.8"
      return shortDate === targetDate;
    }).length;
    return count;
  }
}

// API 엔드포인트 - 리뷰 날짜 추출
app.get('/api/reviews/:placeId/dates', async (req, res) => {
  const { placeId } = req.params;
  
  if (!placeId) {
    return res.status(400).json({
      success: false,
      error: 'Place ID is required'
    });
  }

  console.log(`리뷰 날짜 추출 요청: ${placeId}`);
  
  try {
    const result = await extractReviewDates(placeId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API 엔드포인트 - 특정 날짜 리뷰 개수 조회
app.get('/api/reviews/:placeId/count/:date?', async (req, res) => {
  const { placeId, date } = req.params;
  
  if (!placeId) {
    return res.status(400).json({
      success: false,
      error: 'Place ID is required'
    });
  }

  console.log(`리뷰 개수 조회 요청: ${placeId}, 날짜: ${date || '전체'}`);
  
  try {
    const result = await extractReviewDates(placeId);
    
    if (!result.success) {
      return res.status(500).json(result);
    }

    if (date) {
      // 특정 날짜의 리뷰 개수
      const count = countReviewsByDate(result.dates, date);
      res.json({
        success: true,
        placeId: placeId,
        targetDate: date,
        count: count,
        url: result.url,
        extractedAt: result.extractedAt
      });
    } else {
      // 모든 날짜별 리뷰 개수
      const dateCounts = countReviewsByDate(result.dates);
      res.json({
        success: true,
        placeId: placeId,
        dateCounts: dateCounts,
        totalReviews: result.count,
        url: result.url,
        extractedAt: result.extractedAt
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 헬스체크 엔드포인트
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'naver-place-review-api'
  });
});

// 기본 라우트
app.get('/', (req, res) => {
  res.json({
    message: 'Naver Place Review API',
    endpoints: {
      'GET /health': 'Health check',
      'GET /api/reviews/:placeId/dates': 'Extract review dates from Naver Place',
      'GET /api/reviews/:placeId/count': 'Get review count by all dates',
      'GET /api/reviews/:placeId/count/:date': 'Get review count for specific date (e.g., 8.8)'
    },
    examples: {
      'All dates': '/api/reviews/1688300738/dates',
      'All date counts': '/api/reviews/1688300738/count',
      'Specific date count': '/api/reviews/1688300738/count/8.8'
    }
  });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`http://localhost:${PORT}`);
  console.log(`예시 URL: http://localhost:${PORT}/api/reviews/1688300738/dates`);
});

module.exports = app;
