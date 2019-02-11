const EventEmitter = require('events')

class MockPracticeManager extends EventEmitter {
  tick (activeTime, sessionTotal, overallTotal) {
    this.emit('stopPractice', 1, activeTime, sessionTotal, overallTotal)
  }
}

class RoleManager extends EventEmitter {
  constructor ({ practiceManager }) {
    super()
    this.practiceManager = practiceManager
    this.practiceManager.on('stopPractice', this.checkRole.bind(this))
  }

  checkRole (userId, activeTimeSec, sessionTotal, overallTotal) {
    this.emit('roleAssigned', userId, '40 Hour Pracker')
  }
}

test('assigns roles', () => {
  const practiceManager = new MockPracticeManager()
  const rm = new RoleManager({ practiceManager })
  const eventValidatorSpy = jest.fn(function (userId, roleName) {
    expect(userId).toBe(1)
    expect(roleName).toBe('40 Hour Pracker')
  })
  rm.on('roleAssigned', eventValidatorSpy)

  practiceManager.tick(2, 3, 4)

  expect(eventValidatorSpy).toHaveBeenCalled()
})
