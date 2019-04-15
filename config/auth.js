const ensureAuth = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(400).json({
    alerts: [
      {
        success: false,
        message: 'Please log in.'
      }
    ]
  });
};

module.exports = ensureAuth;
