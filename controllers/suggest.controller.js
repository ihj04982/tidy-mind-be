const { createGroq } = require('@ai-sdk/groq');
const { generateText } = require('ai');
require('dotenv').config();

const suggestController = {};

suggestController.suggestContent = async (req, res) => {
  const { content, images = [] } = req.body;

  try {
    if (!content && (!images || images.length === 0)) {
      throw new Error('Content or images are required');
    }

    console.log('Received content to categorize:', content);

    const groq = createGroq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const today = new Date().toISOString().split('T')[0];

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

    const modelToUse =
      images && images.length > 0 ? 'llama-3.2-90b-vision-preview' : 'llama-3.1-8b-instant';

    console.log('Using model:', modelToUse);

    const { text } = await generateText({
      model: groq(modelToUse),
      system: `You are an AI assistant that helps organize thoughts and notes for people with ADHD.
      Today's date is: ${today}

      CRITICAL LANGUAGE RULE - YOU MUST FOLLOW THIS:
      1. First, detect the language of the user's input text
      2. Generate the "title" and "tags" in EXACTLY the same language as detected
      3. For Korean titles: Create natural, grammatically correct Korean phrases
         - Use proper Korean grammar and word order
         - Make it concise and meaningful
         - Avoid literal translations or nonsensical combinations
      4. Examples:
         English inputs → English titles:
         - "I need to buy groceries" → "Buy groceries"
         - "Meeting with John tomorrow" → "Meeting with John"
         - "Fix the broken printer" → "Fix printer"
         
         Korean inputs → Natural Korean titles:
         - "장을 봐야 해" → "장보기"
         - "내일 존과 미팅" → "존과 미팅"
         - "숙제를 끝내야 함" → "숙제 완료하기"
         - "친구 생일 선물 준비" → "생일 선물 준비"
         - "운동하러 가야됨" → "운동 가기"
         - "보고서 작성해야 함" → "보고서 작성"
      5. DO NOT translate between languages - maintain the original language
      6. For Korean: Focus on creating natural, commonly used Korean expressions

      Analyze the given text and/or images and provide:
      1. A category from: Task, Idea, Reminder, Work, Goal, Personal, Other
      2. A short, descriptive title (max 6 words) that:
         - Uses the SAME LANGUAGE as the input
         - Is grammatically correct and natural sounding
         - Captures the main point concisely
      3. Priority level: High, Medium, or Low
      4. Estimated time in minutes (for tasks/activities)
      5. Up to 3 relevant tags (single words) that:
         - Use the SAME LANGUAGE as the input
         - Are meaningful and commonly used words
         - Relate directly to the content
      6. For Task and Reminder categories: ALWAYS provide a due date
         - First, try to extract date from text (tomorrow, next week, Friday, etc.)
         - If no date mentioned, SUGGEST based on priority:
           * High priority: 1-2 days from today
           * Medium priority: 3-7 days from today  
           * Low priority: 7-14 days from today
         - Format: YYYY-MM-DD (e.g., "2025-08-26")
         - Set dueDateSource: "extracted" if found in text, "suggested" if auto-generated
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
        "dueDate": "YYYY-MM-DD",
        "dueDateSource": "extracted or suggested"
      }
      
      IMPORTANT: For Task and Reminder categories, dueDate should be a date string like "2025-08-26", not null
      
      STRICT RULES:
      1. NO COMMENTS in the JSON (no // or /* */ comments)
      2. Category and Priority: ALWAYS in English
      3. Title and Tags: SAME language as input
         - English input → English title/tags
         - Korean input → Natural Korean title/tags (자연스러운 한국어 사용)
      4. For null values, use null not "null"
      5. Return ONLY the JSON object, nothing else
      6. Korean titles should be natural and grammatically correct (올바른 한국어 문법)`,
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

    console.log('AI raw response:', text);

    // Clean up the response to handle potential issues
    let cleanedText = text;
    
    // Remove any comments (// or /* */)
    cleanedText = cleanedText.replace(/\/\/.*$/gm, ''); // Remove single-line comments
    cleanedText = cleanedText.replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments
    
    // Try to parse the cleaned JSON
    let parsed;
    try {
      parsed = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      console.error('Original text:', text);
      console.error('Cleaned text:', cleanedText);
      // Provide a fallback response
      parsed = {
        category: 'Other',
        title: content ? content.substring(0, 30) : 'Untitled',
        priority: 'Medium',
        estimatedTime: null,
        tags: [],
        dueDate: null,
        dueDateSource: null
      };
    }
    const validCategories = ['Task', 'Idea', 'Reminder', 'Work', 'Goal', 'Personal', 'Other'];
    const validPriorities = ['High', 'Medium', 'Low'];

    const finalCategory = validCategories.includes(parsed.category) ? parsed.category : 'Other';
    const finalPriority = validPriorities.includes(parsed.priority) ? parsed.priority : 'Medium';

    let dueDate = null;
    let dueDateSource = null;
    if ((finalCategory === 'Task' || finalCategory === 'Reminder') && parsed.dueDate) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(parsed.dueDate)) {
        dueDate = parsed.dueDate;
        dueDateSource = parsed.dueDateSource || 'suggested';
      }
    }

    console.log('Parsed response:', {
      category: finalCategory,
      title: parsed.title || 'Untitled',
      priority: finalPriority,
      estimatedTime: parsed.estimatedTime,
      tags: parsed.tags,
      dueDate: dueDate,
      dueDateSource: dueDateSource,
    });

    const categoryColors = {
      Task: '#3378FF',
      Idea: '#63B6FF',
      Reminder: '#FD7642',
      Work: '#00B380',
      Goal: '#7448F7',
      Personal: '#FF8BB7',
      Other: '#F5C3BD',
    };

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

    if (requiresCompletion && dueDate) {
      response.completion = {
        dueDate: new Date(dueDate).toISOString(),
        isCompleted: false,
        completedAt: null,
      };
    }

    console.log('Formatted response:', response);

    res.status(200).json(response);
  } catch (error) {
    console.error('Error categorizing content:', error);

    if (error.message === 'Content or images are required') {
      return res.status(400).json({
        status: 'fail',
        error: error.message,
      });
    }
    const defaultResponse = {
      _id: null,
      userId: null,
      title: 'Untitled',
      content: content || '',
      images: images || [],
      category: {
        name: 'Other',
        color: '#757575',
      },
      completion: {
        dueDate: null,
        isCompleted: false,
        completedAt: null,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    res.status(200).json(defaultResponse);
  }
};

module.exports = suggestController;
