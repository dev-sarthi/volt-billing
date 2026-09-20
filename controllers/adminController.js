const bcrypt = require('bcrypt');
const User = require('../models/User');
const Consumer = require('../models/Consumer');
const Meter = require('../models/Meter');
const TariffPlan = require('../models/TariffPlan');
const Bill = require('../models/Bill');
const billingService = require('../services/billingService');

const SALT_ROUNDS = 10;

/* ══════════════════════════════════════════════════════════════════════
   Dashboard
   ══════════════════════════════════════════════════════════════════════ */

/**
 * GET /admin/dashboard
 * Aggregation-backed metrics and Top Consumers list.
 */
exports.dashboard = async (req, res) => {
  try {
    // 0. Ensure all unpaid past-due bills are converted to overdue before aggregating
    await billingService.selfCorrectOverdueBills();

    // 1. Total Bills Generated & Paid/Unpaid/Overdue breakdowns
    // Using a single facet aggregation to get all basic stats in one query
    const statsResult = await Bill.aggregate([
      {
        $facet: {
          totalBills: [
            { $count: 'count' }
          ],
          statusStats: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
                amount: { $sum: '$totalAmount' }
              }
            }
          ],
          totalUnits: [
            {
              $lookup: {
                from: 'meterreadings',
                localField: 'meterReadingId',
                foreignField: '_id',
                as: 'reading'
              }
            },
            { $unwind: '$reading' },
            {
              $group: {
                _id: null,
                units: { $sum: '$reading.unitsConsumed' }
              }
            }
          ]
        }
      }
    ]);

    const stats = statsResult[0];
    
    const totalBills = stats.totalBills[0] ? stats.totalBills[0].count : 0;
    const totalUnits = stats.totalUnits[0] ? stats.totalUnits[0].units : 0;
    
    let paidCount = 0, paidAmount = 0;
    let unpaidCount = 0, unpaidAmount = 0;
    let overdueCount = 0;

    stats.statusStats.forEach(stat => {
      if (stat._id === 'paid') {
        paidCount = stat.count;
        paidAmount = stat.amount;
      } else if (stat._id === 'unpaid') {
        unpaidCount = stat.count;
        unpaidAmount = stat.amount;
      } else if (stat._id === 'overdue') {
        overdueCount = stat.count;
        unpaidCount += stat.count; // Overdue is a subset of unpaid money conceptually, but let's separate
        unpaidAmount += stat.amount;
      }
    });

    // 2. Top 5 consumers by total amount billed
    const topConsumers = await Bill.aggregate([
      {
        $group: {
          _id: '$consumerId',
          totalAmountBilled: { $sum: '$totalAmount' },
          billsCount: { $sum: 1 }
        }
      },
      { $sort: { totalAmountBilled: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'consumers',
          localField: '_id',
          foreignField: '_id',
          as: 'consumerDoc'
        }
      },
      { $unwind: '$consumerDoc' },
      {
        $lookup: {
          from: 'users',
          localField: 'consumerDoc.userId',
          foreignField: '_id',
          as: 'userDoc'
        }
      },
      { $unwind: '$userDoc' },
      {
        $project: {
          consumerId: '$consumerDoc.consumerId',
          name: '$userDoc.name',
          connectionType: '$consumerDoc.connectionType',
          totalAmountBilled: 1,
          billsCount: 1
        }
      }
    ]);

    res.render('admin/dashboard', {
      pageTitle: 'Dashboard',
      activePage: 'dashboard',
      stats: {
        totalBills,
        totalUnits,
        paidCount,
        paidAmount,
        unpaidCount,
        unpaidAmount,
        overdueCount
      },
      topConsumers
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    req.flash('error', 'Could not load dashboard statistics.');
    res.redirect('/admin/consumers');
  }
};

/* ══════════════════════════════════════════════════════════════════════
   Consumers
   ══════════════════════════════════════════════════════════════════════ */

/**
 * GET /admin/consumers
 * List all consumers with their user info and assigned meter.
 */
