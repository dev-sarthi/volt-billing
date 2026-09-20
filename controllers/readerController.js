const Meter = require('../models/Meter');
const MeterReading = require('../models/MeterReading');
const TariffPlan = require('../models/TariffPlan');
const Bill = require('../models/Bill');
const { computeBill } = require('../services/billingService');

/**
 * Return the current billing month as "YYYY-MM".
 */
function currentBillingMonth() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/* ══════════════════════════════════════════════════════════════════════
   Dashboard
   ══════════════════════════════════════════════════════════════════════ */

/**
 * GET /reader/dashboard
 * List active meters with "Enter Reading" buttons.
 */
exports.dashboard = async (req, res) => {
  try {
    const billingMonth = currentBillingMonth();

    const meters = await Meter.find({ status: 'active' })
      .populate({
        path: 'consumerId',
        populate: { path: 'userId', select: 'name' },
      })
      .sort({ meterNumber: 1 })
      .lean();

    // Check which meters already have a reading this month
    const meterIds = meters.map((m) => m._id);
    const existingReadings = await MeterReading.find({
      meterId: { $in: meterIds },
      billingMonth,
    }).lean();
    const doneSet = new Set(existingReadings.map((r) => r.meterId.toString()));

    meters.forEach((m) => {
      m.alreadyRead = doneSet.has(m._id.toString());
    });

    res.render('reader/dashboard', {
      pageTitle: 'Dashboard',
      activePage: 'dashboard',
      billingMonth,
      meters,
    });
  } catch (err) {
    console.error('reader dashboard error:', err);
    req.flash('error', 'Could not load meters.');
    res.redirect('/');
  }
};

/* ══════════════════════════════════════════════════════════════════════
   New Reading Form
   ══════════════════════════════════════════════════════════════════════ */

/**
 * GET /reader/readings/new?meterId=...
 * Single-field form with context info.
 */
exports.newReadingForm = async (req, res) => {
  try {
    const meter = await Meter.findById(req.query.meterId)
      .populate({
        path: 'consumerId',
        populate: { path: 'userId', select: 'name' },
      })
      .lean();

    if (!meter) {
      req.flash('error', 'Meter not found.');
      return res.redirect('/reader/dashboard');
    }

    const billingMonth = currentBillingMonth();

    // Check if already submitted this month
    const existing = await MeterReading.findOne({
      meterId: meter._id,
      billingMonth,
    });
    if (existing) {
      req.flash('error', `Reading for ${meter.meterNumber} already submitted for ${billingMonth}.`);
      return res.redirect('/reader/dashboard');
    }

    // Get previous reading
    const lastReading = await MeterReading.findOne({ meterId: meter._id })
      .sort({ billingMonth: -1 })
      .lean();

    res.render('reader/readings/new', {
      pageTitle: 'Enter Reading',
      activePage: 'dashboard',
      meter,
      billingMonth,
      previousReading: lastReading ? lastReading.currentReading : null,
      error: null,
      currentReadingValue: '',
    });
  } catch (err) {
    console.error('newReadingForm error:', err);
    req.flash('error', 'Could not load reading form.');
    res.redirect('/reader/dashboard');
  }
};

/* ══════════════════════════════════════════════════════════════════════
   Submit Reading
   ══════════════════════════════════════════════════════════════════════ */

/**
 * POST /reader/readings
 * Validate and save. Re-renders form with inline error on failure.
 */
