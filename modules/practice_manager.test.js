const EventEmitter = require('events')
const PracticeManager = require('./practice_manager')

class MockUserRepository {
  constructor () { this._calls = [] }
  getCalls () {
    const result = this._calls
    this._calls = []
    return result
  }

  get () {}
  incrementSessionPlaytimes (id, increment) {
    this._calls.push({ name: 'incrementSessionPlaytimes', id: id, increment: increment })
  }

  incrementListeningTime (id, increment) {
    this._calls.push({ name: 'incrementListeningTime', id: id, increment: increment })
  }

  loadPositive () { return [] }
}

class MockAdapter extends EventEmitter {
  registerForPracticeManagerEvents () {}
  getCurrentState () {
    return {
      channel1: {
        live: [],
        listening: []
      },
      channel2: {
        live: [{
          id: 'existingPracker',
          since: 5
        }],
        listening: []
      },
      channel3: {
        live: [],
        listening: [{
          id: 'existingListener',
          since: 10
        }]
      }
    }
  }
}

let mockTimestamp
function mockTimestampFn () {
  return mockTimestamp
}

const simpleMockConfig = new Map()
simpleMockConfig.set('enablePracticeManager', true)

class MockModuleManager {
  constructor (adapter, repo, config) {
    this._adapter = adapter
    this._repo = repo
    this._config = config
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
        return this._adapter
      default:
        throw new Error(`Unexpected depenency on module ${name}`)
    }
  }

  getConfig () { return this._config }
}

test('unmuted join starts play session', () => {
  const mockAdapter = new MockAdapter()
  const mockRepository = new MockUserRepository()
  PracticeManager.makeModule(new MockModuleManager(mockAdapter, mockRepository, simpleMockConfig), mockTimestampFn).resume()

  mockTimestamp = 10
  mockAdapter.emit('joinPracticeRoom', 'newPracker', 'channel1', false, false)
  mockTimestamp = 30
  mockAdapter.emit('leavePracticeRoom', 'newPracker', 'channel1', false, false)

  expect(mockRepository.getCalls()).toStrictEqual([
    { name: 'incrementSessionPlaytimes', id: 'newPracker', increment: 20 }
  ])
})

test('unmute starts play session', () => {
  const mockAdapter = new MockAdapter()
  const mockRepository = new MockUserRepository()
  PracticeManager.makeModule(new MockModuleManager(mockAdapter, mockRepository, simpleMockConfig), mockTimestampFn).resume()

  mockTimestamp = 10
  mockAdapter.emit('joinPracticeRoom', 'newPracker', 'channel1', true, false)
  mockTimestamp = 15
  mockAdapter.emit('unmute', 'newPracker', 'channel1', false)
  mockTimestamp = 30
  mockAdapter.emit('mute', 'newPracker', 'channel1', false)

  expect(mockRepository.getCalls()).toStrictEqual([
    { name: 'incrementSessionPlaytimes', id: 'newPracker', increment: 15 }
  ])
})

test('unmuted switch ends and starts play session', () => {
  const mockAdapter = new MockAdapter()
  const mockRepository = new MockUserRepository()
  PracticeManager.makeModule(new MockModuleManager(mockAdapter, mockRepository, simpleMockConfig), mockTimestampFn).resume()

  mockTimestamp = 10
  mockAdapter.emit('switchPracticeRoom', 'existingPracker', 'channel2', 'channel1', false, false, false, false)
  mockTimestamp = 30
  mockAdapter.emit('switchPracticeRoom', 'existingPracker', 'channel1', 'channel3', false, false, false, false)

  expect(mockRepository.getCalls()).toStrictEqual([
    { name: 'incrementSessionPlaytimes', id: 'existingPracker', increment: 5 },
    { name: 'incrementSessionPlaytimes', id: 'existingPracker', increment: 20 }
  ])
})