exports.listConsumers = async (req, res) => {
  try {
    const consumers = await Consumer.find()
      .populate('userId', 'name email')
      .sort({ _id: -1 })
      .lean();

    // Attach meter info for each consumer
    const consumerIds = consumers.map((c) => c._id);
    const meters = await Meter.find({
      consumerId: { $in: consumerIds },
      status: 'active',
    }).lean();

    const meterMap = {};
    meters.forEach((m) => {
      meterMap[m.consumerId.toString()] = m.meterNumber;
    });

    // Aggregate bill amounts
    const billsAgg = await Bill.aggregate([
      {
        $match: { consumerId: { $in: consumerIds } }
      },
      {
        $group: {
          _id: { consumerId: '$consumerId', status: '$status' },
          total: { $sum: '$totalAmount' }
        }
      }
    ]);

    const financialMap = {};
    billsAgg.forEach(b => {
      const cId = b._id.consumerId.toString();
      if (!financialMap[cId]) financialMap[cId] = { paid: 0, dues: 0 };
      if (b._id.status === 'paid') {
        financialMap[cId].paid += b.total;
      } else {
        financialMap[cId].dues += b.total;
      }
    });

    consumers.forEach((c) => {
      c.meterNumber = meterMap[c._id.toString()] || null;
      c.paidAmount = financialMap[c._id.toString()] ? financialMap[c._id.toString()].paid : 0;
      c.duesAmount = financialMap[c._id.toString()] ? financialMap[c._id.toString()].dues : 0;
    });

    res.render('admin/consumers/index', {
      activePage: 'consumers',
      pageTitle: 'Consumers',
      consumers,
      search: req.query.search || '',
    });
  } catch (err) {
    console.error('listConsumers error:', err);
    req.flash('error', 'Could not load consumers.');
    res.redirect('/admin/dashboard');
  }
};

/**
 * GET /admin/consumers/new
 * Render the add-consumer form.
 */
exports.newConsumerForm = (req, res) => {
  res.render('admin/consumers/new', {
    activePage: 'consumers',
    pageTitle: 'Add Consumer',
  });
};

/**
 * POST /admin/consumers
 * Create a User (role: consumer) + linked Consumer document.
 */
exports.createConsumer = async (req, res) => {
  try {
    const { name, email, password, connectionType, utilityType, address } = req.body;

    // Check duplicate email
    const existing = await User.findOne({ email: email?.toLowerCase().trim() });
    if (existing) {
      req.flash('error', 'A user with that email already exists.');
      return res.redirect('/admin/consumers/new');
    }

    // Create user
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({
      name,
      email,
      passwordHash,
      role: 'consumer',
    });

    // Create consumer profile
    await Consumer.create({
      userId: user._id,
      connectionType,
      utilityType,
      address,
    });

    req.flash('success', `Consumer "${name}" created successfully.`);
    res.redirect('/admin/consumers');
  } catch (err) {
    console.error('createConsumer error:', err);
    req.flash('error', 'Failed to create consumer. ' + (err.message || ''));
    res.redirect('/admin/consumers/new');
  }
};

/**
 * GET /admin/consumers/:id/edit
 * Render the edit-consumer form.
 */
exports.editConsumerForm = async (req, res) => {
  try {
    const consumer = await Consumer.findById(req.params.id)
      .populate('userId', 'name email')
      .lean();

    if (!consumer) {
      req.flash('error', 'Consumer not found.');
      return res.redirect('/admin/consumers');
    }

    res.render('admin/consumers/edit', {
      activePage: 'consumers',
      pageTitle: 'Edit Consumer',
      consumer,
    });
  } catch (err) {
    console.error('editConsumerForm error:', err);
    req.flash('error', 'Could not load consumer.');
    res.redirect('/admin/consumers');
  }
};

/**
 * POST /admin/consumers/:id
 * Update connectionType and address.
 */
exports.updateConsumer = async (req, res) => {
  try {
    const { connectionType, utilityType, address } = req.body;

    await Consumer.findByIdAndUpdate(req.params.id, {
      connectionType,
      utilityType,
      address,
    });

    req.flash('success', 'Consumer updated successfully.');
    res.redirect('/admin/consumers');
  } catch (err) {
    console.error('updateConsumer error:', err);
    req.flash('error', 'Failed to update consumer.');
    res.redirect('/admin/consumers');
  }
};

/**
 * POST /admin/consumers/:id/deactivate
 * Set consumer status to 'inactive'.
 */
exports.deactivateConsumer = async (req, res) => {
  try {
    await Consumer.findByIdAndUpdate(req.params.id, { status: 'inactive' });
    req.flash('success', 'Consumer deactivated.');
    res.redirect('/admin/consumers');
  } catch (err) {
    console.error('deactivateConsumer error:', err);
    req.flash('error', 'Failed to deactivate consumer.');
    res.redirect('/admin/consumers');
  }
};

/* ══════════════════════════════════════════════════════════════════════
   Meters
   ══════════════════════════════════════════════════════════════════════ */

/**
 * GET /admin/meters
 * List all meters with consumer info, plus data for the inline add form.
 */
