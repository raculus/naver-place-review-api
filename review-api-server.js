const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3005;

console.log('🚀 Naver Place Review API Server v2.0.0 시작...');

// 미들웨어 설정
app.use(cors());
app.use(express.json());

// 요청 로깅 미들웨어 (디버깅용)
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log(`[HEADERS] Host: ${req.get('host')}, X-Forwarded-For: ${req.get('x-forwarded-for')}`);
    console.log(`[PATH] Original: ${req.originalUrl}, Path: ${req.path}`);
    next();
});

// 날짜 정규화 함수
function normalizeDate(dateStr) {
    try {
        // "8.8.금" -> "8.8"
        const dayOfWeekMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.[가-힣]$/);
        if (dayOfWeekMatch) {
            return `${dayOfWeekMatch[1]}.${dayOfWeekMatch[2]}`;
        }
        
        // "8월 8일" -> "8.8"
        const monthDayMatch = dateStr.match(/^(\d{1,2})월\s*(\d{1,2})일$/);
        if (monthDayMatch) {
            return `${monthDayMatch[1]}.${monthDayMatch[2]}`;
        }
        
        // "8.8" 형태 검증
        const basicMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})$/);
        if (basicMatch) {
            const month = parseInt(basicMatch[1]);
            const day = parseInt(basicMatch[2]);
            if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                return dateStr;
            }
        }
        
        return null;
    } catch (error) {
        console.error('날짜 정규화 오류:', error);
        return null;
    }
}

// 리뷰 날짜 추출 함수 (node-fetch 사용)
async function getReviewDates(placeId) {
    try {
        const url = `https://m.place.naver.com/restaurant/${placeId}/review/visitor?reviewSort=recent`;
        
        console.log(`[${new Date().toISOString()}] 요청 시작: ${placeId}`);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'ko-KR,ko;q=0.8,en-US;q=0.5,en;q=0.3',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Cache-Control': 'no-cache'
            },
            timeout: 30000
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const html = await response.text();
        console.log(`[${placeId}] HTML 응답 크기: ${html.length.toLocaleString()} bytes`);
        
        // Cheerio로 HTML 파싱
        const $ = cheerio.load(html);
        
        // time 태그에서 날짜 추출
        const timeTags = $('time');
        const dates = [];
        
        timeTags.each((i, element) => {
            const dateText = $(element).text().trim();
            if (dateText) {
                dates.push(dateText);
            }
        });
        
        console.log(`[${placeId}] 추출된 날짜: ${dates.length}개`);
        if (dates.length > 0) {
            console.log(`[${placeId}] 샘플: ${dates.slice(0, 3).join(', ')}...`);
        }
        
        // 날짜별 개수 계산
        const dateCounts = {};
        dates.forEach(date => {
            const normalized = normalizeDate(date);
            if (normalized) {
                dateCounts[normalized] = (dateCounts[normalized] || 0) + 1;
            }
        });
        
        const totalReviews = Object.values(dateCounts).reduce((sum, count) => sum + count, 0);
        console.log(`[${placeId}] 처리 완료: ${totalReviews}개 리뷰`);
        
        return {
            success: true,
            placeId: placeId,
            dateCounts: dateCounts,
            totalReviews: totalReviews,
            method: 'node-fetch + cheerio',
            url: url,
            extractedAt: new Date().toISOString()
        };
        
    } catch (error) {
        console.error(`[${placeId}] 에러:`, error.message);
        return {
            success: false,
            error: error.message,
            placeId: placeId,
            extractedAt: new Date().toISOString()
        };
    }
}

// 라우트 정의
app.get('/', (req, res) => {
    res.json({
        service: 'Naver Place Review Date Counter API',
        version: '2.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
        node_version: process.version,
        environment: process.env.NODE_ENV || 'development',
        endpoints: {
            simple: '/{placeId}/{date} - 숫자만 반환',
            detailed: '/api/reviews/{placeId}/count/{date} - 상세 정보',
            all: '/api/reviews/{placeId}/count - 모든 날짜',
            health: '/health - 헬스체크'
        },
        tech_stack: {
            runtime: 'Node.js',
            http_client: 'node-fetch v2.7.0',
            html_parser: 'cheerio',
            framework: 'express'
        }
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
        },
        version: '2.0.0',
        node_version: process.version
    });
});

