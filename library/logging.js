const moment = require('moment')

function log (string) {
  console.log(`${moment().format('MMMM Do YYYY, h:mm:ss a')} :: ${string}`)
}

module.exports = { log }