exports.listMeters = async (req, res) => {
  try {
    const meters = await Meter.find()
      .populate({
        path: 'consumerId',
        populate: { path: 'userId', select: 'name' },
      })
      .sort({ _id: -1 })
      .lean();

    // Consumers who don't already have an active meter
    const activeMeters = await Meter.find({ status: 'active' }).lean();
    const consumerIdsWithMeter = new Set(
      activeMeters.map((m) => m.consumerId.toString())
    );

    const allConsumers = await Consumer.find({ status: 'active' })
      .populate('userId', 'name')
      .lean();

    const availableConsumers = allConsumers.filter(
      (c) => !consumerIdsWithMeter.has(c._id.toString())
    );

    res.render('admin/meters/index', {
      activePage: 'meters',
      pageTitle: 'Meters',
      meters,
      availableConsumers,
    });
  } catch (err) {
    console.error('listMeters error:', err);
    req.flash('error', 'Could not load meters.');
    res.redirect('/admin/dashboard');
  }
};

/**
 * POST /admin/meters
 * Create a meter. Enforces: one active meter per consumer.
 */
exports.createMeter = async (req, res) => {
  try {
    const { meterNumber, consumerId } = req.body;

    // Check if consumer already has an active meter
    const existingMeter = await Meter.findOne({
      consumerId,
      status: 'active',
    });

    if (existingMeter) {
      req.flash(
        'error',
        `This consumer already has an active meter (${existingMeter.meterNumber}). Deactivate it first.`
      );
      return res.redirect('/admin/meters');
    }

    await Meter.create({ meterNumber, consumerId });

    req.flash('success', `Meter "${meterNumber}" assigned successfully.`);
    res.redirect('/admin/meters');
  } catch (err) {
    console.error('createMeter error:', err);
    if (err.code === 11000) {
      req.flash('error', 'A meter with that number already exists.');
    } else {
      req.flash('error', 'Failed to create meter. ' + (err.message || ''));
    }
    res.redirect('/admin/meters');
  }
};

/* ══════════════════════════════════════════════════════════════════════
   Tariffs
   ══════════════════════════════════════════════════════════════════════ */

/**
 * GET /admin/tariffs
 * Show domestic and commercial plans side by side.
 */
exports.listTariffs = async (req, res) => {
  try {
    const plans = await TariffPlan.find().sort({ utilityType: 1, connectionType: 1 }).lean();

    // Group by connectionType and utilityType for easy template access
    const electricityDomestic = plans.find((p) => p.connectionType === 'domestic' && p.utilityType === 'electricity') || null;
    const electricityCommercial = plans.find((p) => p.connectionType === 'commercial' && p.utilityType === 'electricity') || null;
    const waterDomestic = plans.find((p) => p.connectionType === 'domestic' && p.utilityType === 'water') || null;
    const waterCommercial = plans.find((p) => p.connectionType === 'commercial' && p.utilityType === 'water') || null;

    res.render('admin/tariffs/index', {
      activePage: 'tariffs',
      pageTitle: 'Tariff Plans',
      plansToDisplay: [electricityDomestic, electricityCommercial, waterDomestic, waterCommercial],
    });
  } catch (err) {
    console.error('listTariffs error:', err);
    req.flash('error', 'Could not load tariff plans.');
    res.redirect('/admin/dashboard');
  }
};

/**
 * POST /admin/tariffs/:id
 * Validate slab contiguity then update the plan.
 *
 * Expected body shape (from the dynamic form):
 *   slabs[0][minUnits], slabs[0][maxUnits], slabs[0][ratePerUnit], …
 *   fixedCharge
 */
