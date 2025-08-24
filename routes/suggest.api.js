const express = require("express");

const router = express.Router();
const suggestController = require("../controllers/suggest.controller");

router.post("/", suggestController.suggestContent);

module.exports = router;