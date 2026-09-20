const Consumer = require('../models/Consumer');
const Bill = require('../models/Bill');
const MeterReading = require('../models/MeterReading');

/**
 * Middleware: Verify the logged-in user owns the requested Consumer/Bill/Reading resource.
 * Checks req.session.userId against the relevant document.
 */
exports.requireOwnership = async (req, res, next) => {
  try {
    // Find the Consumer document linked to the logged-in User
    const consumerObj = await Consumer.findOne({ userId: req.session.userId });
    if (!consumerObj) {
      req.flash('error', 'Consumer profile not found.');
      return res.redirect('/login');
    }
    
    // Attach the consumer ID to the request for easy access in handlers
    req.consumerId = consumerObj._id;

    // Check ownership for specific resources if ID is in params
    if (req.params.id) {
      // It's a bill route
      if (req.originalUrl.includes('/bills')) {
        const bill = await Bill.findById(req.params.id);
        if (!bill || bill.consumerId.toString() !== req.consumerId.toString()) {
          return res.status(403).send('Forbidden: You do not have permission to access this bill.');
        }
      }
      // Can add reading checks here if needed in future
    }

    // Auto-correct any overdue bills before rendering any consumer page
    await require('../services/billingService').selfCorrectOverdueBills({ consumerId: req.consumerId });

    next();
  } catch (err) {
    console.error('requireOwnership error:', err);
    res.status(500).send('Internal Server Error');
  }
};

/* ══════════════════════════════════════════════════════════════════════
   Dashboard
   ══════════════════════════════════════════════════════════════════════ */

exports.dashboard = async (req, res) => {
  try {
    // Get latest bill
    const latestBill = await Bill.findOne({ consumerId: req.consumerId })
      .sort({ createdAt: -1 })
      .lean();

    // Get last 3 bills for context
    const recentBills = await Bill.find({ consumerId: req.consumerId })
      .sort({ createdAt: -1 })
      .limit(3)
      .lean();

    res.render('consumer/dashboard', {
      pageTitle: 'My Dashboard',
      activePage: 'dashboard',
      latestBill,
      recentBills
    });
  } catch (err) {
    console.error('Consumer dashboard error:', err);
    req.flash('error', 'Could not load dashboard.');
    res.redirect('/');
  }
};

/* ══════════════════════════════════════════════════════════════════════
   Bills
   ══════════════════════════════════════════════════════════════════════ */

exports.listBills = async (req, res) => {
  try {
    const bills = await Bill.find({ consumerId: req.consumerId })
      .populate('meterReadingId')
      .sort({ createdAt: -1 })
      .lean();

    res.render('consumer/bills/index', {
      pageTitle: 'My Bills',
      activePage: 'bills',
      bills
    });
  } catch (err) {
    console.error('listBills error:', err);
    req.flash('error', 'Could not load bills.');
    res.redirect('/consumer/dashboard');
  }
};

exports.billDetail = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id)
      .populate('meterReadingId')
      .lean();
      
    // Note: requireOwnership middleware already confirmed ownership
    
    res.render('consumer/bills/detail', {
      pageTitle: `Bill for ${bill.billingMonth}`,
      activePage: 'bills',
      bill
    });
  } catch (err) {
    console.error('billDetail error:', err);
    req.flash('error', 'Could not load bill details.');
    res.redirect('/consumer/bills');
  }
};

exports.payBill = async (req, res) => {
  try {
    // Note: requireOwnership middleware already confirmed ownership of req.params.id
    
    const bill = await Bill.findByIdAndUpdate(req.params.id, {
      status: 'paid',
      paidDate: new Date()
    });

    req.flash('success', `Bill for ${bill.billingMonth} has been paid successfully.`);
    res.redirect('/consumer/bills/' + req.params.id);
  } catch (err) {
    console.error('payBill error:', err);
    req.flash('error', 'Payment failed.');
    res.redirect('/consumer/bills/' + req.params.id);
  }
};

/* ══════════════════════════════════════════════════════════════════════
   Consumption History
   ══════════════════════════════════════════════════════════════════════ */

exports.consumptionHistory = async (req, res) => {
  try {
    // Get all meter readings for this consumer. 
    // We need to look up their meter(s) first.
    const meters = await require('../models/Meter').find({ consumerId: req.consumerId });
    const meterIds = meters.map(m => m._id);

    const readings = await MeterReading.find({ meterId: { $in: meterIds } })
      .sort({ createdAt: -1 })
      .lean();

    res.render('consumer/consumption', {
      pageTitle: 'Consumption History',
      activePage: 'consumption',
      readings
    });
  } catch (err) {
    console.error('consumptionHistory error:', err);
    req.flash('error', 'Could not load consumption history.');
    res.redirect('/consumer/dashboard');
  }
};
