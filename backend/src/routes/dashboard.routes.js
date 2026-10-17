const express = require('express');
const authenticate = require('../middleware/authenticate');
const D = require('../controllers/dashboard.controller');
const router = express.Router();
router.use(authenticate);
router.get('/me', D.me);
router.get('/institution', D.institution);
router.get('/departments/:id', D.departmentDashboard);
module.exports = router;
