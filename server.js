require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const methodOverride = require('method-override');
const path = require('path');

const app = express();

/* ------------------------------------------------------------------ */
/*  Middleware                                                         */
/* ------------------------------------------------------------------ */

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Method override (?_method=PATCH etc.)
app.use(methodOverride('_method'));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

/* ------------------------------------------------------------------ */
/*  Database                                                          */
/* ------------------------------------------------------------------ */

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/billing_system';

mongoose
  .connect(MONGO_URI)
  .then(() => console.log('✓ MongoDB connected'))
  .catch((err) => {
    console.error('✗ MongoDB connection error:', err.message);
    process.exit(1);
  });

/* ------------------------------------------------------------------ */
/*  Sessions                                                          */
/* ------------------------------------------------------------------ */

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'fallback_dev_secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: MONGO_URI,
      collectionName: 'sessions',
      ttl: 60 * 60 * 24, // 1 day
    }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      httpOnly: true,
    },
  })
);

// Flash messages
app.use(flash());

// Make flash messages available in all views
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  next();
});

/* ------------------------------------------------------------------ */
/*  Routes                                                            */
/* ------------------------------------------------------------------ */

// Make session info available in all views
app.use((req, res, next) => {
  res.locals.currentUser = req.session.userId || null;
  res.locals.currentRole = req.session.role || null;
  res.locals.currentUserName = req.session.userName || null;
  next();
});

// Public routes (Apply for connection, etc.)
app.use('/', require('./routes/public'));

// Auth (login / logout)
app.use('/', require('./routes/auth'));

// Role-specific route groups
app.use('/admin', require('./routes/admin'));
app.use('/reader', require('./routes/reader'));
app.use('/consumer', require('./routes/consumer'));

// Placeholder home route — confirms server + DB are working
app.get('/', (req, res) => {
  const dbState = mongoose.connection.readyState; // 1 = connected
  res.render('index', {
    dbConnected: dbState === 1,
  });
});

/* ------------------------------------------------------------------ */
/*  Start server                                                      */
/* ------------------------------------------------------------------ */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✓ Server running on http://localhost:${PORT}`);
});
