const bcrypt = require("bcrypt-nodejs");
const express = require("express");
const router = express.Router();

const database = require("../config/database");

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

      // Return errors if any
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

module.exports = router;
