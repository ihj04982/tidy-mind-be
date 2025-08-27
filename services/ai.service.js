require('dotenv').config();

// 우선순위별 기본 마감일 설정 
const PRIORITY_DAYS = {
  High: 1,
  Medium: 3,
  Low: 7,
  Default: 3,
};

// 이미지
const IMAGE_CONFIG = {
  maxCount: 5,
  cloudinaryPattern: /^https:\/\/res\.cloudinary\.com\//,
};

// 날짜를 UTC 정오로 설정 (타임존 문제 방지)
const createDueDateAtNoonUTC = (dateInput) => {
  let date;
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    // YYYY-MM-DD string: set to noon UTC
    date = new Date(dateInput + 'T12:00:00.000Z');
  } else if (dateInput instanceof Date) {
    // Already a Date: normalize to noon UTC
    date = new Date(dateInput);
    date.setUTCHours(12, 0, 0, 0);
  } else {
    // Invalid input
    return null;
  }
  return date;
};

// 우선순위 기반 기본 마감일 생성
const generateDefaultDueDate = (priority = 'Medium') => {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0); // Noon UTC
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
  const hasValidImages = validatedImages.length > 0;

  if (!hasValidContent && !hasValidImages) {
    throw new Error('내용 또는 이미지가 필요합니다');
  }

  // API 키 확인
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY가 설정되지 않았습니다');
  }

  // 오늘 날짜 (프롬프트용)
  const today = new Date().toISOString().split('T')[0];
  const messages = [];

  // AI로 전송할 메시지 data structure
  if (hasValidContent || validatedImages.length > 0) {
    const userMessage = {
      role: 'user',
      content: [],
    };

    if (hasValidContent) {
      userMessage.content.push({
        type: 'text',
        text: `Analyze and categorize this: ${trimmedContent}`,
      });
    } else if (validatedImages && validatedImages.length > 0) {
      // 이미지만 있는 경우 프롬프트
      userMessage.content.push({
        type: 'text',
        text: `Analyze these images carefully. IMPORTANT: Check if there's any Korean text in the images!
        
        LANGUAGE RULE (CRITICAL):
        - If you see Korean text in the image → Generate title, summary in Korean
        - If you see English text in the image → Generate title, summary in English
        - If mixed languages → Use the dominant language
        - 한글이 보이면 반드시 한국어로 응답하세요!
        
        Based on what you see:
        1. Create a descriptive title that captures the main subject or action
        2. Categorize appropriately (Task if it shows something to do, Reminder if it's time-sensitive, etc.)
        3. Generate a helpful summary describing what's in the image(s) for the "summary" field
        
        For different types of images:
        - 영수증: 상호명, 금액, 날짜, 구매 항목 추출
        - 스크린샷: 앱/웹사이트 식별 및 주요 정보 설명
        - 손글씨 메모: 읽을 수 있는 모든 텍스트 전사
        - 사진: 장면, 주제, 활동 설명
        - 문서: 핵심 포인트나 정보 요약
        
        The summary should be concise but informative (2-3 sentences).
        언어를 정확히 감지하여 동일한 언어로 응답하세요!`,
      });
    }

    // 이미지 컨텐츠 추가
    if (validatedImages && validatedImages.length > 0) {
      validatedImages.forEach((imageUrl) => {
        userMessage.content.push({
          type: 'image',
          image: imageUrl,
        });
      });
    }

    messages.push(userMessage);
  }

  // GPT-4o-mini 모델 사용 (비전 (이미지)) 기능 포함)
  const modelToUse = 'gpt-4o-mini';

  try {
    const { generateText } = await getAi();
    const { openai } = await getOpenAI();
    
    const { text } = await generateText({
      model: openai(modelToUse),
      system: `You are an AI assistant that helps organize thoughts and notes for people with ADHD.
    Today's date is: ${today}

    CRITICAL LANGUAGE RULE - YOU MUST FOLLOW THIS (!!!IMPORTANT!!!):
    1. First, detect the language from either:
       - The user's input text (if provided)
       - Text visible in images (OCR) - ESPECIALLY Korean text (한글)
       - If Korean text is detected in image → MUST respond in Korean
       - If English text is detected in image → respond in English
    2. Generate the "title", "tags", and "summary" in EXACTLY the same language as detected
    3. For Korean titles: Create natural, grammatically correct Korean phrases (!!!IMPORTANT!!!)
       - Use proper Korean grammar and word order
       - Make it concise and meaningful
       - Avoid literal translations or nonsensical combinations
    4. 이미지에 한글이 있으면 반드시 한국어로 제목과 요약을 작성하세요!
    4. Title Generation Guidelines:
       - Extract the CORE PURPOSE from the input
       - Remove unnecessary context, keep only essential info
       - Be specific but concise
       
    5. Examples by category:
       TASK Examples:
       - "I need to buy groceries for dinner" → "Buy groceries"
       - "Fix the broken printer in office" → "Fix office printer"
       - "장을 봐야 해" → "장보기"
       - "보고서 작성해야 함" → "보고서 작성"
       
       REMINDER Examples:
       - "Don't forget mom's birthday next week" → "Mom's birthday"
       - "Remember to take medicine at 2pm" → "Take medicine 2pm"
       - "내일 약 먹기" → "약 복용"
       - "친구 생일 잊지 말기" → "친구 생일"
       
       IDEA Examples:
       - "What if we create an app for..." → "App creation idea"
       - "새로운 앱 아이디어" → "앱 아이디어"
       
       WORK Examples:
       - "Meeting with John about Q3 results" → "Q3 results meeting"
       - "내일 존과 미팅" → "존과 미팅"
    6. DO NOT translate between languages - maintain the original language
    7. For Korean: Focus on creating natural, commonly used Korean expressions

    Analyze the given text and/or images and provide:
    1. A category from: Task, Idea, Reminder, Work, Goal, Personal, Other
    2. A short, descriptive title (max 6 words) that:
       - Uses the SAME LANGUAGE as the input
       - Is grammatically correct and natural sounding
       - Captures the MAIN ACTION or KEY POINT
       - For Tasks: Start with action verb (Do, Buy, Send, Fix, Call, etc.)
       - For Reminders: Include what to remember
       - For Ideas: Capture the core concept
       - Avoid filler words, focus on essential information
    3. Priority level: High, Medium, or Low
    4. Estimated time in minutes (for tasks/activities)
    5. Up to 3 relevant tags (single words) that:
       - Use the SAME LANGUAGE as the input
       - Are meaningful and commonly used words
       - Relate directly to the content
    6. For Task and Reminder categories: ALWAYS provide a due date
       - First, try to extract date from text (tomorrow, next week, Friday, etc.) (!!!IMPORTANT!!!)
       - If no date mentioned, SUGGEST based on priority:
         * High priority: 1-2 days from today
         * Medium priority: 3-7 days from today  
         * Low priority: 7-14 days from today
       - Format: YYYY-MM-DD (e.g., "2025-08-26")
    7. If images are provided: Extract text, identify objects, understand context
    
    For images, consider:
    - Screenshots of tasks, emails, or documents
    - Photos of handwritten notes or whiteboards
    - Receipts or bills that need action
    - Calendar events or schedules
    - Any visual information that provides context
    
    Categories explained:
    - Task: Specific action items, to-dos, assignments, things that need to be done
    - Idea: Creative thoughts, innovations, concepts, brainstorming, "what if" scenarios
    - Reminder: Time-sensitive items, appointments, deadlines, scheduled events, "don't forget"
    - Work: Professional activities, job-related items, career matters, business projects, meetings
    - Goal: Long-term aspirations, objectives, targets, ambitions, future plans
    - Personal: Personal life, emotions, reflections, hobbies, relationships, self-care, daily life
    - Other: Only use if text truly doesn't fit any above category
    
    Respond with ONLY valid JSON in this exact format (!!!NO COMMENTS!!!):
    {
      "category": "CategoryName",
      "title": "Short Descriptive Title",
      "priority": "High/Medium/Low",
      "estimatedTime": 30,
      "tags": ["tag1", "tag2", "tag3"],
      "dueDate": "YYYY-MM-DD",
      "summary": "Brief description of image content (only if image provided without text)"
    }
    
    IMPORTANT: For Task and Reminder categories, dueDate should be a date string like "2025-08-26", not null
    
    STRICT RULES FOR ACCURATE TITLES:
    1. NO COMMENTS in the JSON (no // or /* */ comments)
    2. Category and Priority: ALWAYS in English
    3. Title Creation Process:
       a) Identify the main subject/object
       b) Identify the main action/verb
       c) Keep only essential details
       d) Use the same language as input
    4. Common patterns for better titles:
       - Tasks: [Verb] + [Object] (e.g., "Send report", "보고서 작성")
       - Reminders: [Event/Item] + [Time if critical] (e.g., "Team meeting 3pm", "병원 예약")
       - Ideas: [Concept] + [Type] (e.g., "Marketing strategy", "신제품 아이디어")
    5. For null values, use null not "null"
    6. Return ONLY the JSON object, nothing else`,
      messages:
        messages.length > 0
          ? messages
          : [
              {
                role: 'user',
                content: `Analyze and categorize this: ${trimmedContent || 'the provided images'}`,
              },
            ],
      maxTokens: 1000, // 최대 토큰 (불필요한 긴 응답 방지)
      temperature: 0.3, // 일관된 분류 (답이 약간의 변화, 주로 일관성 있는 답변)
    });

    // AI 응답 JSON 파싱
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      // 파싱 실패 시 기본값
      parsed = {
        category: 'Other',
        title: trimmedContent ? trimmedContent.substring(0, 30) : 'Untitled',
        priority: 'Medium',
        estimatedTime: null,
        tags: [],
        dueDate: null,
        summary: null,
      };
    }

    return {
      parsed,
      trimmedContent,
      validatedImages: aiService.processCloudinaryImages(validatedImages),
    };
  } catch (error) {
    // OpenAI API 호출 실패
    throw new Error(`AI 분석 중 오류가 발생했습니다: ${error.message}`);
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

  const categoryColors = {
    Task: '#3378FF',
    Idea: '#63B6FF',
    Reminder: '#FD7642',
    Work: '#00B380',
    Goal: '#7448F7',
    Personal: '#FF8BB7',
    Other: '#F5C3BD',
  };

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
        // Past date: use high priority default (1 day)
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
  // 이미지만 있는 경우: AI가 생성한 summary를 content로 사용
  // 텍스트가 있는 경우: 원본 텍스트를 content로 사용
  const noteData = {
    title: parsed.title || 'Untitled',
    content: trimmedContent || parsed.summary || '',
    images: validatedImages || [],
    category: {
      name: finalCategory,
      color: categoryColors[finalCategory] || '#F5C3BD',
    },
  };

  // completion 정보 추가 (Task/Reminder 카테고리만)
  if (requiresCompletion) {
    // dueDate should always exist for Task/Reminder, but add fallback just in case
    const finalDueDate = dueDate || generateDefaultDueDate();
    noteData.completion = {
      dueDate: finalDueDate.toISOString(),
      isCompleted: false,
      completedAt: null,
    };
  }

  return noteData;
};

module.exports = aiService;