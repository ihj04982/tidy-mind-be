const { createGroq } = require('@ai-sdk/groq');
const { generateText } = require('ai');
require('dotenv').config();

const suggestController = {};

// AI 콘텐츠 제안 컨트롤러
// req.body.content: 입력한 텍스트
// req.body.images: 이미지 URL 배열 (선택사항)

suggestController.suggestContent = async (req, res) => {
  const { content, images = [] } = req.body;

  try {
    // 입력값 검증
    if (!content && (!images || images.length === 0)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Content or images are required',
      });
    }

    // API 키 확인
    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({
        error: 'SERVER_ERROR',
        message: 'API key not configured',
      });
    }

    const groq = createGroq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const today = new Date().toISOString().split('T')[0];

    // AI 메시지 배열 준비
    const messages = [];

    if (content || images.length > 0) {
      const userMessage = {
        role: 'user',
        content: [],
      };

      if (content) {
        userMessage.content.push({
          type: 'text',
          text: `Analyze and categorize this: ${content}`,
        });
      }

      if (images && images.length > 0) {
        images.forEach((imageUrl) => {
          if (imageUrl.startsWith('http') || imageUrl.startsWith('https')) {
            userMessage.content.push({
              type: 'image',
              image: imageUrl,
            });
          } else if (imageUrl.startsWith('data:')) {
            userMessage.content.push({
              type: 'image',
              image: imageUrl,
            });
          }
        });
      }

      messages.push(userMessage);
    }

    // 모델 선택: 이미지 유무에 따라 결정
    const modelToUse =
      images && images.length > 0 ? 'llama-3.2-90b-vision-preview' : 'llama-3.1-8b-instant';

    // AI 프롬프트: 언어 동일 유지, 카테고리는 영어, Task/Reminder는 날짜 필수
    const { text } = await generateText({
      model: groq(modelToUse),
      system: `You are an AI assistant that helps organize thoughts and notes for people with ADHD.
      Today's date is: ${today}

      CRITICAL LANGUAGE RULE - YOU MUST FOLLOW THIS (!!!IMPORTANT!!!):
      1. First, detect the language of the user's input text 
      2. Generate the "title" and "tags" in EXACTLY the same language as detected
      3. For Korean titles: Create natural, grammatically correct Korean phrases (!!!IMPORTANT!!!)
         - Use proper Korean grammar and word order
         - Make it concise and meaningful
         - Avoid literal translations or nonsensical combinations
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
      
      Respond with ONLY valid JSON in this exact format (NO COMMENTS!):
      {
        "category": "CategoryName",
        "title": "Short Descriptive Title",
        "priority": "High/Medium/Low",
        "estimatedTime": 30,
        "tags": ["tag1", "tag2", "tag3"],
        "dueDate": "YYYY-MM-DD"
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
                content: `Analyze and categorize this: ${content || 'the provided images'}`,
              },
            ],
    });

    // JSON 파싱을 위한 특수문자 제거
    let cleanedText = text;
    cleanedText = cleanedText.replace(/\/\/.*$/gm, '');
    cleanedText = cleanedText.replace(/\/\*[\s\S]*?\*\//g, '');

    // JSON 파싱: 실패시 기본값
    let parsed;
    try {
      parsed = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Original text:', text);
      console.error('Cleaned text:', cleanedText);

      // 파싱 실패시 기본값 설정
      parsed = {
        category: 'Other',
        title: content ? content.substring(0, 30) : 'Untitled',
        priority: 'Medium',
        estimatedTime: null,
        tags: [],
        dueDate: null,
        dueDateSource: null,
      };
    }
    // AI가 추천한 카테고리 검증: 만약 실수로 다른 카테고리 추천 했을 경우 Other로 설정
    const validCategories = ['Task', 'Idea', 'Reminder', 'Work', 'Goal', 'Personal', 'Other'];
    const finalCategory = validCategories.includes(parsed.category) ? parsed.category : 'Other';

    // Task/Reminder 마감일 처리
    let dueDate = null;
    if ((finalCategory === 'Task' || finalCategory === 'Reminder') && parsed.dueDate) {
      // YYYY-MM-DD 형식 검증
      if (/^\d{4}-\d{2}-\d{2}$/.test(parsed.dueDate)) {
        const dateObj = new Date(parsed.dueDate);
        if (!isNaN(dateObj.getTime())) {
          dueDate = parsed.dueDate;
        } else {
          console.warn('Invalid date provided by AI:', parsed.dueDate);
        }
      }
    }

    // 카테고리별 색상
    const categoryColors = {
      Task: '#3378FF',
      Idea: '#63B6FF',
      Reminder: '#FD7642',
      Work: '#00B380',
      Goal: '#7448F7',
      Personal: '#FF8BB7',
      Other: '#F5C3BD',
    };

    // MongoDB 스키마 형식으로 response 생성
    const requiresCompletion = ['Task', 'Reminder'].includes(finalCategory);
    
    const response = {
      _id: null,
      userId: null,
      title: parsed.title || 'Untitled',
      content: content || '',
      images: images || [],
      category: {
        name: finalCategory,
        color: categoryColors[finalCategory] || '#F5C3BD',
      },
      completion: null,

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Task/Reminder completion 추가
    if (requiresCompletion && dueDate) {
      response.completion = {
        dueDate: new Date(dueDate).toISOString(),
        isCompleted: false,
        completedAt: null,
      };
    }

    res.status(200).json(response);
  } catch (error) {
    // 에러 로깅
    console.error('Error categorizing content:', {
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
      timestamp: new Date().toISOString(),
    });

    // 클라이언트 에러 (400)
    if (error.statusCode === 400) {
      return res.status(400).json({
        status: 'fail',
        error: error.message,
      });
    }

    // 서버 에러 (500)
    if (error.statusCode === 500) {
      return res.status(500).json({
        status: 'error',
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
      });
    }
  }
};

module.exports = suggestController;