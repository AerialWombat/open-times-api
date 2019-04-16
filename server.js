require('dotenv').config();
const cookieParser = require('cookie-parser');
const cors = require('cors');
const express = require('express');
const passport = require('passport');
const session = require('express-session');

const ensureAuth = require('./config/auth');

const app = express();

// Passport config
require('./config/passport')(passport);

// CORS and Bodyparser
app.use(
  cors({
    origin: 'http://localhost:3000',
    credentials: true
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Express session
app.use(
  session({
    secret: process.env.SECRET_KEY,
    resave: true,
    saveUninitialized: true
  })
);

//Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/api/users', require('./routes/users.js'));

// Ensure authentication route
app.get('/api/checkAuth', ensureAuth, (req, res) => {
  res.status(200).json('User is authenticated.');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('Login/Registration API running...');
});
