const express = require('express');
const authenticate = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { list } = require('../controllers/audit.controller');
const router = express.Router();
router.use(authenticate, authorize('DIRECTOR', 'PRINCIPAL', 'HOD', 'COMMITTEE_HEAD', 'ADMIN'));
router.get('/', list);
module.exports = router;