// 간단한 숫자 반환: /{placeId}/{date}
app.get('/:placeId/:date', async (req, res) => {
    const { placeId, date } = req.params;
    console.log(`[API] 간단한 요청: ${placeId}/${date}`);
    
    const result = await getReviewDates(placeId);
    
    if (!result.success) {
        return res.status(500).json({
            error: result.error,
            placeId: placeId
        });
    }
    
    const count = result.dateCounts[date] || 0;
    console.log(`[API] 응답: ${count}개`);
    
    res.json(count);
});

// 모든 날짜 카운트: /:placeId/count
app.get('/:placeId/count', async (req, res) => {
    const { placeId } = req.params;
    console.log(`[API] 전체 날짜 요청: ${placeId}`);
    
    const result = await getReviewDates(placeId);
    
    if (!result.success) {
        return res.status(500).json(result);
    }
    
    res.json({
        success: true,
        placeId: placeId,
        dateCounts: result.dateCounts,
        totalReviews: result.totalReviews,
        url: result.url,
        extractedAt: result.extractedAt
    });
});

// 상세 정보: /:placeId/count/:date
app.get('/:placeId/count/:date', async (req, res) => {
    const { placeId, date } = req.params;
    console.log(`[API] 상세 정보 요청: ${placeId}/${date}`);
    
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
        url: result.url,
        extractedAt: result.extractedAt
    });
});

// NPM 경로 문제 대응 - 와일드카드 라우트
app.get('*', (req, res) => {
    console.log(`[WILDCARD] 처리되지 않은 경로: ${req.path}`);
    console.log(`[WILDCARD] 전체 URL: ${req.originalUrl}`);
    console.log(`[WILDCARD] 쿼리: ${JSON.stringify(req.query)}`);
    
    // NPM에서 경로가 잘못 전달된 경우 분석
    const pathSegments = req.path.split('/').filter(Boolean);
    console.log(`[WILDCARD] 경로 세그먼트:`, pathSegments);
    
    res.status(404).json({
        error: 'Not Found',
        path: req.path,
        originalUrl: req.originalUrl,
        pathSegments: pathSegments,
        message: '요청한 경로를 찾을 수 없습니다.',
        debug: {
            method: req.method,
            headers: {
                host: req.get('host'),
                'x-forwarded-for': req.get('x-forwarded-for'),
                'x-forwarded-proto': req.get('x-forwarded-proto'),
                'user-agent': req.get('user-agent')
            }
        },
        availableEndpoints: [
            'GET /{placeId}/{date}',
            'GET /api/reviews/{placeId}/count',
            'GET /api/reviews/{placeId}/count/{date}',
            'GET /health'
        ]
    });
});

// 전역 에러 처리
app.use((err, req, res, next) => {
    console.error('[ERROR]', err.stack);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
        timestamp: new Date().toISOString()
    });
});

// 서버 시작
app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(60));
    console.log('🚀 Naver Place Review API Server v2.0.0');
    console.log('='.repeat(60));
    console.log(`📍 서버 주소: http://0.0.0.0:${PORT}`);
    console.log(`🌐 외부 접근: http://localhost:${PORT}`);
    console.log(`📊 헬스체크: http://localhost:${PORT}/health`);
    console.log(`🔧 HTTP 클라이언트: node-fetch v2.7.0 (undici 대체)`);
    console.log(`📝 HTML 파서: cheerio v1.0.0-rc.12`);
    console.log(`⚡ Node.js 버전: ${process.version}`);
    console.log('='.repeat(60));
    console.log('✅ 서버가 성공적으로 시작되었습니다!');
});

// 종료 시그널 처리
process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM 받음. 서버 종료 중...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n🛑 SIGINT 받음. 서버 종료 중...');
    process.exit(0);
});

// 처리되지 않은 Promise 에러 처리
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});