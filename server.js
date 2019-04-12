const cookieParser = require('cookie-parser');
const cors = require('cors');
const express = require('express');

const ensureAuth = require('./config/auth');

const app = express();

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

// Routes
app.use('/api/users', require('./routes/users.js'));

app.get('/api/checkToken', ensureAuth, (req, res) => {
  res.status(200).json('Woo');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('Open Times API running...');
});
