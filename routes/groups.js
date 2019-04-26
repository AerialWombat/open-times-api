const express = require('express');
const router = express.Router();
const uuidv4 = require('uuid/v4');

const database = require('../config/database');

// Route that gets user's group data to display in dashboard view
router.get('/dashboard', (req, res) => {
  const { groups } = req.user;

  // Iterates though user's groups and returns promise with all group data from database
  Promise.all(
    groups.map(group => {
      return database('groups')
        .select()
        .where('slug', '=', group)
        .then(data => {
          return data[0];
        });
    })
  )
    .then(response => res.status(200).json(response))
    .catch(error => {
      console.log('Error getting from GROUPS.', error);
      alerts.push({
        success: false,
        message: 'Error retrieving groups. Please try again later'
      });
      res.status(500).json({ alerts });
    });
});

router.post('/create', (req, res) => {
  const { name, location, description } = req.body;
  const { username } = req.user;
  const uuid = uuidv4();
  const alerts = [];

  // Transaction to append new group to user record and then insert new group
  database.transaction(trx => {
    return trx('users')
      .where('username', '=', username)
      .update('groups', database.raw('array_append(groups, ?)', [uuid]), [
        'groups'
      ])
      .then(() => {
        return trx('groups')
          .returning('slug')
          .insert({
            name: name,
            creator: username,
            slug: uuid,
            location: location,
            description: description,
            members: [username]
          })
          .catch(error => {
            console.log('Error INSERTING into GROUPS', error);
            alerts.push({
              success: false,
              message: 'Error creating group. Please try again later'
            });
            res.status(500).json({ alerts });
          });
      })
      .then(slug => {
        // trx.commit;
        res.status(200).json({ slug: slug[0] });
      })
      .catch(trx.rollback);
  });
});

module.exports = router;
