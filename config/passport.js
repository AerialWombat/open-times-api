const bcrypt = require('bcrypt-nodejs');
const LocalStrategy = require('passport-local').Strategy;

const database = require('../config/database');

module.exports = passport => {
  passport.use(
    new LocalStrategy({ usernameField: 'email' }, (email, password, done) => {
      // Select matching user record
      database('users')
        .select()
        .where('email', '=', email)
        .then(users => {
          // Match email
          if (users.length <= 0) {
            return done(null, false);
          } else {
            // Match password
            bcrypt.compare(password, users[0].password, (error, isMatch) => {
              if (error) throw error;

              if (!isMatch) {
                return done(null, false);
              } else {
                // Return user on password match
                return done(null, users[0]);
              }
            });
          }
        })
        .catch(error => console.log(error));
    })
  );

  passport.serializeUser((user, done) => {
    console.log(`SERIALIZING ID ${user.id}`);
    done(null, user.id);
  });

  passport.deserializeUser((id, done) => {
    console.log(`DESERIALIZING ID ${id}`);
    database('users')
      .select()
      .where('id', '=', id)
      .then(user => done(null, user[0]))
      .catch(error => done(error, null));
  });
};
