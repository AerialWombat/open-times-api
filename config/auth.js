const jwt = require('jsonwebtoken');

// Very secret secret
const secret = 'Potato';

const ensureAuth = (req, res, next) => {
  // Check for token in request body, query string, headers, and cookies
  const token =
    req.body.token ||
    req.query.token ||
    req.headers['x-access-token'] ||
    req.cookies.token;

  if (!token) {
    res
      .status(400)
      .json({ success: false, message: 'Unauthorized. No token provided' });
    console.log('No token!', token);
  } else {
    jwt.verify(token, secret, (error, decoded) => {
      if (error) {
        res
          .status(400)
          .json({ success: false, message: 'Unauthorized. Invalid Token.' });
      } else {
        console.log('Token!');
        req.email = decoded.email;
        next();
      }
    });
  }
};

module.exports = ensureAuth;
