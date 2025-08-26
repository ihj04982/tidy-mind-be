const express = require("express");

const router = express.Router();
const authController = require("../controllers/auth.controller");
const suggestController = require("../controllers/suggest.controller");
 
router.post("/", authController.authenticate, suggestController.suggestContent);

module.exports = router;