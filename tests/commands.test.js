const commands = require('../commands')

test('has commands', () => {
  expect(commands['stats']).toBeDefined()
  expect(commands['eval']).toBeDefined()

  Object.entries(commands).forEach(
    ([key, value]) => {
      expect(value).toBeInstanceOf(Function) // all commands must be functions
      expect(value).toHaveLength(2) // called with (client, message)
    }
  )
})
