const express = require('express');
const router = express.Router();

const authRouter = require('./auth.api');
const noteRouter = require('./note.api');
const suggestRouter = require('./suggest.api');

router.use('/auth', authRouter);
router.use('/notes', noteRouter);
router.use('/suggest', suggestRouter);

module.exports = router;

