
const { badgesForUser } = require('../library/badges')

// A mock discord object
const mem = {
  id: 12345,
  nickname: 'theProject',
  joinedTimestamp: 0,
  roles: []
}

const userInfo = {
  mem: mem,
  overallSession: 1
}

const user = {
}

test('it works', () => {
  expect(badgesForUser(userInfo, user, false)).toBe(':musical_keyboard: I joined Pinano at least 88 days ago\n')
})
