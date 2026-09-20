const express = require('express');
const { isAuthenticated, requireRole } = require('../middleware/auth');
const readerController = require('../controllers/readerController');

const router = express.Router();

// All reader routes require authentication + reader role
router.use(isAuthenticated, requireRole('reader'));

/* ── Dashboard ───────────────────────────────────────────────────── */

router.get('/dashboard', readerController.dashboard);

/* ── Readings ────────────────────────────────────────────────────── */

router.get('/readings', readerController.listReadings);
router.get('/readings/new', readerController.newReadingForm);
router.post('/readings', readerController.createReading);

module.exports = router;
