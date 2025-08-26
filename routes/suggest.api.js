const express = require("express");

const router = express.Router();
const suggestController = require("../controllers/suggest.controller");

// POST /suggest
// AI 제안 미리보기 엔드포인트 (DB 저장 x)
 
// collections에서 유저가 suggestion을 수정한 후 저장하는 기능 구현 시 suggestions를 preview할 수 있는 기능 구현 시 사용
// 노트 생성은 POST /notes/suggest 사용
 
router.post("/", suggestController.suggestContent);

module.exports = router;