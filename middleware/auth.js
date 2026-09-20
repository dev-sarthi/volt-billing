/**
 * Authentication & authorisation middleware.
 */

/**
 * Redirects unauthenticated users to the login page.
 */
function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) return next();
  req.flash('error', 'Please log in to continue.');
  return res.redirect('/login');
}

/**
 * Restricts access to one or more roles.
 *
 * Usage:
 *   requireRole('admin')
 *   requireRole(['admin', 'reader'])
 */
function requireRole(roles) {
  // Normalise to array so both string and array work
  const allowed = Array.isArray(roles) ? roles : [roles];

  return (req, res, next) => {
    if (!req.session || !req.session.role) {
      req.flash('error', 'Please log in to continue.');
      return res.redirect('/login');
    }

    if (!allowed.includes(req.session.role)) {
      return res.status(403).render('errors/403', {
        message: 'You do not have permission to access this page.',
      });
    }

    next();
  };
}

module.exports = { isAuthenticated, requireRole };
