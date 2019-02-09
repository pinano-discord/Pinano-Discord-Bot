const moment = require('moment')

class PracticeManager {
  constructor (database) {
    this.database = database
    this.activePrackers = new Map()
  }

  async startPractice (userId) {
    this.activePrackers.set(userId, moment().unix())
  }

  async stopPractice (userId) {
    this.activePrackers.delete(userId)
  }

  isPracticing (userId) {
    return this.activePrackers.has(userId)
  }

  currentPracticeTime (userId) {
    return moment().unix() - this.activePrackers.get(userId)
  }
}

module.exports = PracticeManager