test('undeafmuting starts play session', () => {
  const mockAdapter = new MockAdapter()
  const mockRepository = new MockUserRepository()
  PracticeManager.makeModule(new MockModuleManager(mockAdapter, mockRepository, simpleMockConfig), mockTimestampFn).resume()

  mockTimestamp = 10
  mockAdapter.emit('joinPracticeRoom', 'newPracker', 'channel1', true, true)
  mockTimestamp = 15
  mockAdapter.emit('unmute', 'newPracker', 'channel1', true)
  mockTimestamp = 30
  mockAdapter.emit('mute', 'newPracker', 'channel1', false)

  expect(mockRepository.getCalls()).toStrictEqual([
    { name: 'incrementSessionPlaytimes', id: 'newPracker', increment: 15 }
  ])
})

test('muted join does not start play session', () => {
  const mockAdapter = new MockAdapter()
  const mockRepository = new MockUserRepository()
  PracticeManager.makeModule(new MockModuleManager(mockAdapter, mockRepository, simpleMockConfig), mockTimestampFn).resume()

  mockTimestamp = 10
  mockAdapter.emit('joinPracticeRoom', 'nonPracker', 'channel1', true, false)
  mockTimestamp = 30
  mockAdapter.emit('leavePracticeRoom', 'nonPracker', 'channel1', true, false)

  expect(mockRepository.getCalls()).toStrictEqual([])
})

test('muted switch does not credit play time', () => {
  const mockAdapter = new MockAdapter()
  const mockRepository = new MockUserRepository()
  PracticeManager.makeModule(new MockModuleManager(mockAdapter, mockRepository, simpleMockConfig), mockTimestampFn).resume()

  mockTimestamp = 10
  mockAdapter.emit('mute', 'existingPracker', 'channel2', false)
  mockRepository.getCalls() // clear the mock

  mockAdapter.emit('switchPracticeRoom', 'existingPracker', 'channel2', 'channel1', true, false, true, false)
  mockTimestamp = 30
  mockAdapter.emit('leavePracticeRoom', 'existingPracker', 'channel1', true, false)

  expect(mockRepository.getCalls()).toStrictEqual([])
})

test('switch into suppression does not start play session', () => {
  const mockAdapter = new MockAdapter()
  const mockRepository = new MockUserRepository()
  PracticeManager.makeModule(new MockModuleManager(mockAdapter, mockRepository, simpleMockConfig), mockTimestampFn).resume()

  mockTimestamp = 10
  mockAdapter.emit('switchPracticeRoom', 'existingPracker', 'channel2', 'channel1', false, false, true, false)
  mockRepository.getCalls() // clear the mock

  mockTimestamp = 30
  mockAdapter.emit('leavePracticeRoom', 'existingPracker', 'channel1', true, false)

  expect(mockRepository.getCalls()).toStrictEqual([])
})

test('switch out of suppression starts play session', () => {
  const mockAdapter = new MockAdapter()
  const mockRepository = new MockUserRepository()
  PracticeManager.makeModule(new MockModuleManager(mockAdapter, mockRepository, simpleMockConfig), mockTimestampFn).resume()

  mockTimestamp = 10
  mockAdapter.emit('mute', 'existingPracker', 'channel2', false)
  mockRepository.getCalls() // clear the mock

  mockAdapter.emit('switchPracticeRoom', 'existingPracker', 'channel2', 'channel1', true, false, false, false)
  mockTimestamp = 30
  mockAdapter.emit('leavePracticeRoom', 'existingPracker', 'channel1', false, false)

  expect(mockRepository.getCalls()).toStrictEqual([
    { name: 'incrementSessionPlaytimes', id: 'existingPracker', increment: 20 }
  ])
})

test('listening to existing pracker credits listening time', () => {
  const mockAdapter = new MockAdapter()
  const mockRepository = new MockUserRepository()
  PracticeManager.makeModule(new MockModuleManager(mockAdapter, mockRepository, simpleMockConfig), mockTimestampFn).resume()

  mockTimestamp = 10
  mockAdapter.emit('joinPracticeRoom', 'listener', 'channel2', true, false)
  mockTimestamp = 30
  mockAdapter.emit('leavePracticeRoom', 'listener', 'channel2', true, false)

  expect(mockRepository.getCalls()).toStrictEqual([
    { name: 'incrementListeningTime', id: 'listener', increment: 20 }
  ])
})

