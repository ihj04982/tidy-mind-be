require('dotenv').config();
const { getSystemPrompt } = require('../utils/aiPrompts');

// 우선순위별 기본 마감일 설정 
const PRIORITY_DAYS = {
  High: 1,
  Medium: 3,
  Low: 7,
  Default: 3,
};

const IMAGE_CONFIG = {
  maxCount: 5,
  cloudinaryPattern: /^https:\/\/res\.cloudinary\.com\//,
};

// AI가 suggest한 날짜 ("dueDate": "YYYY-MM-DD" - 스트링)를 UTC 정오로 설정 (타임존 문제 방지) (Date object 리턴)
const createDueDateAtNoonUTC = (dateInput) => {
  let date;
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    date = new Date(dateInput + 'T12:00:00.000Z');
  } else if (dateInput instanceof Date) {
    date = new Date(dateInput);
    date.setUTCHours(12, 0, 0, 0);
  } else {
    return null;
  }
  return date;
};

// 우선순위 기반 기본 마감일 생성 (Date object 리턴)
const generateDefaultDueDate = (priority = 'Medium') => {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  const daysToAdd = PRIORITY_DAYS[priority] || PRIORITY_DAYS.Default;
  date.setDate(date.getDate() + daysToAdd);
  return date;
};

// ESM 모듈 캐싱 변수
let __aiModule = null;
let __openaiModule = null;

// AI SDK 지연 로딩 (ESM 호환성)
const getAi = async () => {
  if (!__aiModule) {
    __aiModule = await import('ai');
  }
  return __aiModule;
};

// OpenAI SDK 지연 로딩 (ESM 호환성)
const getOpenAI = async () => {
  if (!__openaiModule) {
    __openaiModule = await import('@ai-sdk/openai');
  }
  return __openaiModule;
};

const aiService = {};

// 1. 이미지 validation
// param: 이미지 URL array
// 리턴값: { isValid: boolean, validatedImages: Array, error: string|null }

aiService.validateImages = (images) => {
  if (!Array.isArray(images)) {
    return { isValid: false, validatedImages: [], error: '올바르지 않은 이미지 배열 형식입니다' };
  }

  // 이미지 개수 제한 체크
  if (images.length > IMAGE_CONFIG.maxCount) {
    return {
      isValid: false,
      validatedImages: [],
      error: `최대 ${IMAGE_CONFIG.maxCount}개의 이미지만 업로드 가능합니다`,
    };
  }

  const validatedImages = [];

  // 각 이미지 URL 검증
  for (const imageUrl of images) {
    if (typeof imageUrl !== 'string') {
      return { isValid: false, validatedImages: [], error: '올바르지 않은 이미지 URL 형식입니다' };
    }

    // Cloudinary URL인지 확인
    if (!IMAGE_CONFIG.cloudinaryPattern.test(imageUrl)) {
      return {
        isValid: false,
        validatedImages: [],
        error: 'Cloudinary 이미지만 허용됩니다. 제공된 업로드 위젯을 통해 이미지를 업로드해주세요.',
      };
    }

    validatedImages.push(imageUrl);
  }

  return { isValid: true, validatedImages, error: null };
};

// 2. Cloudinary 이미지 최적화
// param: cloudinary 이미지 URL
// 리턴값: 최적화된 이미지 URL (url에 /upload/q_auto,f_auto,w_1200/ 추가하면 브라우저에 맞는 최적 포맷으로 리사이징됨)

aiService.processCloudinaryImages = (images) => {
  return images.map((img) => {
    if (IMAGE_CONFIG.cloudinaryPattern.test(img) && img.includes('/upload/')) {
      return img.replace('/upload/', '/upload/q_auto,f_auto,w_1200/');
    }
    return img;
  });
};

// 3. AI suggestions 생성
// param1: 텍스트 내용
// param2: 이미지 URL array
// 리턴값: AI가 생성한 제안 사항