exports.createReading = async (req, res) => {
  try {
    const { meterId, currentReading: rawCurrent } = req.body;
    const billingMonth = currentBillingMonth();

    // Load meter for re-rendering on error
    const meter = await Meter.findById(meterId)
      .populate({
        path: 'consumerId',
        populate: { path: 'userId', select: 'name' },
      })
      .lean();

    if (!meter) {
      req.flash('error', 'Meter not found.');
      return res.redirect('/reader/dashboard');
    }

    // Previous reading
    const lastReading = await MeterReading.findOne({ meterId })
      .sort({ billingMonth: -1 })
      .lean();
    const previousReading = lastReading ? lastReading.currentReading : 0;

    // Helper: re-render form with inline error
    const renderError = (errorMsg) => {
      return res.render('reader/readings/new', {
        pageTitle: 'Enter Reading',
        activePage: 'dashboard',
        meter,
        billingMonth,
        previousReading: lastReading ? lastReading.currentReading : null,
        error: errorMsg,
        currentReadingValue: rawCurrent,
      });
    };

    // ── Validations ───────────────────────────────────────────────

    const currentVal = Number(rawCurrent);

    if (isNaN(currentVal) || rawCurrent === '') {
      return renderError('Please enter a valid number for the current reading.');
    }

    if (currentVal < 0) {
      return renderError('Current reading cannot be negative.');
    }

    if (currentVal < previousReading) {
      return renderError(
        `Current reading (${currentVal}) cannot be less than the previous reading (${previousReading}). ` +
        'Please check the meter and try again.'
      );
    }

    // Check duplicate
    const duplicate = await MeterReading.findOne({ meterId, billingMonth });
    if (duplicate) {
      return renderError(
        `A reading for this meter has already been submitted for ${billingMonth}. ` +
        'Each meter can only have one reading per billing month.'
      );
    }

    // Check for active tariff plan
    const tariffPlan = await TariffPlan.findOne({
      connectionType: meter.consumerId.connectionType,
      utilityType: meter.consumerId.utilityType || 'electricity',
      active: true
    }).lean();

    if (!tariffPlan) {
      return renderError(
        `No active tariff plan found for ${meter.consumerId.connectionType} ${meter.consumerId.utilityType || 'electricity'} connections. ` +
        'Please ask an administrator to configure a tariff plan before entering readings.'
      );
    }

    // ── Save ──────────────────────────────────────────────────────

    const unitsConsumed = currentVal - previousReading;

    // Compute bill
    const { usageCharge, fixedCharge, totalAmount } = computeBill(unitsConsumed, tariffPlan);

    const reading = await MeterReading.create({
      meterId,
      billingMonth,
      previousReading,
      currentReading: currentVal,
      unitsConsumed,
      enteredBy: req.session.userId,
    });

    // Create Bill document
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 15);

    const bill = await Bill.create({
      consumerId: meter.consumerId._id,
      meterReadingId: reading._id,
      billingMonth,
      usageCharge,
      fixedCharge,
      totalAmount,
      dueDate,
      status: 'unpaid'
    });

    res.render('reader/readings/confirm', {
      pageTitle: 'Reading Saved',
      activePage: 'dashboard',
      meter,
      billingMonth,
      reading: reading.toObject(),
      bill: bill.toObject(),
    });
  } catch (err) {
    console.error('createReading error:', err);
    // Duplicate key from compound index
    if (err.code === 11000) {
      req.flash('error', 'This reading was already submitted.');
      return res.redirect('/reader/dashboard');
    }
    req.flash('error', 'Failed to save reading.');
    res.redirect('/reader/dashboard');
  }
};

/* ══════════════════════════════════════════════════════════════════════
   Past Readings
   ══════════════════════════════════════════════════════════════════════ */

/**
 * GET /reader/readings
 * This reader's own submissions, newest first.
 */
exports.listReadings = async (req, res) => {
  try {
    const readings = await MeterReading.find({ enteredBy: req.session.userId })
      .populate({
        path: 'meterId',
        select: 'meterNumber',
      })
      .sort({ createdAt: -1 })
      .lean();

    res.render('reader/readings/index', {
      pageTitle: 'My Readings',
      activePage: 'readings',
      readings,
    });
  } catch (err) {
    console.error('listReadings error:', err);
    req.flash('error', 'Could not load readings.');
    res.redirect('/reader/dashboard');
  }
};
