const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const noteController = require('../controllers/note.controller');

router.post('/', authController.authenticate, noteController.create);
router.post('/suggest', authController.authenticate, noteController.createNoteWithSuggestion);
router.get('/', authController.authenticate, noteController.getNotes);

router.get('/statics', authController.authenticate, noteController.getNotesStatics);

router.get('/:id', authController.authenticate, noteController.getNote);
router.put('/:id', authController.authenticate, noteController.updateNote);
router.patch('/:id', authController.authenticate, noteController.updateNote);
router.delete('/:id', authController.authenticate, noteController.deleteNote);

module.exports = router;
