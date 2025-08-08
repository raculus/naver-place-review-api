const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

// 테스트 함수
async function testAPI() {
  console.log('🧪 API 테스트 시작...\n');

  try {
    // 1. 헬스체크 테스트
    console.log('1. 헬스체크 테스트');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health Check:', healthResponse.data);
    console.log('');

    // 2. 기본 정보 테스트
    console.log('2. 기본 정보 테스트');
    const infoResponse = await axios.get(`${BASE_URL}/`);
    console.log('✅ API Info:', infoResponse.data);
    console.log('');

    // 3. 리뷰 날짜 추출 테스트
    console.log('3. 리뷰 날짜 추출 테스트');
    console.log('⏳ 네이버 플레이스에서 리뷰 날짜를 추출하는 중...');
    
    const reviewResponse = await axios.get(`${BASE_URL}/api/reviews/1688300738/dates`);
    console.log('✅ Review Dates:', reviewResponse.data);
    
    if (reviewResponse.data.success) {
      console.log(`📅 추출된 날짜 개수: ${reviewResponse.data.count}개`);
      reviewResponse.data.dates.forEach((date, index) => {
        console.log(`   ${index + 1}. ${date}`);
      });
    }
    console.log('');

    // 4. 모든 날짜별 리뷰 개수 테스트
    console.log('4. 모든 날짜별 리뷰 개수 테스트');
    const countAllResponse = await axios.get(`${BASE_URL}/api/reviews/1688300738/count`);
    console.log('✅ All Date Counts:', countAllResponse.data);
    console.log('');

    // 5. 특정 날짜 리뷰 개수 테스트
    console.log('5. 특정 날짜 리뷰 개수 테스트 (8.8)');
    const countSpecificResponse = await axios.get(`${BASE_URL}/api/reviews/1688300738/count/8.8`);
    console.log('✅ Specific Date Count (8.8):', countSpecificResponse.data);
    console.log('');

  } catch (error) {
    console.error('❌ 테스트 실패:', error.response?.data || error.message);
  }
}

// 테스트 실행
if (require.main === module) {
  testAPI();
}

module.exports = { testAPI };
