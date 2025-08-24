const { createGroq } = require('@ai-sdk/groq');
const { generateText } = require('ai');
require('dotenv').config();

const suggestController = {};

// req.body.content: 입력한 텍스트
// req.body.images: 이미지 URL 배열 (선택사항)

suggestController.suggestContent = async (req, res) => {
  const { content, images = [] } = req.body;

  try {
    if (!content && (!images || images.length === 0)) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Content or images are required',
      });
    }

    // 이미지 validation 설정 (Cloudinary 전용)
    const IMAGE_CONFIG = {
      maxCount: 5,
      cloudinaryPattern: /^https:\/\/res\.cloudinary\.com\//,
    };

    // 이미지 개수 validation
    if (images.length > IMAGE_CONFIG.maxCount) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: `Maximum ${IMAGE_CONFIG.maxCount} images allowed`,
      });
    }

    // Cloudinary URL validation: Cloudinary를 통해서만 업로드 가능함
    const validatedImages = [];
    for (const imageUrl of images) {
      if (typeof imageUrl !== 'string') {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid image URL format',
        });
      }

      if (!IMAGE_CONFIG.cloudinaryPattern.test(imageUrl)) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message:
            'Only Cloudinary images are allowed. Please upload images through the provided upload widget.',
        });
      }

      try {
        const url = new URL(imageUrl);

        if (url.protocol !== 'https:') {
          return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'Images must use secure HTTPS protocol',
          });
        }

        validatedImages.push(imageUrl);
        console.log('Cloudinary image validated:', imageUrl);
      } catch (error) {
        console.error('URL validation error:', error);
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Invalid Cloudinary URL format',
        });
      }
    }

    // API 키 validation
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

    // 유저의 컨텐츠나 이미지 배열이 들어갈 array
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

    // 모델 선택: 이미지 유무에 따라 결정됨 (현재 사용하는 무료 api key: 이미지 처리 불가/ 이미지처리는 다른 모델을 사용할 것 같음: 조사 필요함)
    const modelToUse =
      validatedImages && validatedImages.length > 0
        ? 'llama-3.2-90b-vision-preview'
        : 'llama-3.1-8b-instant';

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

    // 특수문자 제거
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

      // 파싱 실패시 기본값
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
    // AI가 실수로 다른 카테고리 추천 했을 경우 Other로 설정
    const validCategories = ['Task', 'Idea', 'Reminder', 'Work', 'Goal', 'Personal', 'Other'];
    const finalCategory = validCategories.includes(parsed.category) ? parsed.category : 'Other';

    let dueDate = null;
    if ((finalCategory === 'Task' || finalCategory === 'Reminder') && parsed.dueDate) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(parsed.dueDate)) {
        const dateObj = new Date(parsed.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (!isNaN(dateObj.getTime())) {
          // 오늘 이전 날짜는 x
          if (dateObj < today) {
            console.warn('Past date provided, adjusting to today:', parsed.dueDate);
            dueDate = today.toISOString().split('T')[0];
          }
          // 1년 이후 날짜는 x
          else if (dateObj > new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000)) {
            console.warn('Date too far in future, adjusting to 1 year from today:', parsed.dueDate);
            const oneYearLater = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000);
            dueDate = oneYearLater.toISOString().split('T')[0];
          } else {
            dueDate = parsed.dueDate;
          }
        } else {
          console.warn('Invalid date format provided by AI:', parsed.dueDate);
          // AI가 추천해준 우선순위에 따른 기본 날짜 설정
          const daysToAdd = parsed.priority === 'High' ? 1 : parsed.priority === 'Medium' ? 5 : 7;
          const defaultDate = new Date(today.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
          dueDate = defaultDate.toISOString().split('T')[0];
        }
      } else {
        console.warn('Invalid date format, expected YYYY-MM-DD:', parsed.dueDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const defaultDate = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
        dueDate = defaultDate.toISOString().split('T')[0];
      }
    }

    const categoryColors = {
      Task: '#3378FF',
      Idea: '#63B6FF',
      Reminder: '#FD7642',
      Work: '#00B380',
      Goal: '#7448F7',
      Personal: '#FF8BB7',
      Other: '#F5C3BD',
    };

    const processCloudinaryImages = (images) => {
      return images.map((img) => {
        // Cloudinary URL인 경우 자동 최적화 변환 추가
        if (IMAGE_CONFIG.cloudinaryPattern.test(img)) {
          if (!img.includes('/upload/')) {
            return img;
          }
          const optimizedUrl = img.replace('/upload/', '/upload/q_auto,f_auto,w_1200/');
          return optimizedUrl;
        }
        return img;
      });
    };

    const requiresCompletion = ['Task', 'Reminder'].includes(finalCategory);

    const response = {
      _id: null,
      userId: null,
      title: parsed.title || 'Untitled',
      content: content || '',
      images: processCloudinaryImages(validatedImages || []),
      category: {
        name: finalCategory,
        color: categoryColors[finalCategory] || '#F5C3BD',
      },
      completion: null,

      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (requiresCompletion && dueDate) {
      response.completion = {
        dueDate: new Date(dueDate).toISOString(),
        isCompleted: false,
        completedAt: null,
      };
    }

    res.status(200).json(response);
  } catch (error) {
    console.error('Error categorizing content:', {
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
      timestamp: new Date().toISOString(),
    });

    if (error.statusCode === 400) {
      return res.status(400).json({
        status: 'fail',
        error: error.message,
      });
    }

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
