const PracticeManager = require('./PracticeManager')
const DateMock = require('jest-date-mock')
const moment = require('moment')

// Some arbitrary userIds
const prackUserId = 5
const idleUserId = 11

// Arbitrary fixed start time
const startTime = new Date(2019, 2, 1, 0, 0, 0)
const fiveSeconds = moment.duration(5, 'seconds')
const anHour = moment.duration(1, 'hour')

// Subject under test
let pm
beforeEach(() => {
  pm = new PracticeManager()
  DateMock.advanceTo(startTime)
})

test('can track whether pracking', () => {
  pm.startPractice(prackUserId)
  expect(pm.isPracticing(prackUserId)).toBe(true)
  pm.stopPractice(prackUserId)
  expect(pm.isPracticing(prackUserId)).toBe(false)
})

test('measures live practice time', () => {
  pm.startPractice(prackUserId)
  DateMock.advanceBy(fiveSeconds.asMilliseconds())

  expect(pm.currentPracticeTime(prackUserId)).toBe(fiveSeconds.asSeconds())
})

test('ignores non-prackers', () => {
  expect(pm.isPracticing(idleUserId)).toBe(false)
  expect(pm.currentPracticeTime(idleUserId)).toBe(0)
})

test('starts with zero session time', () => {
  expect(pm.sessionPracticeTime(prackUserId)).toBe(0)
})

test('tracks session time when practicing', () => {
  pm.startPractice(prackUserId)
  DateMock.advanceBy(anHour.asMilliseconds())

  expect(pm.sessionPracticeTime(prackUserId)).toBe(anHour.asSeconds())
})

test('stops updating session time when done practicing', () => {
  pm.startPractice(prackUserId)
  DateMock.advanceBy(anHour.asMilliseconds())
  pm.stopPractice(prackUserId)
  DateMock.advanceBy(anHour.asMilliseconds())

  expect(pm.sessionPracticeTime(prackUserId)).toBe(anHour.asSeconds())
})

test('tracks overall time when practicing', () => {
  pm.startPractice(prackUserId)
  DateMock.advanceBy(anHour.asMilliseconds())

  expect(pm.overallPracticeTime(prackUserId)).toBe(anHour.asSeconds())
})

test('overall time remains after session reset', () => {
  pm.startPractice(prackUserId)
  DateMock.advanceBy(anHour.asMilliseconds())
  pm.stopPractice(prackUserId)

  pm.resetSession()

  expect(pm.sessionPracticeTime(prackUserId)).toBe(0)
  expect(pm.overallPracticeTime(prackUserId)).toBe(anHour.asSeconds())
})

test('emits startPractice event', () => {
  const eventValidatorSpy = jest.fn(function (userId, epochTime) {
    expect(userId).toBe(prackUserId)
    expect(epochTime).toBe(moment(startTime).unix())
  })
  pm.on('startPractice', eventValidatorSpy)
  pm.startPractice(prackUserId)
  expect(eventValidatorSpy).toHaveBeenCalled()
})

test('emits stopPractice event', () => {
  const eventValidatorSpy = jest.fn(function (userId, sessionTime) {
    expect(userId).toBe(prackUserId)
    expect(sessionTime).toBe(anHour.asSeconds())
  })

  pm.on('stopPractice', eventValidatorSpy)
  pm.startPractice(prackUserId)
  DateMock.advanceBy(anHour.asMilliseconds())
  pm.stopPractice(prackUserId)

  expect(eventValidatorSpy).toHaveBeenCalled()
})