test('pracking to existing listener credits listening time', () => {
  const mockAdapter = new MockAdapter()
  const mockRepository = new MockUserRepository()
  PracticeManager.makeModule(new MockModuleManager(mockAdapter, mockRepository, simpleMockConfig), mockTimestampFn).resume()

  mockTimestamp = 15
  mockAdapter.emit('joinPracticeRoom', 'newPracker', 'channel3', false, false)
  mockTimestamp = 30
  mockAdapter.emit('leavePracticeRoom', 'existingListener', 'channel3', true, false)

  expect(mockRepository.getCalls()).toStrictEqual([
    { name: 'incrementListeningTime', id: 'existingListener', increment: 15 }
  ])
})

test('switch into suppression starts listen session', () => {
  const mockAdapter = new MockAdapter()
  const mockRepository = new MockUserRepository()
  PracticeManager.makeModule(new MockModuleManager(mockAdapter, mockRepository, simpleMockConfig), mockTimestampFn).resume()

  mockTimestamp = 10
  mockAdapter.emit('joinPracticeRoom', 'newPracker', 'channel1', false, false)
  mockAdapter.emit('switchPracticeRoom', 'existingPracker', 'channel2', 'channel1', false, false, true, false)
  mockRepository.getCalls() // clear the mock

  mockTimestamp = 30
  mockAdapter.emit('leavePracticeRoom', 'existingPracker', 'channel1', true, false)

  expect(mockRepository.getCalls()).toStrictEqual([
    { name: 'incrementListeningTime', id: 'existingPracker', increment: 20 }
  ])
})

test('stopping practicing starts listen session', () => {
  const mockAdapter = new MockAdapter()
  const mockRepository = new MockUserRepository()
  PracticeManager.makeModule(new MockModuleManager(mockAdapter, mockRepository, simpleMockConfig), mockTimestampFn).resume()

  mockTimestamp = 10
  mockAdapter.emit('joinPracticeRoom', 'newPracker', 'channel2', true, false)
  mockAdapter.emit('mute', 'existingPracker', 'channel2', false)
  mockRepository.getCalls() // clear the mock

  mockTimestamp = 15
  mockAdapter.emit('unmute', 'newPracker', 'channel2', false)
  mockTimestamp = 30
  mockAdapter.emit('leavePracticeRoom', 'existingPracker', 'channel2', true, false)

  expect(mockRepository.getCalls()).toStrictEqual([
    { name: 'incrementListeningTime', id: 'existingPracker', increment: 15 }
  ])
})

test('leaving pracker credits listening time', () => {
  const mockAdapter = new MockAdapter()
  const mockRepository = new MockUserRepository()
  PracticeManager.makeModule(new MockModuleManager(mockAdapter, mockRepository, simpleMockConfig), mockTimestampFn).resume()

  mockTimestamp = 10
  mockAdapter.emit('joinPracticeRoom', 'listener', 'channel2', true, false)
  mockTimestamp = 30
  mockAdapter.emit('leavePracticeRoom', 'existingPracker', 'channel2', false, false)

  expect(mockRepository.getCalls()).toStrictEqual([
    { name: 'incrementSessionPlaytimes', id: 'existingPracker', increment: 25 },
    { name: 'incrementListeningTime', id: 'listener', increment: 20 }
  ])
})

test('muting pracker credits listening time', () => {
  const mockAdapter = new MockAdapter()
  const mockRepository = new MockUserRepository()
  PracticeManager.makeModule(new MockModuleManager(mockAdapter, mockRepository, simpleMockConfig), mockTimestampFn).resume()

  mockTimestamp = 10
  mockAdapter.emit('joinPracticeRoom', 'listener', 'channel2', true, false)
  mockTimestamp = 30
  mockAdapter.emit('mute', 'existingPracker', 'channel2', false)

  expect(mockRepository.getCalls()).toStrictEqual([
    { name: 'incrementSessionPlaytimes', id: 'existingPracker', increment: 25 },
    { name: 'incrementListeningTime', id: 'listener', increment: 20 }
  ])
})

