const aiService = require('../services/ai.service');

const suggestController = {};

// 노트를 생성하지 않고 컨텐츠 분류 및 메타데이터만 리턴
// collections에서 유저가 노트를 수정한 후 ai suggestion preview before save가 필요할지도 몰라서 남겨둠
// param1: req.body.content - 분석할 텍스트 내용
// param2: req.body.images - 이미지 URL 배열 (선택사항)
// 리턴값: AI가 제안한 노트 메타데이터 (DB에 저장되지 않음)
 
suggestController.suggestContent = async (req, res) => {
  const { content, images = [] } = req.body;

  try {
    // AI 제안 생성
    const suggestions = await aiService.generateSuggestions(content, images);
    
    // suggestions을 노트 데이터 형식으로 변환
    const formattedNote = aiService.formatNoteFromSuggestions(suggestions);
    
    // AI suggestions과 함께 노트 생성
    const response = {
      _id: null,
      userId: null,
      ...formattedNote,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error suggesting content:', {
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
      timestamp: new Date().toISOString(),
    });

    if (error.message === '내용 또는 이미지가 필요합니다') {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: error.message,
      });
    }

    if (error.message.includes('이미지')) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: error.message,
      });
    }

    if (error.message === 'API 키가 설정되지 않았습니다') {
      return res.status(500).json({
        error: 'SERVER_ERROR',
        message: error.message,
      });
    }

    // AI API 관련 에러
    if (error.statusCode === 429) {
      return res.status(429).json({
        error: 'RATE_LIMIT_ERROR',
        message: 'AI 서비스 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
      });
    }

    if (error.statusCode === 408 || error.message === 'AI_TIMEOUT') {
      return res.status(408).json({
        error: 'TIMEOUT_ERROR',
        message: 'AI 처리 시간이 초과되었습니다. 내용을 줄이거나 이미지 개수를 줄여주세요.',
      });
    }

    if (error.statusCode >= 400 && error.statusCode < 500) {
      return res.status(400).json({
        error: 'AI_API_ERROR',
        message: 'AI 분석 중 오류가 발생했습니다. 입력 내용을 확인해주세요.',
      });
    }

    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: process.env.NODE_ENV === 'development' 
        ? `서버 오류: ${error.message}` 
        : '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    });
  }
};

module.exports = suggestController;