exports.updateTariff = async (req, res) => {
  try {
    const { fixedCharge } = req.body;
    let rawSlabs = req.body.slabs || [];

    // Normalise: if only one slab, Express may parse it as an object
    if (!Array.isArray(rawSlabs)) rawSlabs = [rawSlabs];

    // Parse to numbers
    const slabs = rawSlabs.map((s) => ({
      minUnits: Number(s.minUnits),
      maxUnits: Number(s.maxUnits),
      ratePerUnit: Number(s.ratePerUnit),
    }));

    // ── Validation ──────────────────────────────────────────────────

    if (slabs.length === 0) {
      req.flash('error', 'At least one slab is required.');
      return res.redirect('/admin/tariffs');
    }

    for (let i = 0; i < slabs.length; i++) {
      const s = slabs[i];
      const label = `Slab ${i + 1} (${s.minUnits}–${s.maxUnits})`;

      // Basic number checks
      if (isNaN(s.minUnits) || isNaN(s.maxUnits) || isNaN(s.ratePerUnit)) {
        req.flash('error', `${label}: all fields must be numbers.`);
        return res.redirect('/admin/tariffs');
      }
      if (s.minUnits < 0 || s.maxUnits < 0 || s.ratePerUnit < 0) {
        req.flash('error', `${label}: values cannot be negative.`);
        return res.redirect('/admin/tariffs');
      }
      if (s.maxUnits <= s.minUnits) {
        req.flash('error', `${label}: maxUnits (${s.maxUnits}) must be greater than minUnits (${s.minUnits}).`);
        return res.redirect('/admin/tariffs');
      }

      // First slab must start at 0
      if (i === 0 && s.minUnits !== 0) {
        req.flash('error', `${label}: the first slab must start at 0 units, but starts at ${s.minUnits}.`);
        return res.redirect('/admin/tariffs');
      }

      // Subsequent slabs must be contiguous
      if (i > 0) {
        const prev = slabs[i - 1];
        const expected = prev.maxUnits + 1;
        if (s.minUnits !== expected) {
          req.flash(
            'error',
            `${label}: minUnits should be ${expected} (previous slab ends at ${prev.maxUnits}), but is ${s.minUnits}.`
          );
          return res.redirect('/admin/tariffs');
        }
      }
    }

    if (isNaN(Number(fixedCharge)) || Number(fixedCharge) < 0) {
      req.flash('error', 'Fixed charge must be a non-negative number.');
      return res.redirect('/admin/tariffs');
    }

    // ── Save ────────────────────────────────────────────────────────

    await TariffPlan.findByIdAndUpdate(req.params.id, {
      slabs,
      fixedCharge: Number(fixedCharge),
      active: true,
    });

    req.flash('success', 'Tariff plan updated successfully.');
    res.redirect('/admin/tariffs');
  } catch (err) {
    console.error('updateTariff error:', err);
    req.flash('error', 'Failed to update tariff plan. ' + (err.message || ''));
    res.redirect('/admin/tariffs');
  }
};

/* ══════════════════════════════════════════════════════════════════════
   Applications
   ══════════════════════════════════════════════════════════════════════ */

const Application = require('../models/Application');
const crypto = require('crypto');

exports.listApplications = async (req, res) => {
  try {
    const applications = await Application.find()
      .sort({ createdAt: -1 })
      .lean();

    res.render('admin/applications/index', {
      activePage: 'applications',
      pageTitle: 'Applications',
      applications,
    });
  } catch (err) {
    console.error('listApplications error:', err);
    req.flash('error', 'Could not load applications.');
    res.redirect('/admin/dashboard');
  }
};

exports.reviewApplication = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id).lean();
    if (!application) {
      req.flash('error', 'Application not found.');
      return res.redirect('/admin/applications');
    }
    res.render('admin/applications/review', {
      activePage: 'applications',
      pageTitle: 'Review Application',
      application,
    });
  } catch (err) {
    console.error('reviewApplication error:', err);
    req.flash('error', 'Could not load application.');
    res.redirect('/admin/applications');
  }
};

exports.approveApplication = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      req.flash('error', 'Application not found.');
      return res.redirect('/admin/applications');
    }
    
    if (application.status !== 'pending') {
      req.flash('error', 'Application is already processed.');
      return res.redirect('/admin/applications');
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: application.email });
    if (existingUser) {
      req.flash('error', 'A user with this email already exists.');
      return res.redirect(`/admin/applications/${application._id}`);
    }

    // Generate random password
    const password = crypto.randomBytes(4).toString('hex'); // 8 char password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create User
    const user = await User.create({
      name: application.applicantName,
      email: application.email,
      passwordHash: passwordHash,
      role: 'consumer'
    });

    // Create Consumer
    await Consumer.create({
      userId: user._id,
      connectionType: application.connectionType,
      utilityType: application.utilityType || 'electricity',
      address: application.address
    });

    // Update Application
    application.status = 'approved';
    application.reviewerId = req.session.userId;
    await application.save();

    req.flash('success', `Application approved! User created with password: ${password}. Please communicate this to the consumer.`);
    res.redirect('/admin/applications');
  } catch (err) {
    console.error('approveApplication error:', err);
    req.flash('error', 'Failed to approve application.');
    res.redirect(`/admin/applications/${req.params.id}`);
  }
};

exports.rejectApplication = async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) {
      req.flash('error', 'Application not found.');
      return res.redirect('/admin/applications');
    }

    application.status = 'rejected';
    application.reviewerId = req.session.userId;
    await application.save();

    req.flash('success', 'Application rejected.');
    res.redirect('/admin/applications');
  } catch (err) {
    console.error('rejectApplication error:', err);
    req.flash('error', 'Failed to reject application.');
    res.redirect(`/admin/applications/${req.params.id}`);
  }
};
