const PracticeManager = require('./PracticeManager')
const DateMock = require('jest-date-mock')
const moment = require('moment')

// A random user id
const testUserId = 5
// Arbitrary fixed start time
const startTime = new Date(2019, 2, 1, 0, 0, 0)
const increment = moment.duration(5, 'seconds')

test('can track whether pracking', () => {
  const pm = new PracticeManager()

  pm.startPractice(testUserId)
  expect(pm.isPracticing(testUserId)).toBe(true)
  pm.stopPractice(testUserId)
  expect(pm.isPracticing(testUserId)).toBe(false)
})

test('measures live practice time', () => {
  const pm = new PracticeManager()
  DateMock.advanceTo(startTime)

  pm.startPractice(testUserId)
  DateMock.advanceBy(increment.asMilliseconds())

  expect(pm.currentPracticeTime(testUserId)).toBe(increment.asSeconds())
})
