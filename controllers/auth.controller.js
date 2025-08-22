const bcrypt = require('bcryptjs');

const User = require('../models/User');

const authController = {};

// 회원가입
authController.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 1) 필수값 검증
    if (!email || !password || !name) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'email, password, name 은 필수입니다.',
      });
    }

    // 2) 이메일 중복 확인
    const existing = await User.findOne({ email }).lean();
    if (existing) {
      return res.status(409).json({
        error: 'DUPLICATE_EMAIL',
        message: '이미 사용 중인 이메일입니다.',
      });
    }

    // 3) 비밀번호 해싱
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4) 유저 생성
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    // 5) 성공 응답
    return res.status(201).json({
      message: '회원가입 성공',
      user,
    });
  } catch (error) {
    console.log(error);

    // DB unique 에러 (MongoDB E11000 duplicate key)
    if (error.code === 11000) {
      return res.status(409).json({
        error: 'DUPLICATE_EMAIL',
        message: '이미 사용 중인 이메일입니다.',
      });
    }

    // 예상치 못한 에러
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: '회원가입 중 문제가 발생했습니다.',
    });
  }
};

// 로그인
authController.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1) 필수값 검증
    if (!email || !password) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'email, password 는 필수입니다.',
      });
    }

    // 2) 사용자 조회
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: '이메일 또는 비밀번호가 올바르지 않습니다.',
      });
    }

    // 3) 비밀번호 검증
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        error: 'INVALID_CREDENTIALS',
        message: '이메일 또는 비밀번호가 올바르지 않습니다.',
      });
    }

    // 4) JWT 토큰 생성
    const token = await user.generateAuthToken();

    // 5) 성공 응답
    return res.status(200).json({
      message: '로그인 성공',
      user,
      token,
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: '로그인 처리 중 문제가 발생했습니다.',
    });
  }
};

module.exports = authController;
