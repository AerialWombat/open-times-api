const bcrypt = require('bcrypt-nodejs');
const express = require('express');
const passport = require('passport');
const router = express.Router();

const database = require('../config/database');

// Register new user
router.post('/register', (req, res) => {
  const { email, username, password, passwordConfirm } = req.body;
  const alerts = [];

  // Check if required fields exist
  if (!email || !username || !password || !passwordConfirm) {
    alerts.push({ success: false, message: 'Missing credentials.' });
  }

  // Check if password is valid
  const validRegex = /(?=.*\d)(?=.*[a-z]).{8,}/g;
  if (!password.match(validRegex)) {
    alerts.push({
      success: false,
      message: 'Password is missing requirements.'
    });
  }

  // Check if passwords match
  if (password !== passwordConfirm) {
    alerts.push({ success: false, message: 'Passwords do not match.' });
  }

  // Check if username or e-mail already exist
  database('users')
    .select()
    .then(userRecords => {
      if (userRecords.some(user => user.username === username)) {
        alerts.push({ success: false, message: 'Username already in use.' });
      }
      if (userRecords.some(user => user.email === email)) {
        alerts.push({ success: false, message: 'Email already in use.' });
      }

      // Send unsuccessful with response alerts if any
      if (alerts.length > 0) {
        res.status(400).json({ alerts });
      } else {
        // Generate salt and then hash password using it
        bcrypt.genSalt(10, (error, salt) => {
          bcrypt.hash(password, salt, null, (error, hash) => {
            if (error) {
              res.status(500).json({
                alerts: [
                  {
                    success: false,
                    message: 'Internal error. Please try again.'
                  }
                ]
              });
            }

            // Insert new user info
            database('users')
              .insert({
                email: email,
                password: hash,
                username: username,
                email: email,
                joined: new Date()
              })
              .then(() => {
                res.status(200).send('Successful registration!');
              })
              .catch(error => {
                console.log('Error inserting into USERS.', error);
                alerts.push({
                  success: false,
                  message: 'Error registering user. Please try again later.'
                });
                res.status(500).json({ alerts });
              });
          });
        });
      }
    })
    .catch(error => console.log(error));
});

// Authenticate user for login
router.post('/login', (req, res, next) => {
  passport.authenticate('local', (error, user, info) => {
    if (error) {
      res.status(500).json({
        alerts: [
          {
            success: false,
            message: 'Internal error. Please try again.'
          }
        ]
      });
    } else if (!user) {
      // If no user is returned from authentication
      res.status(400).json({
        alerts: [
          {
            success: false,
            message: 'Incorrect email or password.'
          }
        ]
      });
    } else {
      // On successful authentication
      req.login(user, error => {
        if (error) {
          return next(error);
        }
      });
      res.status(200).json({
        alerts: [
          {
            success: true,
            message: 'Login successful!'
          }
        ]
      });
    }
  })(req, res, next);
});

