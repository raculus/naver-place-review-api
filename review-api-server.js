const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어 설정
app.use(cors());
app.use(express.json());

// 날짜 정규화 함수
function normalizeDate(dateStr) {
    // 8.8.금 -> 8.8
    const dayOfWeekMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.[가-힣]$/);
    if (dayOfWeekMatch) {
        return `${dayOfWeekMatch[1]}.${dayOfWeekMatch[2]}`;
    }
    
    // 8월 8일 -> 8.8
    const monthDayMatch = dateStr.match(/^(\d{1,2})월\s*(\d{1,2})일$/);
    if (monthDayMatch) {
        return `${monthDayMatch[1]}.${monthDayMatch[2]}`;
    }
    
    // M.D 형태 검증
    const basicMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})$/);
    if (basicMatch) {
        const month = parseInt(basicMatch[1]);
        const day = parseInt(basicMatch[2]);
        if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
            return dateStr;
        }
    }
    
    return null;
}

// 리뷰 날짜 추출 함수
async function getReviewDates(placeId, targetDate = null) {
    try {
        const url = `https://m.place.naver.com/restaurant/${placeId}/review/visitor?reviewSort=recent`;
        
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.8,en-US;q=0.5,en;q=0.3',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        };
        
        console.log(`요청 URL: ${url}`);
        const response = await axios.get(url, { headers });
        
        if (response.status !== 200) {
            throw new Error(`HTTP Error: ${response.status}`);
        }
        
        const html = response.data;
        
        // time 태그에서 날짜 추출
        const timeMatches = html.match(/<time[^>]*>([^<]+)<\/time>/g);
        
        if (!timeMatches) {
            console.log('time 태그를 찾을 수 없습니다. CSS 셀렉터로 시도...');
            return extractDatesWithCheerio(html, targetDate, placeId);
        }
        
        const dates = timeMatches.map(match => {
            const content = match.match(/<time[^>]*>([^<]+)<\/time>/)[1];
            return content.trim();
        });
        
        console.log(`time 태그에서 ${dates.length}개 날짜 발견: ${dates.slice(0, 10).join(', ')}...`);
        
        // 날짜별 개수 계산
        const dateCounts = {};
        dates.forEach(date => {
            const normalized = normalizeDate(date);
            if (normalized) {
                dateCounts[normalized] = (dateCounts[normalized] || 0) + 1;
            }
        });
        
        console.log('발견된 날짜별 개수:', dateCounts);
        
        return {
            success: true,
            placeId: placeId,
            dateCounts: dateCounts,
            totalReviews: Object.values(dateCounts).reduce((sum, count) => sum + count, 0),
            method: 'time_tag_extraction',
            url: url,
            extractedAt: new Date().toISOString()
        };
        
    } catch (error) {
        console.error('에러 발생:', error.message);
        return {
            success: false,
            error: error.message,
            placeId: placeId
        };
    }
}

// Cheerio를 사용한 백업 방법
async function extractDatesWithCheerio(html, targetDate, placeId) {
    try {
        const $ = cheerio.load(html);
        
        // CSS 셀렉터로 time 태그 찾기
        const selector = '#_review_list > li > div > div > div > span:nth-child(1) > time';
        const timeTags = $(selector);
        
        const dates = [];
        
        console.log(`CSS 셀렉터로 ${timeTags.length}개 time 태그 발견`);
        
        timeTags.each((i, element) => {
            const dateText = $(element).attr('datetime') || $(element).text().trim();
            if (dateText) {
                dates.push(dateText);
            }
        });
        
        // 대안: 모든 time 태그 검색
        if (dates.length === 0) {
            console.log('정확한 셀렉터로 찾지 못함. 모든 time 태그 검색...');
            $('time').each((i, element) => {
                const dateText = $(element).attr('datetime') || $(element).text().trim();
                if (dateText) {
                    dates.push(dateText);
                }
            });
        }
        
        console.log(`추출된 날짜들: ${dates.slice(0, 10).join(', ')}...`);
        
        // 날짜별 개수 계산
        const dateCounts = {};
        dates.forEach(date => {
            const normalized = normalizeDate(date);
            if (normalized) {
                dateCounts[normalized] = (dateCounts[normalized] || 0) + 1;
            }
        });
        
        return {
            success: true,
            placeId: placeId,
            dateCounts: dateCounts,
            totalReviews: Object.values(dateCounts).reduce((sum, count) => sum + count, 0),
            method: 'cheerio_css_selector',
            extractedAt: new Date().toISOString()
        };
        
    } catch (error) {
        console.error('Cheerio 에러:', error.message);
        return {
            success: false,
            error: error.message,
            placeId: placeId
        };
    }
}

// API 라우트들

// 특정 날짜의 리뷰 개수 조회
app.get('/:placeId/:date', async (req, res) => {
    try {
        const { placeId, date } = req.params;
        
        console.log(`특정 날짜 요청: ${placeId} / ${date}`);
        
        const result = await getReviewDates(placeId);
        
        if (!result.success) {
            return res.status(500).json(result);
        }
        
        const count = result.dateCounts[date] || 0;
        
        // 단순히 숫자만 반환
        res.json(count);
        
    } catch (error) {
        console.error('API 에러:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 상세 정보와 함께 특정 날짜 조회
app.get('/api/reviews/:placeId/count/:date', async (req, res) => {
    try {
        const { placeId, date } = req.params;
        
        console.log(`상세 정보 요청: ${placeId} / ${date}`);
        
        const result = await getReviewDates(placeId);
        
        if (!result.success) {
            return res.status(500).json(result);
        }
        
        const count = result.dateCounts[date] || 0;
        
        res.json({
            success: true,
            placeId: placeId,
            targetDate: date,
            count: count,
            url: `https://m.place.naver.com/restaurant/${placeId}/review/visitor?reviewSort=recent`,
            extractedAt: result.extractedAt
        });
        
    } catch (error) {
        console.error('API 에러:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 모든 날짜별 리뷰 개수 조회
app.get('/api/reviews/:placeId/count', async (req, res) => {
    try {
        const { placeId } = req.params;
        
        console.log(`전체 날짜 요청: ${placeId}`);
        
        const result = await getReviewDates(placeId);
        
        if (!result.success) {
            return res.status(500).json(result);
        }
        
        res.json({
            success: true,
            placeId: placeId,
            dateCounts: result.dateCounts,
            totalReviews: result.totalReviews,
            url: `https://m.place.naver.com/restaurant/${placeId}/review/visitor?reviewSort=recent`,
            extractedAt: result.extractedAt
        });
        
    } catch (error) {
        console.error('API 에러:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 헬스체크
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// 기본 정보
app.get('/', (req, res) => {
    res.json({
        service: 'Naver Place Review Date Counter API',
        version: '1.0.0',
        endpoints: {
            simple: '/:placeId/:date',
            detailed: '/api/reviews/:placeId/count/:date',
            all: '/api/reviews/:placeId/count',
            health: '/health'
        },
        example: 'http://localhost:3000/1688300738/8.8'
    });
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`🚀 Naver Place Review API 서버가 포트 ${PORT}에서 실행 중입니다.`);
    console.log(`📡 예시 요청: http://localhost:${PORT}/1688300738/8.8`);
    console.log(`📊 상세 정보: http://localhost:${PORT}/api/reviews/1688300738/count/8.8`);
    console.log(`📋 전체 데이터: http://localhost:${PORT}/api/reviews/1688300738/count`);
});
