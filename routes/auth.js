const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');

const router = express.Router();

/* ── Role → dashboard mapping ────────────────────────────────────── */

const DASHBOARD_BY_ROLE = {
  admin: '/admin/dashboard',
  reader: '/reader/dashboard',
  consumer: '/consumer/dashboard',
};

/* ── GET /login ──────────────────────────────────────────────────── */

router.get('/login', (req, res) => {
  // If already logged in, send straight to dashboard
  if (req.session && req.session.userId) {
    return res.redirect(DASHBOARD_BY_ROLE[req.session.role] || '/');
  }
  res.render('auth/login');
});

/* ── POST /login ─────────────────────────────────────────────────── */

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Find user
    const user = await User.findOne({ email: email?.toLowerCase().trim() });
    if (!user) {
      req.flash('error', 'Invalid email or password.');
      return res.redirect('/login');
    }

    // 2. Compare password
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      req.flash('error', 'Invalid email or password.');
      return res.redirect('/login');
    }

    // 3. Store session
    req.session.userId = user._id;
    req.session.role = user.role;
    req.session.userName = user.name;

    // 4. Redirect to role-specific dashboard
    const dest = DASHBOARD_BY_ROLE[user.role] || '/';
    return res.redirect(dest);
  } catch (err) {
    console.error('Login error:', err);
    req.flash('error', 'Something went wrong. Please try again.');
    return res.redirect('/login');
  }
});

/* ── POST /logout ────────────────────────────────────────────────── */

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Session destroy error:', err);
    res.redirect('/login');
  });
});

module.exports = router;
