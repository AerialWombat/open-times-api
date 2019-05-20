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
      .update('groups', database.raw('array_append(groups, ?)', [uuid]), [
        'groups'
      ])
      .where({ username: username })
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
        res.status(200).json({ slug: slug[0] });
      })
      .catch(trx.rollback);
  });
});

router.post('/set-schedule', (req, res) => {
  const { UUID, schedule } = req.body;
  let username;

  // Check if logged in. Then add member to group. If logged in, add group to member's groups list.
  if (req.user) {
    username = req.user.username;

    database('groups')
      .select('members')
      .where({ slug: UUID })
      .then(memberRecord => {
        const members = memberRecord[0].members;
        if (members.find(member => member === username)) {
          // Member is already in group
        } else {
          // Member is not in group
          database.transaction(trx => {
            return trx('groups')
              .update(
                'members',
                database.raw('array_append(members, ?)', [username]),
                ['members']
              )
              .where('slug', '=', UUID)
              .then(() => {
                return trx('users')
                  .update(
                    'groups',
                    database.raw('array_append(groups, ?)', [UUID]),
                    ['groups']
                  )
                  .where('username', '=', username);
              })
              .catch(trx.rollback);
          });
        }
      });
  } else if (req.body.anonUsername) {
    username = req.body.anonUsername;

    database('groups')
      .update('members', database.raw('array_append(members, ?)', [username]), [
        'members'
      ])
      .where({ slug: UUID })
      .catch(error => console.log(error));
  }

  // Add or update schedule in schedules table
  if (username) {
    database('schedules')
      .select()
      .where({
        username: username,
        group_id: UUID
      })
      .then(scheduleRecords => {
        if (scheduleRecords.length <= 0) {
          database('schedules')
            .insert({
              username: username,
              group_id: UUID,
              schedule: schedule
            })
            .then(() => {
              res.status(200).send('Successfully set schedule!');
            })
            .catch(error => {
              console.log('Error inserting into SCHEDULES.', error);
              res.status(500).send('Error setting schedule.');
            });
        } else {
          database('schedules')
            .update({
              username: username,
              group_id: UUID,
              schedule: schedule
            })
            .where({
              username: username,
              group_id: UUID
            })
            .then(() => {
              res.status(200).send('Successfully updated schedule!');
            })
            .catch(error => {
              console.log('Error updating SCHEDULES.', error);
              res.status(500).send('Error updating schedule.');
            });
        }
      });
  } else {
    res.status(400).send('Username is missing.');
  }
});

router.get('/info/:groupID', (req, res) => {
  const { groupID } = req.params;

  database('groups')
    .select('name', 'location', 'description', 'members')
    .where({ slug: groupID })
    .then(groupInfo => {
      const { name: title, location, description, members } = groupInfo[0];
      res.status(200).json({
        title: title,
        location: location,
        description: description,
        members: members
      });
    });
});

router.get('/view/:groupID', (req, res) => {
  const { groupID } = req.params;
  const combinedSchedule = [];

  database('schedules')
    .select('username', 'schedule')
    .where({ group_id: groupID })
    .then(scheduleRecords => {
      // Iterate through each hour block
      for (let i = 0; i < 168; i++) {
        let newTimeBlock = {
          amountAvailable: 0,
          membersAvailable: []
        };
        scheduleRecords.forEach(scheduleRecord => {
          // Check if a user is available for corresponding time block, if so increment amount of members available
          if (scheduleRecord.schedule[i] === 1) {
            newTimeBlock.amountAvailable += 1;
            // Check if member is already on membersAvailable list, if not, push them to the list
            if (
              !newTimeBlock.membersAvailable.includes(scheduleRecord.username)
            ) {
              newTimeBlock.membersAvailable.push(scheduleRecord.username);
            }
          }
        });
        // After looking at all schedules' corresponding hour blocks, push new combined schedule object
        combinedSchedule.push(newTimeBlock);
      }
    })
    .then(() => {
      database('groups')
        .select('name', 'location', 'description', 'members')
        .where({ slug: groupID })
        .then(groupInfo => {
          const { name: title, location, description, members } = groupInfo[0];
          res.status(200).json({
            title: title,
            location: location,
            description: description,
            members: members,
            combinedSchedule: combinedSchedule
          });
        });
    })
    .catch(error => console.log(`Error SELECTING group schedules. ${error}`));
});

module.exports = router;
