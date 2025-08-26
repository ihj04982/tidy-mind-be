const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const validator = require('../utils/validator');

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

    // 2-1) 이메일 검증
    if (!validator.validateEmail(email)) {
      return res.status(422).json({
        error: 'INVALID_EMAIL',
        message: '올바른 이메일 주소 형식이 아닙니다.',
      });
    }

    // 2-2) 비밀번호 검증
    if (!validator.validatePassword(password)) {
      return res.status(422).json({
        error: 'WEAK_PASSWORD',
        message: '비밀번호는 8~20자, 영문과 숫자를 포함해야 합니다.',
      });
    }

    // 3) 이메일 중복 확인
    const existing = await User.findOne({ email }).lean();
    if (existing) {
      return res.status(409).json({
        error: 'DUPLICATE_EMAIL',
        message: '이미 사용 중인 이메일입니다.',
      });
    }

    // 4) 비밀번호 해싱
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 5) 유저 생성
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    // 6) 성공 응답
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

// 토큰 검증
authController.hydrate = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message: '유효하지 않은 토큰입니다.',
      });
    }

    return res.status(200).json({
      message: '토큰 검증 성공',
      user,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: '토큰 검증 중 문제가 발생했습니다.',
    });
  }
};

authController.authenticate = async (req, res, next) => {
  const tokenString = req.headers.authorization;
  if (!tokenString) {
    return res.status(401).json({
      error: 'NO_TOKEN',
      message: '인증 토큰이 필요합니다.',
    });
  }

  try {
    const token = tokenString.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
    const user = await User.findById(decoded._id);

    if (!user) {
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message: '유효하지 않은 토큰입니다.',
      });
    }

    req.user = user;
    req.userId = decoded._id;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'INVALID_TOKEN',
        message:
          error.name === 'TokenExpiredError'
            ? '토큰이 만료되었습니다.'
            : '유효하지 않은 토큰입니다.',
      });
    }
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: '인증 처리 중 문제가 발생했습니다.',
    });
  }
};

module.exports = authController;
