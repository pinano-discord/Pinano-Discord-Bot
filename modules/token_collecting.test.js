const EventEmitter = require('events')
const TokenCollecting = require('./token_collecting')

class MockAdapter extends EventEmitter {
  notifyEggHatched () {}
  notifyEggObtained () {}
}

class MockPracticeManager extends EventEmitter {}

class MockUserRepository {
  constructor () { this._calls = [] }
  getCalls () {
    const result = this._calls
    this._calls = []
    return result
  }

  addToSet (id, field, value) {
    this._calls.push({ name: 'addToSet', id: id, field: field, value: value })
  }

  hatchCustomToken (id) {
    this._calls.push({ name: 'hatchCustomToken' })
  }

  setField (id, field, value) {
    this._calls.push({ name: 'setField', id: id, field: field, value: value })
  }
}

class MockModuleManager {
  constructor (pracman, repo) {
    this._pracman = pracman
    this._repo = repo
    this._config = new Map()
    this._config.set('enableTokenCollecting', true)
    this._config.set('minimumSessionTimeToEarnToken', 100)
    this._config.set('enableCustomTokens', true)
    this._config.set('customTokens', ['token'])
    this._config.set('timeToHatchCustomToken', 5)
    this._config.set('hatchCustomTokenTimeRange', 1)
  }

  getGuild () { return {} }
  getPersistence () {
    const persistence = {}
    persistence.getUserRepository = () => { return this._repo }
    return persistence
  }

  getModule (name) {
    switch (name) {
      case 'Practice Adapter':
        return new MockAdapter()
      case 'Practice Manager':
        return this._pracman
      default:
        throw new Error(`Unexpected depenency on module ${name}`)
    }
  }

  getConfig () { return this._config }
}

test('long play session earns token', () => {
  const mockPracticeManager = new MockPracticeManager()
  const mockRepository = new MockUserRepository()
  TokenCollecting.makeModule(new MockModuleManager(mockPracticeManager, mockRepository)).resume()

  mockPracticeManager.emit('incrementPrackingTime', { id: 'pracker' }, 100, 'someChannel', 'token')
  expect(mockRepository.getCalls()).toStrictEqual([
    { name: 'addToSet', id: 'pracker', field: 'rooms_practiced', value: 'token' }
  ])
})

test('long listen session earns egg', () => {
  const mockPracticeManager = new MockPracticeManager()
  const mockRepository = new MockUserRepository()
  TokenCollecting.makeModule(new MockModuleManager(mockPracticeManager, mockRepository)).resume()

  mockPracticeManager.emit('incrementListeningTime', { id: 'listener', overall_session_playtime: 100 }, 'pracker', 100)
  expect(mockRepository.getCalls()).toStrictEqual([
    { name: 'addToSet', id: 'listener', field: 'rooms_practiced', value: '🥚' },
    { name: 'setField', id: 'listener', field: 'egg_hatch_time', value: 105 }
  ])
})

test('egg hatches when past hatch time', () => {
  const mockPracticeManager = new MockPracticeManager()
  const mockRepository = new MockUserRepository()
  TokenCollecting.makeModule(new MockModuleManager(mockPracticeManager, mockRepository)).resume()

  mockPracticeManager.emit('incrementPrackingTime', { id: 'pracker', overall_session_playtime: 300, egg_hatch_time: 300, rooms_practiced: ['🥚'] }, 1, { token: 'token' })
  expect(mockRepository.getCalls()).toStrictEqual([
    { name: 'hatchCustomToken' }
  ])
})
