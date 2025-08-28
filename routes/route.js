const express = require('express');
const router = express.Router();

const authRouter = require('./auth.api');
const noteRouter = require('./note.api');

router.use('/auth', authRouter);
router.use('/notes', noteRouter);

module.exports = router;

