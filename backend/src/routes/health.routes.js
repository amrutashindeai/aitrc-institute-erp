const express = require('express');
const mongoose = require('mongoose');
const { databaseState } = require('../config/database');

const router = express.Router();

router.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    data: { status: 'ok', service: 'institute-erp-api', timestamp: new Date().toISOString() }
  });
});

router.get('/ready', (_req, res) => {
  const database = databaseState();
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({
    success: ready,
    data: { status: ready ? 'ready' : 'not_ready', database }
  });
});

module.exports = router;
