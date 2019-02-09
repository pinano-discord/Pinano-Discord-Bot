const PracticeManager = require('./PracticeManager')

// A random user id
const testUserId = 5

// Advance moment() by 3000ms each time it is called
jest.mock('moment', () => {
  let count = 0 // closure
  return jest.fn(() => ({ unix: () => count++ * 3000 }))
})

test('can track whether pracking', () => {
  const pm = new PracticeManager()
  pm.startPractice(testUserId)
  expect(pm.isPracticing(testUserId)).toBe(true)
  pm.stopPractice(testUserId)
  expect(pm.isPracticing(testUserId)).toBe(false)
})

test('measures live practice time', () => {
  const pm = new PracticeManager()
  pm.startPractice(testUserId)
  // Relies on mock advancing time
  expect(pm.currentPracticeTime(testUserId)).toBe(3000)
})