test('deafening credits listening time', () => {
  const mockAdapter = new MockAdapter()
  const mockRepository = new MockUserRepository()
  PracticeManager.makeModule(new MockModuleManager(mockAdapter, mockRepository, simpleMockConfig), mockTimestampFn).resume()

  mockTimestamp = 10
  mockAdapter.emit('joinPracticeRoom', 'listener', 'channel2', true, false)
  mockTimestamp = 30
  mockAdapter.emit('deafen', 'listener', 'channel2')

  expect(mockRepository.getCalls()).toStrictEqual([
    { name: 'incrementListeningTime', id: 'listener', increment: 20 }
  ])
})

test('joining while deaf does not start listen session', () => {
  const mockAdapter = new MockAdapter()
  const mockRepository = new MockUserRepository()
  PracticeManager.makeModule(new MockModuleManager(mockAdapter, mockRepository, simpleMockConfig), mockTimestampFn).resume()

  mockTimestamp = 10
  mockAdapter.emit('joinPracticeRoom', 'nonListener', 'channel2', true, true)
  mockTimestamp = 30
  mockAdapter.emit('leavePracticeRoom', 'nonListener', 'channel2', true, true)

  expect(mockRepository.getCalls()).toStrictEqual([])
})

test('pracking to deaf listener credits no listening time', () => {
  const mockAdapter = new MockAdapter()
  const mockRepository = new MockUserRepository()
  PracticeManager.makeModule(new MockModuleManager(mockAdapter, mockRepository, simpleMockConfig), mockTimestampFn).resume()

  mockTimestamp = 15
  mockAdapter.emit('deafen', 'existingListener', 'channel3')
  mockTimestamp = 20
  mockAdapter.emit('joinPracticeRoom', 'newPracker', 'channel3', false, false)
  mockTimestamp = 40
  mockAdapter.emit('leavePracticeRoom', 'newPracker', 'channel3', false, false)

  // the deaf listener gets no credit for listening time. Only the pracker gets
  // credit for the time spent practicing to no listeners.
  expect(mockRepository.getCalls()).toStrictEqual([
    { name: 'incrementSessionPlaytimes', id: 'newPracker', increment: 20 }
  ])
})

test('switch into suppression while deaf does not begin listen session', () => {
  const mockAdapter = new MockAdapter()
  const mockRepository = new MockUserRepository()
  PracticeManager.makeModule(new MockModuleManager(mockAdapter, mockRepository, simpleMockConfig), mockTimestampFn).resume()

  mockTimestamp = 15
  mockAdapter.emit('joinPracticeRoom', 'newPracker', 'channel1', false, false)
  mockTimestamp = 20
  mockAdapter.emit('switchPracticeRoom', 'existingPracker', 'channel2', 'channel1', false, true, true, true)
  mockRepository.getCalls() // clear the mock

  mockTimestamp = 40
  mockAdapter.emit('leavePracticeRoom', 'newPracker', 'channel1', false, false)

  // the deaf listener gets no credit for listening time. Only the pracker gets
  // credit for the time spent practicing to no listeners.
  expect(mockRepository.getCalls()).toStrictEqual([
    { name: 'incrementSessionPlaytimes', id: 'newPracker', increment: 25 }
  ])
})

test('stopping practicing while deaf does not begin listen session', () => {
  const mockAdapter = new MockAdapter()
  const mockRepository = new MockUserRepository()
  PracticeManager.makeModule(new MockModuleManager(mockAdapter, mockRepository, simpleMockConfig), mockTimestampFn).resume()

  mockTimestamp = 20
  mockAdapter.emit('mute', 'existingPracker', 'channel2', true)
  mockTimestamp = 25
  mockAdapter.emit('joinPracticeRoom', 'newPracker', 'channel2', false, false)
  mockRepository.getCalls() // clear the mock

  mockTimestamp = 40
  mockAdapter.emit('leavePracticeRoom', 'newPracker', 'channel2', false, false)

  // the deaf listener gets no credit for listening time. Only the pracker gets
  // credit for the time spent practicing to no listeners.
  expect(mockRepository.getCalls()).toStrictEqual([
    { name: 'incrementSessionPlaytimes', id: 'newPracker', increment: 15 }
  ])
})

