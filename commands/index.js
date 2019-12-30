const { help } = require('./help')
const { addtime, deltime } = require('./user_management')
const { lock, unlock, bitrate, rooms } = require('./room_management')
const { recital } = require('./recital_management')
const { stats } = require('./stats.js')
const { restart, pinanoEval } = require('./bot_management')

module.exports = {
  help,
  addtime,
  deltime,
  lock,
  unlock,
  bitrate,
  rooms,
  recital,
  recitals: recital,
  stats,
  restart,
  reboot: restart,
  eval: pinanoEval
}
