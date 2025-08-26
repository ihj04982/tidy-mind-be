const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');

// 회원가입
router.post('/register', authController.register);
// 로그인
router.post('/login', authController.login);
// 토큰 검증
router.get('/hydrate', authController.authenticate, authController.hydrate);

module.exports = router;
