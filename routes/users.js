const bcrypt = require("bcrypt-nodejs");
const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();

const database = require("../config/database");

// Very secret secret
const secret = "Potato";

// Register new user
router.post("/register", (req, res) => {
  const { email, username, password, passwordConfirm } = req.body;
  const alerts = [];

  // Check required fields
  if (!email || !username || !password || !passwordConfirm) {
    alerts.push({ success: false, message: "Missing credentials." });
  }

  // Check if password is valid
  const validRegex = /(?=.*\d)(?=.*[a-z]).{8,}/g;
  if (!password.match(validRegex)) {
    alerts.push({
      success: false,
      message: "Password is missing requirements."
    });
  }

  // Check if passwords match
  if (password !== passwordConfirm) {
    alerts.push({ success: false, message: "Passwords do not match." });
  }

  //   Check if username or e-mail already exist
  database("users")
    .select()
    .then(userData => {
      if (userData.some(user => user.username === username)) {
        alerts.push({ success: false, message: "Username already in use." });
      }
      if (userData.some(user => user.email === email)) {
        alerts.push({ success: false, message: "Email already in use." });
      }

      // Return alerts if any
      if (alerts.length > 0) {
        res.status(400).json({ alerts });
      } else {
        // Generate salt and then hash password using it
        bcrypt.genSalt(10, (error, salt) => {
          bcrypt.hash(password, salt, null, (error, hash) => {
            if (error) throw error;

            // Transaction to insert login info and then user info
            database.transaction(trx => {
              return trx("login")
                .insert({
                  email: email,
                  hash: hash
                })
                .then(() => {
                  return trx("users")
                    .insert({
                      username: username,
                      email: email,
                      joined: new Date()
                    })
                    .catch(error => {
                      console.log("ERROR INSERTING INTO USERS", error);
                      alerts.push({
                        success: false,
                        message:
                          "Error registering user. Please try again later"
                      });
                      res.status(500).json({ alerts });
                    });
                })
                .then(() => {
                  trx.commit;
                  res.status(200).json({
                    success: true,
                    message: "Registration successful!"
                  });
                })
                .catch(error => {
                  trx.rollback;
                });
            });
          });
        });
      }
    })
    .catch(error => console.log(error));
});

// Authenticate user, return JWT, and redirect to dashboard
router.post("/login", (req, res) => {
  const { email, password } = req.body;
  const alerts = [];

  // Select user login records
  database("login")
    .select()
    .where("email", "=", email)
    .then(data => {
      // Match email
      if (data.length <= 0) {
        res
          .status(400)
          .json({ success: false, message: "Incorrect email or password." });
      } else {
        // Match password
        bcrypt.compare(password, data[0].hash, (error, isMatch) => {
          if (error) {
            res.status(500).json({
              success: false,
              message: "Internal error. Please try again."
            });
          }

          if (!isMatch) {
            res.status(400).json({
              success: false,
              message: "Incorrect email or password."
            });
          }
          // Issue JWT
          else {
            const payload = { email };
            const token = jwt.sign(payload, secret, {
              expiresIn: "1h"
            });
            res
              .status(200)
              .cookie("token", token, { httpOnly: true })
              .json({ success: true, message: "Successful login." });
          }
        });
      }
    });
});

// Clear login session, remove req,user, and redirect to main page

module.exports = router;
