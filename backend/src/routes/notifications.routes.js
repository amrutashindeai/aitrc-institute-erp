const express = require('express');
const authenticate = require('../middleware/authenticate');
const controller = require('../controllers/notifications.controller');
const router = express.Router();
router.use(authenticate);
router.get('/', controller.list);
router.patch('/:id/read', controller.markRead);
router.post('/read-all', controller.readAll);
module.exports = router;
