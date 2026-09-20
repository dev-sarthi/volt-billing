const express = require('express');
const { isAuthenticated, requireRole } = require('../middleware/auth');
const adminController = require('../controllers/adminController');
const Consumer = require('../models/Consumer');
const Meter = require('../models/Meter');
const Bill = require('../models/Bill');

const router = express.Router();

// All admin routes require authentication + admin role
router.use(isAuthenticated, requireRole('admin'));

/* ── Dashboard ───────────────────────────────────────────────────── */

router.get('/dashboard', adminController.dashboard);

/* ── Consumers ───────────────────────────────────────────────────── */

router.get('/consumers', adminController.listConsumers);
router.get('/consumers/new', adminController.newConsumerForm);
router.post('/consumers', adminController.createConsumer);
router.get('/consumers/:id/edit', adminController.editConsumerForm);
router.post('/consumers/:id', adminController.updateConsumer);
router.post('/consumers/:id/deactivate', adminController.deactivateConsumer);

/* ── Meters ──────────────────────────────────────────────────────── */

router.get('/meters', adminController.listMeters);
router.post('/meters', adminController.createMeter);

/* ── Tariffs ─────────────────────────────────────────────────────── */

router.get('/tariffs', adminController.listTariffs);
router.post('/tariffs/:id', adminController.updateTariff);

/* ── Applications ────────────────────────────────────────────────── */

router.get('/applications', adminController.listApplications);
router.get('/applications/:id', adminController.reviewApplication);
router.post('/applications/:id/approve', adminController.approveApplication);
router.post('/applications/:id/reject', adminController.rejectApplication);

module.exports = router;

