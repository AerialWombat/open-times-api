const knex = require('knex');

const database = knex({
  client: 'pg',
  connection: {
    host: '127.0.0.1',
    database: 'open-times'
  }
});

module.exports = database;