// Change password route
router.put('/change-password', (req, res) => {
  const { currentPassword, newPassword, newPasswordConfirm } = req.body;
  let id;
  const alerts = [];

  // Check if required fields exist
  if (!currentPassword || !newPassword || !newPasswordConfirm) {
    alerts.push({ success: false, message: 'Missing fields.' });
  }

  // Check if new password is valid
  const validRegex = /(?=.*\d)(?=.*[a-z]).{8,}/g;
  if (!newPassword.match(validRegex)) {
    alerts.push({
      success: false,
      message: 'Password is missing requirements.'
    });
  }

  // Check if new passwords match
  if (newPassword !== newPasswordConfirm) {
    alerts.push({ success: false, message: 'Passwords do not match.' });
  }

  // Check if logged in/authenticated
  if (!req.session.passport) {
    alerts.push({ success: false, message: 'You are not logged in.' });
  } else {
    id = req.session.passport.user;
  }

  // Send unsuccessful with response alerts if any
  if (alerts.length > 0) {
    res.status(400).json({ alerts });
  } else {
    // Select matching user id from database
    database('users')
      .select()
      .where({ id: id })
      .then(users => {
        // Match user
        if (users.length <= 0) {
          res.status(400).json({
            alerts: [
              {
                success: false,
                message: 'User does not exist.'
              }
            ]
          });
        } else {
          // Match password
          bcrypt.compare(
            currentPassword,
            users[0].password,
            (error, isMatch) => {
              if (error) {
                res.status(500).json({
                  alerts: [
                    {
                      success: false,
                      message: 'Internal error. Please try again.'
                    }
                  ]
                });
              }
              if (!isMatch) {
                res.status(400).json({
                  alerts: [
                    {
                      success: false,
                      message: 'Password is incorrect.'
                    }
                  ]
                });
              } else {
                // On match, hash new password
                bcrypt.genSalt(10, (error, salt) => {
                  bcrypt.hash(newPassword, salt, null, (error, hash) => {
                    if (error) {
                      res.status(500).json({
                        alerts: [
                          {
                            success: false,
                            message: 'Internal error. Please try again.'
                          }
                        ]
                      });
                    }

                    // Update database with new, hashed password
                    database('users')
                      .update({ password: hash })
                      .where({ id: id })
                      .then(() => {
                        res.status(200).json({
                          alerts: [
                            {
                              success: true,
                              message: 'Password successfully changed!'
                            }
                          ]
                        });
                      })
                      .catch(error => {
                        console.log('Error updating password in USERS.', error);
                        alerts.push({
                          success: false,
                          message:
                            'Error changing password. Please try again later.'
                        });
                        res.status(500).json({ alerts });
                      });
                  });
                });
              }
            }
          );
        }
      });
  }
});

// Delete account route
router.delete('/delete-account', (req, res) => {
  const { deletePassword } = req.body;
  let id;
  let username;
  let groups;
  const alerts = [];

  // Check if logged in/authenticated
  if (!req.user) {
    alerts.push({ success: false, message: 'You are not logged in.' });
  } else {
    id = req.user.id;
    username = req.user.username;
    groups = req.user.groups;
  }

  // Select matching user id from database
  database('users')
    .select()
    .where({ id: id })
    .then(users => {
      // Match user
      if (users.length <= 0) {
        res.status(400).json({
          alerts: [
            {
              success: false,
              message: 'User does not exist.'
            }
          ]
        });
      } else {
        bcrypt.compare(deletePassword, users[0].password, (error, isMatch) => {
          if (error) {
            res.status(500).json({
              alerts: [
                {
                  success: false,
                  message: 'Internal error. Please try again.'
                }
              ]
            });
          }
          if (!isMatch) {
            res.status(400).json({
              alerts: [
                {
                  success: false,
                  message: 'Password is incorrect.'
                }
              ]
            });
          } else {
            // On match, delete user record and log them out
            database
              .transaction(trx => {
                return (
                  trx('users')
                    .where({ id: id })
                    .del()
                    // Delete user from group member lists
                    .then(() => {
                      return (
                        trx('groups')
                          .select('slug', 'members')
                          .then(groupRecords => {
                            groupRecords.forEach(group => {
                              const { slug, members } = group;
                              // Check if group's member list includes user
                              if (members.includes(username)) {
                                // Delete member from list and re-update list
                                members.splice(members.indexOf(username), 1);
                                return database('groups')
                                  .update({ members: members })
                                  .where({ slug: slug });
                              }
                            });
                          })
                          // Delete all schedule records for user
                          .then(() => {
                            return trx('schedules')
                              .where({ username: username })
                              .del();
                          })
                          .catch(trx.rollback)
                      );
                    })
                    .catch(trx.rollback)
                );
              })
              .then(() => {
                req.logout();
                res.status(200).send('Account deleted.');
              })
              .catch(error => {
                console.log('Error deleting user in USERS.', error);
                alerts.push({
                  success: false,
                  message: 'Error deleting account. Please try again later.'
                });
                res.status(500).json({ alerts });
              });
          }
        });
      }
    });
});

// Logout route
router.get('/logout', (req, res) => {
  req.logout();
  res.status(200).json({
    success: true,
    message: 'Successful log out.'
  });
});

module.exports = router;