test('deafmuting does not begin listen session', () => {
  const mockAdapter = new MockAdapter()
  const mockRepository = new MockUserRepository()
  PracticeManager.makeModule(new MockModuleManager(mockAdapter, mockRepository, simpleMockConfig), mockTimestampFn).resume()

  mockTimestamp = 15
  mockAdapter.emit('mute', 'existingPracker', 'channel2', true)
  mockTimestamp = 25
  mockAdapter.emit('joinPracticeRoom', 'newPracker', 'channel2', false, false)
  mockRepository.getCalls() // clear the mock

  mockTimestamp = 40
  mockAdapter.emit('leavePracticeRoom', 'newPracker', 'channel2', false, false)

  // the deaf listener gets no credit for listening time. Only the pracker gets
  // credit for the time spent practicing to no listeners.
  expect(mockRepository.getCalls()).toStrictEqual([
    { name: 'incrementSessionPlaytimes', id: 'newPracker', increment: 15 }
  ])
})

test('undeafen begins new listening session', () => {
  const mockAdapter = new MockAdapter()
  const mockRepository = new MockUserRepository()
  PracticeManager.makeModule(new MockModuleManager(mockAdapter, mockRepository, simpleMockConfig), mockTimestampFn).resume()

  mockTimestamp = 10
  mockAdapter.emit('joinPracticeRoom', 'listener', 'channel2', true, true)
  mockTimestamp = 15
  mockAdapter.emit('undeafen', 'listener', 'channel2')
  mockTimestamp = 30
  mockAdapter.emit('leavePracticeRoom', 'listener', 'channel2', true, false)

  expect(mockRepository.getCalls()).toStrictEqual([
    { name: 'incrementListeningTime', id: 'listener', increment: 15 }
  ])
})

test('earlier pracker leaving credits listening time', () => {
  const mockAdapter = new MockAdapter()
  const mockRepository = new MockUserRepository()
  PracticeManager.makeModule(new MockModuleManager(mockAdapter, mockRepository, simpleMockConfig), mockTimestampFn).resume()

  mockTimestamp = 5
  mockAdapter.emit('joinPracticeRoom', 'listener1', 'channel1', true, false)
  mockTimestamp = 10
  mockAdapter.emit('joinPracticeRoom', 'pracker1', 'channel1', false, false)
  mockTimestamp = 20
  mockAdapter.emit('joinPracticeRoom', 'listener2', 'channel1', true, false)
  mockTimestamp = 25
  mockAdapter.emit('joinPracticeRoom', 'pracker2', 'channel1', false, false)
  mockTimestamp = 30
  mockAdapter.emit('joinPracticeRoom', 'listener3', 'channel1', true, false)

  mockTimestamp = 50
  mockAdapter.emit('mute', 'pracker1', 'channel1', false)
  expect(mockRepository.getCalls()).toStrictEqual([
    { name: 'incrementSessionPlaytimes', id: 'pracker1', increment: 40 },
    { name: 'incrementListeningTime', id: 'listener1', increment: 15 },
    { name: 'incrementListeningTime', id: 'listener2', increment: 5 }
  ])

  mockTimestamp = 100
  mockAdapter.emit('mute', 'pracker2', 'channel1', false)
  expect(mockRepository.getCalls()).toStrictEqual([
    { name: 'incrementSessionPlaytimes', id: 'pracker2', increment: 75 },
    { name: 'incrementListeningTime', id: 'listener1', increment: 75 },
    { name: 'incrementListeningTime', id: 'listener2', increment: 75 },
    { name: 'incrementListeningTime', id: 'listener3', increment: 70 },
    { name: 'incrementListeningTime', id: 'pracker1', increment: 50 }
  ])
})