aiService.generateSuggestions = async (content, images = []) => {
  const trimmedContent = typeof content === 'string' ? content.trim() : '';
  const hasValidContent = trimmedContent.length > 0;

  const imageValidation = aiService.validateImages(images);
  if (!imageValidation.isValid) {
    throw new Error(imageValidation.error);
  }

  const validatedImages = imageValidation.validatedImages;

  if (!hasValidContent) {
    throw new Error('텍스트 내용이 필요합니다');
  }

  // API 키 확인
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('API 키가 설정되지 않았습니다');
  }

  // 오늘 날짜 (프롬프트용)
  const today = new Date().toISOString().split('T')[0];
  const messages = [];

  // AI로 전송할 메시지 data structure (텍스트는 필수)
  const userMessage = {
    role: 'user',
    content: [],
  };

  // 텍스트 컨텐츠 추가 (필수)
  userMessage.content.push({
    type: 'text',
    text: `Analyze and categorize this: ${trimmedContent}`,
  });

  // 이미지 컨텐츠 추가 (선택사항)
  if (validatedImages && validatedImages.length > 0) {
    validatedImages.forEach((imageUrl) => {
      userMessage.content.push({
        type: 'image',
        image: imageUrl,
      });
    });
  }

  messages.push(userMessage);

  // GPT-4o-mini 모델 사용 (비전 (이미지)) 기능 포함)
  const modelToUse = 'gpt-4o-mini';

  try {
    const { generateText } = await getAi();
    const { openai } = await getOpenAI();
    
    const { text } = await generateText({
      model: openai(modelToUse),
      system: getSystemPrompt(today),
      messages:
        messages.length > 0
          ? messages
          : [
              {
                role: 'user',
                content: `Analyze and categorize this: ${trimmedContent || 'the provided images'}`,
              },
            ],
      maxTokens: 1500, // 최대 토큰 (불필요한 긴 응답 방지)
      temperature: 0.3, // 일관된 분류 (답이 약간의 변화, 주로 일관성 있는 답변)
    });

    // AI 응답 JSON 파싱
    let parsed;
    try {
      parsed = JSON.parse(text);
      if (parsed.title === null || parsed.title === undefined) {
        parsed.title = trimmedContent ? trimmedContent.substring(0, 30) : '제목없음';
      }
    } catch {
      // 파싱 기본값
      parsed = {
        category: 'Other',
        title: trimmedContent ? trimmedContent.substring(0, 30) : '제목없음',
        priority: 'Medium',
        dueDate: null,
      };
    }

    return {
      parsed,
      trimmedContent,
      validatedImages: aiService.processCloudinaryImages(validatedImages),
    };
  } catch (error) {
    // OpenAI API 호출 실패 - 원본 에러 전달하여 statusCode 보존
    error.aiContext = 'AI 분석 중 오류가 발생했습니다';
    throw error;
  }
};

// 4. AI suggestions을 note data structure로 변환 후 리턴
// param: AI suggestions
// 리턴값: note data structure

aiService.formatNoteFromSuggestions = (suggestions) => {
  const { parsed, trimmedContent, validatedImages } = suggestions;

  // 카테고리 validation (AI가 잘못된 카테고리 제안 시 'Other'로 대체)
  const validCategories = ['Task', 'Idea', 'Reminder', 'Work', 'Goal', 'Personal', 'Other'];
  const finalCategory = validCategories.includes(parsed.category) ? parsed.category : 'Other';

  // dueDate 생성 (Task와 Reminder 카테고리만)

  let dueDate = null;
  const needsDueDate = finalCategory === 'Task' || finalCategory === 'Reminder';

  if (needsDueDate && parsed.dueDate) {
    dueDate = createDueDateAtNoonUTC(parsed.dueDate);
    
    if (dueDate) {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      // 과거 날짜는 우선순위에 따른 기본값으로 조정
      if (dueDate < today) {
        dueDate = generateDefaultDueDate('High');
      }
    }
  }

  // dueDate이 없는 경우 우선순위 기반 기본값 설정
  if (needsDueDate && !dueDate) {
    dueDate = generateDefaultDueDate(parsed.priority);
  }

  // Task와 Reminder는 completion 필요함
  const requiresCompletion = ['Task', 'Reminder'].includes(finalCategory);

  // 최종 노트 data structure
  // Ensure title is never null, empty string, or whitespace only
  const finalTitle = (parsed.title && typeof parsed.title === 'string' && parsed.title.trim()) 
    ? parsed.title.trim() 
    : '제목없음';
    
  
  const noteData = {
    title: finalTitle,
    content: trimmedContent || '',
    images: validatedImages || [],
    category: {
      name: finalCategory
    },
  };

  // completion 정보 추가 (Task/Reminder 카테고리만)
  if (requiresCompletion) {
    const finalDueDate = dueDate || generateDefaultDueDate();
    noteData.completion = {
      dueDate: finalDueDate,
      isCompleted: false,
      completedAt: null,
    };
  }

  return noteData;
};

module.exports = aiService;