const Note = require('../models/Note');
const aiService = require('../services/ai.service');

const noteController = {};

// 노트 생성
noteController.create = async (req, res) => {
  const { title, content, images, category, completion } = req.body;
  const userId = req.userId;

  if (!title || !content || !category) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'title, content, category는 필수입니다.',
    });
  }

  try {
    const note = await Note.create({
      userId,
      title,
      content,
      images: images || [],
      category,
      completion,
    });

    return res.status(201).json({
      message: '노트가 생성되었습니다.',
      note,
    });
  } catch (error) {
    return res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: error.message,
    });
  }
};

// 노트 목록 조회
noteController.getNotes = async (req, res) => {
  const { category, isCompleted } = req.query;
  const userId = req.userId;

  try {
    const query = { userId };

    if (category) {
      query['category.name'] = category;
    }

    if (isCompleted !== undefined) {
      query['completion.isCompleted'] = isCompleted === 'true';
    }

    const notes = await Note.find(query).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      message: '노트 목록을 조회했습니다.',
      notes,
    });
  } catch {
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: '노트 목록 조회 중 문제가 발생했습니다.',
    });
  }
};

// 노트 상세 조회
noteController.getNote = async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  try {
    const note = await Note.findOne({ _id: id, userId }).lean();

    if (!note) {
      return res.status(404).json({
        error: 'NOTE_NOT_FOUND',
        message: '노트를 찾을 수 없습니다.',
      });
    }

    return res.status(200).json({
      message: '노트를 조회했습니다.',
      note,
    });
  } catch (error) {
    return res.status(400).json({
      error: 'INVALID_ID',
      message: '올바르지 않은 노트 ID입니다.',
    });
  }
};

// 노트 수정
noteController.updateNote = async (req, res) => {
  const { id } = req.params;
  const { title, content, images, category, completion } = req.body;
  const userId = req.userId;

  try {
    const note = await Note.findOne({ _id: id, userId });

    if (!note) {
      return res.status(404).json({
        error: 'NOTE_NOT_FOUND',
        message: '노트를 찾을 수 없습니다.',
      });
    }

    // 부분 업데이트
    if (title !== undefined) note.title = title;
    if (content !== undefined) note.content = content;
    if (images !== undefined) note.images = images;
    if (category !== undefined) note.category = category;
    if (completion !== undefined) note.completion = completion;

    await note.save();

    return res.status(200).json({
      message: '노트가 수정되었습니다.',
      note,
    });
  } catch (error) {
    return res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: error.message,
    });
  }
};

// 노트 삭제
noteController.deleteNote = async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  try {
    const note = await Note.findOneAndDelete({ _id: id, userId });

    if (!note) {
      return res.status(404).json({
        error: 'NOTE_NOT_FOUND',
        message: '노트를 찾을 수 없습니다.',
      });
    }

    return res.status(200).json({
      message: '노트가 삭제되었습니다.',
    });
  } catch (error) {
    return res.status(400).json({
      error: 'INVALID_ID',
      message: '올바르지 않은 노트 ID입니다.',
    });
  }
};

// 히트맵
noteController.getNotesStatus = async (req, res) => {
  try {
    const userId = req.userId;
    const { year, month } = req.query;

    const yearNum = parseInt(year);
    const monthNum = parseInt(month);

    if (!yearNum || !monthNum) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'year, month 파라미터가 필요합니다.',
      });
    }

    if (yearNum < 1900 || yearNum > 2100 || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: '올바른 날짜를 입력해주세요.',
      });
    }

    // All Completed Task, Reminder
    const allNotes = await Note.find({
      userId,
      'category.name': { $in: ['Task', 'Reminder'] },
    });

    // 요청한 날짜에 맞는 데이터 필터링
    const monthlyNotes = allNotes.filter((note) => {
      const targetDate = note.completion?.dueDate;
      const year = targetDate.getFullYear();
      const month = targetDate.getMonth() + 1;

      return year === yearNum && month === monthNum;
    });

    // 일자 별 Completed Data Count
    const countsByDate = {};

    monthlyNotes
      .filter((note) => note.completion.isCompleted === true)
      .forEach((note) => {
        const completeDate = new Date(note.completion.dueDate);
        const dateKey = completeDate.toISOString().slice(0, 10);
        countsByDate[dateKey] = (countsByDate[dateKey] || 0) + 1;
      });

    const endDate = new Date(yearNum, monthNum, 0).getDate();

    const dailyCounts = {};

    for (let d = 1; d <= endDate; d++) {
      const key = `${yearNum}-${monthNum.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      dailyCounts[key] = countsByDate[key] || 0;
    }

    const total = Object.values(dailyCounts).reduce((acc, val) => acc + val, 0);

    return res.status(200).json({
      message: 'Get Completed Data Success.',
      data: {
        dailyCounts,
        monthlyNotes,
        total,
      },
    });
  } catch (error) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: error.message,
    });
  }
};

// 노트 생성 with AI suggestion
noteController.createNoteWithSuggestion = async (req, res) => {
  const { content, images = [] } = req.body;
  const userId = req.userId;

  try {
    // AI 제안 생성
    const suggestions = await aiService.generateSuggestions(content, images);
    
    // suggestions을 노트 데이터 형식으로 변환
    const noteData = aiService.formatNoteFromSuggestions(suggestions);
    
    // AI suggestions과 함께 노트 생성
    const note = await Note.create({
      userId,
      ...noteData,
    });

    return res.status(201).json({
      message: '노트가 AI 제안과 함께 저장되었습니다.',
      note,
    });
  } catch (error) {
    console.error('Error creating note with suggestion:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    // validation 에러
    if (error.message === '텍스트 내용이 필요합니다') {
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

    // AI API 에러 - OpenAI SDK - 'status'
    const httpStatus = error.status || error.statusCode || error.response?.status;
    
    if (httpStatus === 429) {
      return res.status(429).json({
        error: 'RATE_LIMIT_ERROR',
        message: 'AI 서비스 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
      });
    }

    if (httpStatus >= 400 && httpStatus < 500) {
      return res.status(400).json({
        error: 'AI_API_ERROR',
        message: 'AI 분석 중 오류가 발생했습니다. 입력 내용을 확인해주세요.',
      });
    }

    // MongoDB validation에러  
    if (error.name === 'ValidationError') {
      return res.status(422).json({
        error: 'VALIDATION_ERROR',
        message: error.message,
      });
    }

    // 서버 에러
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: process.env.NODE_ENV === 'development' 
        ? `서버 오류: ${error.message}` 
        : '노트 저장 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    });
  }
};

module.exports = noteController;