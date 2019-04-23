const express = require('express');
const router = express.Router();

const database = require('../config/database');

// Route that gets user's group data to display in dashboard view
router.get('/dashboard', (req, res) => {
  const { groups } = req.user;

  Promise.all(
    groups.map(group => {
      return database('groups')
        .select()
        .where('name', '=', group)
        .then(data => {
          return data[0];
        });
    })
  )
    .then(response => res.status(200).json(response))
    .catch(error => console.log(error));
});

module.exports = router;
