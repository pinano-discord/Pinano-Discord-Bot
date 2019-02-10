const moment = require('moment')
const EventEmitter = require('events')

/*
 * The PracticeManager is intended to be a singleton that keeps
 * track of the total time that a user has practiced. There are
 * three kinds of times:
 * - current time: increments when actively practicing
 * - session time: sum of all time practiced between session resets (e.g., weekly)
 * - overall time: sum of all time practiced for all time
 *
 * The PracticeManager does not handle persistence or role assignment.
 * Instead it emits events that others can handle if they wish.
 */
class PracticeManager extends EventEmitter {
  constructor () {
    super()
    this.activePrackers = new Map() // id -> start time in epoch seconds
    this.sessionTotal = new Map() // id -> total time in session
    this.overallTotal = new Map() // id -> total time overall
  }

  startPractice (userId) {
    this.activePrackers.set(userId, moment().unix())
    this.emit('startPractice', userId, this.activePrackers.get(userId))
  }

  stopPractice (userId) {
    if (!this.isPracticing(userId)) {
      return
    }
    const delta = this.currentPracticeTime(userId)
    this.overallTotal.set(userId, (this.overallTotal.get(userId) || 0) + delta)
    this.sessionTotal.set(userId, (this.sessionTotal.get(userId) || 0) + delta)

    this.activePrackers.delete(userId)
    this.emit('stopPractice', userId, delta)
  }

  isPracticing (userId) {
    return this.activePrackers.has(userId)
  }

  currentPracticeTime (userId) {
    if (!this.isPracticing(userId)) {
      return 0
    }
    return moment().unix() - this.activePrackers.get(userId)
  }

  sessionPracticeTime (userId) {
    const delta = this.currentPracticeTime(userId)
    const base = this.sessionTotal.get(userId) || 0
    return base + delta
  }

  resetSession () {
    this.sessionTotal = new Map()
  }

  overallPracticeTime (userId) {
    const delta = this.sessionPracticeTime(userId)
    const base = this.overallTotal.get(userId) || 0
    return base + delta
  }
}

module.exports = PracticeManager
