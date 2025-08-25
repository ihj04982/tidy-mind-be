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

module.exports = noteController;
