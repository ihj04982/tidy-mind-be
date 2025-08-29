const Note = require('../models/Note');

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

    if (title !== undefined) note.title = title;
    if (content !== undefined) note.content = content;
    if (images !== undefined) note.images = images;
    if (category !== undefined) note.category = category;

    if (completion !== undefined) {
      if (!note.completion) {
        note.completion = {};
      }

      const wasCompleted = note.completion.isCompleted;

      Object.assign(note.completion, completion);

      if (completion.isCompleted !== undefined && completion.isCompleted !== wasCompleted) {
        note.completion.completedAt = completion.isCompleted ? new Date() : undefined;
      }
    }

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
noteController.getNotesStatics = async (req, res) => {
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

module.exports = noteController;
