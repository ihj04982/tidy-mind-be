const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');

// 회원가입
router.post('/register', authController.register);
// 로그인
router.post('/login', authController.login);
// 구글 로그인
router.post('/google', authController.googleLogin);

module.exports = router;
