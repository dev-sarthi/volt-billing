const express = require('express');
const { isAuthenticated, requireRole } = require('../middleware/auth');
const consumerController = require('../controllers/consumerController');

const router = express.Router();

// All consumer routes require authentication + consumer role
router.use(isAuthenticated, requireRole('consumer'));

// Apply strict ownership validation on all consumer routes
router.use(consumerController.requireOwnership);

/* ── Dashboard ───────────────────────────────────────────────────── */
router.get('/dashboard', consumerController.dashboard);

/* ── Bills ───────────────────────────────────────────────────────── */
router.get('/bills', consumerController.listBills);
router.get('/bills/:id', consumerController.billDetail);
router.post('/bills/:id/pay', consumerController.payBill);

/* ── Consumption ─────────────────────────────────────────────────── */
router.get('/consumption', consumerController.consumptionHistory);

module.exports = router;
