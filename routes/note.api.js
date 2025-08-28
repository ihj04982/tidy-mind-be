const express = require('express');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const noteController = require('../controllers/note.controller');

router.post('/', authController.authenticate, noteController.create);
router.get('/', authController.authenticate, noteController.getNotes);

router.get('/status', authController.authenticate, noteController.getNotesStatus);

router.get('/:id', authController.authenticate, noteController.getNote);
router.put('/:id', authController.authenticate, noteController.updateNote);
router.patch('/:id', authController.authenticate, noteController.updateNote);
router.delete('/:id', authController.authenticate, noteController.deleteNote);

module.exports = router;
