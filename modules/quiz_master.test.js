const QuizMaster = require('./quiz_master')

class MockUserRepository {
  incrementField (id, field) { return { [field]: 42 } }
  loadPositive () { return [] }
}

class MockQuizRepository {
  getActiveQueue () { return [] }
  addRiddle () {}
  removeRiddle () {}
  promoteRiddle () {}
}

class MockAdapter {
  constructor () {
    this._calls = []
  }

  getCalls () {
    const result = this._calls
    this._calls = []
    return result
  }

  continueExistingRiddles () { return [] }
  getBytes () { return 'content' }
  onContentDownloaded (riddleId) {
    this._calls.push({ name: 'downloadContent', riddleId: riddleId })
  }

  postRiddle (quizzerId, content, filename) {
    this._calls.push({ name: 'newRiddle', quizzerId: quizzerId, content: content, filename: filename })
  }

  notifyRiddleQueued (authorId, riddleId) {
    this._calls.push({ name: 'addToQueue', authorId: authorId, riddleId: riddleId })
  }

  notifyRiddleRejected () {
    this._calls.push({ name: 'riddleRejected' })
  }

  notifyCorrectAnswer (guesserId, guess, reactorId, newScore) {
    this._calls.push({ name: 'correctAnswer', guesserId: guesserId, guess: guess, reactorId: reactorId, newScore: newScore })
  }

  endRiddle (quizzerId) {
    this._calls.push({ name: 'endRiddle', quizzerId: quizzerId })
  }

  notifyQueueEmpty () {
    this._calls.push({ name: 'queueEmpty' })
  }
}

const singleRiddleConfig = new Map()
singleRiddleConfig.set('enableLiteratureQuiz', true)
singleRiddleConfig.set('maxConcurrentRiddles', 1)

const multiRiddleConfig = new Map()
multiRiddleConfig.set('enableLiteratureQuiz', true)
multiRiddleConfig.set('maxConcurrentRiddles', 3)

const blocklistConfig = new Map()
blocklistConfig.set('enableLiteratureQuiz', true)
blocklistConfig.set('maxConcurrentRiddles', 1)
blocklistConfig.set('riddleAcceptancePolicy', 'blocklist')
blocklistConfig.set('blocklist', ['blocklisted_quizzer'])
blocklistConfig.set('rejectedRiddleAction', 'ignore')

class MockModuleManager {
  constructor (adapter, users, quiz, config) {
    this._adapter = adapter
    this._users = users
    this._quiz = quiz
    this._config = config
  }

  getClient () { return { user: { id: 5 } } }
  getGuild () { return {} }
  getPersistence () {
    const persistence = {}
    persistence.getUserRepository = () => { return this._users }
    persistence.getQuizRepository = () => { return this._quiz }
    return persistence
  }

  getModule (name) {
    switch (name) {
      case 'Quiz Adapter':
        return this._adapter
      default:
        throw new Error(`Unexpected depenency on module ${name}`)
    }
  }

  getConfig () { return this._config }
}

test('basic test', async () => {
  const mockAdapter = new MockAdapter()
  const module = QuizMaster.makeModule(new MockModuleManager(mockAdapter, new MockUserRepository(), new MockQuizRepository(), singleRiddleConfig))
  await module.resume()

  await module.enqueue('riddle1', 'quizzer1', 'url.png')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'downloadContent', riddleId: 'riddle1' },
    { name: 'newRiddle', quizzerId: 'quizzer1', content: 'content', filename: 'riddle.png' }
  ])

  await module.onCorrectAnswer('guesser1', 'guess', 'quizzer1', 'quizzer1')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'correctAnswer', guesserId: 'guesser1', guess: 'guess', reactorId: 'quizzer1', newScore: 42 },
    { name: 'endRiddle', quizzerId: 'quizzer1' },
    { name: 'queueEmpty' }
  ])
})

test('skip test', async () => {
  const mockAdapter = new MockAdapter()
  const module = QuizMaster.makeModule(new MockModuleManager(mockAdapter, new MockUserRepository(), new MockQuizRepository(), singleRiddleConfig))
  await module.resume()

  await module.enqueue('riddle1', 'quizzer1', 'url.png')
  mockAdapter.getCalls() // clear the mock

  await module.endRiddle('quizzer1', 'quizzer1')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'endRiddle', quizzerId: 'quizzer1' },
    { name: 'queueEmpty' }
  ])
})

test('queue test', async () => {
  const mockAdapter = new MockAdapter()
  const module = QuizMaster.makeModule(new MockModuleManager(mockAdapter, new MockUserRepository(), new MockQuizRepository(), singleRiddleConfig))
  await module.resume()

  await module.enqueue('riddle1', 'quizzer1', 'url.png')
  mockAdapter.getCalls() // clear the mock

  await module.enqueue('riddle2', 'quizzer2', 'url.png')
  await module.enqueue('riddle3', 'quizzer3', 'url.png')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'downloadContent', riddleId: 'riddle2' },
    { name: 'addToQueue', authorId: 'quizzer2', riddleId: 'riddle2' },
    { name: 'downloadContent', riddleId: 'riddle3' },
    { name: 'addToQueue', authorId: 'quizzer3', riddleId: 'riddle3' }
  ])

  await module.endRiddle('quizzer1', 'quizzer1')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'endRiddle', quizzerId: 'quizzer1' },
    { name: 'newRiddle', quizzerId: 'quizzer2', content: 'content', filename: 'riddle.png' }
  ])

  await module.endRiddle('quizzer2', 'admin')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'endRiddle', quizzerId: 'quizzer2' },
    { name: 'newRiddle', quizzerId: 'quizzer3', content: 'content', filename: 'riddle.png' }
  ])

  await module.onCorrectAnswer('guesser1', 'guess', 'admin', 'quizzer3')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'correctAnswer', guesserId: 'guesser1', guess: 'guess', reactorId: 'admin', newScore: 42 },
    { name: 'endRiddle', quizzerId: 'quizzer3' },
    { name: 'queueEmpty' }
  ])
})

test('priority queue test', async () => {
  const mockAdapter = new MockAdapter()
  const module = QuizMaster.makeModule(new MockModuleManager(mockAdapter, new MockUserRepository(), new MockQuizRepository(), singleRiddleConfig))
  module.resume()

  await module.enqueue('riddle1', 'quizzer1', 'url.png')
  await module.enqueue('riddle2', 'quizzer1', 'url.png')
  await module.enqueue('riddle3', 'quizzer2', 'url.png')
  mockAdapter.getCalls() // clear the mock

  await module.endRiddle('quizzer1', 'quizzer1')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'endRiddle', quizzerId: 'quizzer1' },
    { name: 'newRiddle', quizzerId: 'quizzer2', content: 'content', filename: 'riddle.png' }
  ])
})

test('delete test', async () => {
  const mockAdapter = new MockAdapter()
  const module = QuizMaster.makeModule(new MockModuleManager(mockAdapter, new MockUserRepository(), new MockQuizRepository(), singleRiddleConfig))
  module.resume()

  await module.enqueue('riddle1', 'quizzer1', 'url.png')
  await module.enqueue('riddle2', 'quizzer2', 'url.png')
  await module.enqueue('riddle3', 'quizzer3', 'url.png')
  mockAdapter.getCalls() // clear the mock

  await module.deleteRiddle('riddle2')
  await module.endRiddle('quizzer1', 'admin')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'endRiddle', quizzerId: 'quizzer1' },
    { name: 'newRiddle', quizzerId: 'quizzer3', content: 'content', filename: 'riddle.png' }
  ])
})

test('autostart test', async () => {
  const mockConfig = new Map()
  mockConfig.set('enableLiteratureQuiz', true)
  mockConfig.set('maxConcurrentRiddles', 1)
  mockConfig.set('automaticallyStartQueue', true)

  const mockAdapter = new MockAdapter()
  const mockQuizRepository = new MockQuizRepository()
  mockQuizRepository.getActiveQueue = () => {
    return [{
      id: 'existing0',
      quizzerId: 'quizzer1',
      overflow: false,
      ignore: false,
      priority: 5,
      content: 'whatever'
    }]
  }
  await QuizMaster.makeModule(new MockModuleManager(mockAdapter, new MockUserRepository(), mockQuizRepository, mockConfig)).resume()
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'newRiddle', quizzerId: 'quizzer1', content: 'whatever', filename: 'riddle.png' }
  ])
})

test('continuation test', async () => {
  const mockAdapter = new MockAdapter()
  const mockQuizRepository = new MockQuizRepository()
  mockAdapter.continueExistingRiddles = () => ['quizzer1']
  mockQuizRepository.getActiveQueue = () => {
    return [{
      id: 'existing0',
      quizzerId: 'quizzer1',
      overflow: false,
      ignore: false,
      priority: 5,
      content: 'whatever'
    }]
  }
  const module = QuizMaster.makeModule(new MockModuleManager(mockAdapter, new MockUserRepository(), mockQuizRepository, singleRiddleConfig))
  await module.resume()

  await module.enqueue('riddle1', 'quizzer1', 'url.png')
  await module.enqueue('riddle2', 'quizzer2', 'url.png')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'downloadContent', riddleId: 'riddle1' },
    { name: 'addToQueue', authorId: 'quizzer1', riddleId: 'riddle1' },
    { name: 'downloadContent', riddleId: 'riddle2' },
    { name: 'addToQueue', authorId: 'quizzer2', riddleId: 'riddle2' }
  ])

  await module.endRiddle('quizzer1', 'quizzer1')
  // queue prioritizes quizzer2 as the next quizzer
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'endRiddle', quizzerId: 'quizzer1' },
    { name: 'newRiddle', quizzerId: 'quizzer2', content: 'content', filename: 'riddle.png' }
  ])
})

test('queue resumption test', async () => {
  const mockAdapter = new MockAdapter()
  const mockQuizRepository = new MockQuizRepository()
  mockAdapter.continueExistingRiddles = () => ['quizzer1']
  mockQuizRepository.getActiveQueue = () => {
    return [{
      id: 'existing0',
      quizzerId: 'quizzer1',
      overflow: false,
      ignore: false,
      priority: 5,
      content: 'whatever'
    }, {
      id: 'existing2',
      quizzerId: 'quizzer3',
      overflow: false,
      ignore: false,
      priority: 7,
      content: 'whatever'
    }, {
      id: 'existing1',
      quizzerId: 'quizzer2',
      overflow: false,
      ignore: false,
      priority: 6,
      content: 'whatever'
    }]
  }
  const module = QuizMaster.makeModule(new MockModuleManager(mockAdapter, new MockUserRepository(), mockQuizRepository, singleRiddleConfig))
  await module.resume()

  await module.endRiddle('quizzer1', 'quizzer1')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'endRiddle', quizzerId: 'quizzer1' },
    { name: 'newRiddle', quizzerId: 'quizzer2', content: 'whatever', filename: 'riddle.png' }
  ])

  await module.endRiddle('quizzer2', 'admin')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'endRiddle', quizzerId: 'quizzer2' },
    { name: 'newRiddle', quizzerId: 'quizzer3', content: 'whatever', filename: 'riddle.png' }
  ])

  await module.onCorrectAnswer('guesser1', 'guess', 'admin', 'quizzer3')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'correctAnswer', guesserId: 'guesser1', guess: 'guess', reactorId: 'admin', newScore: 42 },
    { name: 'endRiddle', quizzerId: 'quizzer3' },
    { name: 'queueEmpty' }
  ])
})

test('blocklist test', async () => {
  const mockAdapter = new MockAdapter()
  const module = QuizMaster.makeModule(new MockModuleManager(mockAdapter, new MockUserRepository(), new MockQuizRepository(), blocklistConfig))
  await module.resume()

  await module.enqueue('riddle1', 'quizzer1', 'url.png')
  mockAdapter.getCalls() // clear the mock

  await module.enqueue('riddle2', 'blocklisted_quizzer', 'url.png')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'downloadContent', riddleId: 'riddle2' },
    { name: 'addToQueue', authorId: 'blocklisted_quizzer', riddleId: 'riddle2' }
  ])

  await module.endRiddle('quizzer1', 'quizzer1')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'endRiddle', quizzerId: 'quizzer1' },
    { name: 'queueEmpty' }
  ])
})

test('allowlist test', async () => {
  const mockConfig = new Map()
  mockConfig.set('enableLiteratureQuiz', true)
  mockConfig.set('maxConcurrentRiddles', 1)
  mockConfig.set('riddleAcceptancePolicy', 'allowlist')
  mockConfig.set('allowlist', ['allowlisted_quizzer1', 'allowlisted_quizzer2'])
  mockConfig.set('rejectedRiddleAction', 'ignore')

  const mockAdapter = new MockAdapter()
  const module = QuizMaster.makeModule(new MockModuleManager(mockAdapter, new MockUserRepository(), new MockQuizRepository(), mockConfig))
  await module.resume()

  await module.enqueue('riddle1', 'allowlisted_quizzer1', 'url.png')
  mockAdapter.getCalls() // clear the mock

  await module.enqueue('riddle2', 'quizzer2', 'url.png')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'downloadContent', riddleId: 'riddle2' },
    { name: 'addToQueue', authorId: 'quizzer2', riddleId: 'riddle2' }
  ])

  await module.enqueue('riddle3', 'allowlisted_quizzer2', 'url.png')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'downloadContent', riddleId: 'riddle3' },
    { name: 'addToQueue', authorId: 'allowlisted_quizzer2', riddleId: 'riddle3' }
  ])

  await module.endRiddle('allowlisted_quizzer1', 'admin')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'endRiddle', quizzerId: 'allowlisted_quizzer1' },
    { name: 'newRiddle', quizzerId: 'allowlisted_quizzer2', content: 'content', filename: 'riddle.png' }
  ])
})

test('acceptance policy ignored on first riddle', async () => {
  const mockAdapter = new MockAdapter()
  const module = QuizMaster.makeModule(new MockModuleManager(mockAdapter, new MockUserRepository(), new MockQuizRepository(), blocklistConfig))
  await module.resume()
  await module.enqueue('riddle1', 'blocklisted_quizzer', 'url.png')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'downloadContent', riddleId: 'riddle1' },
    { name: 'newRiddle', quizzerId: 'blocklisted_quizzer', content: 'content', filename: 'riddle.png' }
  ])
})

test('rejection test', async () => {
  const blocklistConfig = new Map()
  blocklistConfig.set('enableLiteratureQuiz', true)
  blocklistConfig.set('maxConcurrentRiddles', 1)
  blocklistConfig.set('riddleAcceptancePolicy', 'blocklist')
  blocklistConfig.set('blocklist', ['blocklisted_quizzer'])
  blocklistConfig.set('rejectedRiddleAction', 'reject')

  const mockAdapter = new MockAdapter()
  const module = QuizMaster.makeModule(new MockModuleManager(mockAdapter, new MockUserRepository(), new MockQuizRepository(), blocklistConfig))
  await module.resume()
  await module.enqueue('riddle1', 'blocklisted_quizzer', 'url.png')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'riddleRejected' },
    { name: 'downloadContent', riddleId: 'riddle1' } // this tells the adapter we don't need the riddle.
  ])
})

test('multi-riddle test', async () => {
  const mockAdapter = new MockAdapter()
  const module = QuizMaster.makeModule(new MockModuleManager(mockAdapter, new MockUserRepository(), new MockQuizRepository(), multiRiddleConfig))
  await module.resume()

  await module.enqueue('riddle1', 'quizzer1', 'url.png')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'downloadContent', riddleId: 'riddle1' },
    { name: 'newRiddle', quizzerId: 'quizzer1', content: 'content', filename: 'riddle.png' }
  ])

  await module.enqueue('riddle2', 'quizzer2', 'url.png')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'downloadContent', riddleId: 'riddle2' },
    { name: 'newRiddle', quizzerId: 'quizzer2', content: 'content', filename: 'riddle.png' }
  ])

  await module.enqueue('riddle3', 'quizzer3', 'url.png')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'downloadContent', riddleId: 'riddle3' },
    { name: 'newRiddle', quizzerId: 'quizzer3', content: 'content', filename: 'riddle.png' }
  ])

  await module.enqueue('riddle4', 'quizzer4', 'url.png')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'downloadContent', riddleId: 'riddle4' },
    { name: 'addToQueue', riddleId: 'riddle4', authorId: 'quizzer4' }
  ])
})

test('only one riddle per quizzer in multi-riddle', async () => {
  const mockAdapter = new MockAdapter()
  const module = QuizMaster.makeModule(new MockModuleManager(mockAdapter, new MockUserRepository(), new MockQuizRepository(), multiRiddleConfig))
  await module.resume()

  await module.enqueue('riddle1', 'quizzer1', 'url.png')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'downloadContent', riddleId: 'riddle1' },
    { name: 'newRiddle', quizzerId: 'quizzer1', content: 'content', filename: 'riddle.png' }
  ])

  await module.enqueue('riddle2', 'quizzer2', 'url.png')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'downloadContent', riddleId: 'riddle2' },
    { name: 'newRiddle', quizzerId: 'quizzer2', content: 'content', filename: 'riddle.png' }
  ])

  await module.enqueue('riddle3', 'quizzer1', 'url.png')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'downloadContent', riddleId: 'riddle3' },
    { name: 'addToQueue', riddleId: 'riddle3', authorId: 'quizzer1' }
  ])
})

test('multi-riddle continuation test', async () => {
  const mockAdapter = new MockAdapter()
  const mockQuizRepository = new MockQuizRepository()
  mockAdapter.continueExistingRiddles = () => ['quizzer1', 'quizzer2', 'quizzer3']
  mockQuizRepository.getActiveQueue = () => {
    return [{
      id: 'existing0',
      quizzerId: 'quizzer1',
      overflow: false,
      ignore: false,
      priority: 5,
      content: 'whatever'
    }, {
      id: 'existing3',
      quizzerId: 'quizzer4',
      overflow: false,
      ignore: false,
      priority: 8,
      content: 'whatever'
    }, {
      id: 'existing2',
      quizzerId: 'quizzer3',
      overflow: false,
      ignore: false,
      priority: 7,
      content: 'whatever'
    }, {
      id: 'existing1',
      quizzerId: 'quizzer2',
      overflow: false,
      ignore: false,
      priority: 6,
      content: 'whatever'
    }]
  }
  const module = QuizMaster.makeModule(new MockModuleManager(mockAdapter, new MockUserRepository(), mockQuizRepository, multiRiddleConfig))
  await module.resume()

  await module.enqueue('riddle1', 'quizzer1', 'url.png')
  await module.enqueue('riddle2', 'quizzer5', 'url.png')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'downloadContent', riddleId: 'riddle1' },
    { name: 'addToQueue', authorId: 'quizzer1', riddleId: 'riddle1' },
    { name: 'downloadContent', riddleId: 'riddle2' },
    { name: 'addToQueue', authorId: 'quizzer5', riddleId: 'riddle2' }
  ])

  await module.endRiddle('quizzer1', 'quizzer1')
  // queue prioritizes quizzer4 as the next quizzer
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'endRiddle', quizzerId: 'quizzer1' },
    { name: 'newRiddle', quizzerId: 'quizzer4', content: 'whatever', filename: 'riddle.png' }
  ])

  await module.endRiddle('quizzer3', 'admin')
  // queue prioritizes quizzer4 as the next quizzer
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'endRiddle', quizzerId: 'quizzer3' },
    { name: 'newRiddle', quizzerId: 'quizzer5', content: 'content', filename: 'riddle.png' }
  ])
})

test('increase concurrency test', async () => {
  const mockConfig = new Map()
  mockConfig.set('enableLiteratureQuiz', true)
  mockConfig.set('maxConcurrentRiddles', 3)
  mockConfig.set('automaticallyStartQueue', true)

  const mockAdapter = new MockAdapter()
  const mockQuizRepository = new MockQuizRepository()
  mockAdapter.continueExistingRiddles = () => ['quizzer1']
  mockQuizRepository.getActiveQueue = () => {
    return [{
      id: 'existing0',
      quizzerId: 'quizzer1',
      overflow: false,
      ignore: false,
      priority: 5,
      content: 'whatever'
    }, {
      id: 'existing3',
      quizzerId: 'quizzer4',
      overflow: false,
      ignore: false,
      priority: 8,
      content: 'whatever'
    }, {
      id: 'existing2',
      quizzerId: 'quizzer3',
      overflow: false,
      ignore: false,
      priority: 7,
      content: 'whatever'
    }, {
      id: 'existing1',
      quizzerId: 'quizzer2',
      overflow: false,
      ignore: false,
      priority: 6,
      content: 'whatever'
    }]
  }
  const module = QuizMaster.makeModule(new MockModuleManager(mockAdapter, new MockUserRepository(), mockQuizRepository, mockConfig))
  await module.resume()
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'newRiddle', quizzerId: 'quizzer2', content: 'whatever', filename: 'riddle.png' },
    { name: 'newRiddle', quizzerId: 'quizzer3', content: 'whatever', filename: 'riddle.png' }
  ])
})

test('decrease concurrency test', async () => {
  const mockAdapter = new MockAdapter()
  const mockQuizRepository = new MockQuizRepository()
  mockAdapter.continueExistingRiddles = () => ['quizzer1', 'quizzer2', 'quizzer3']
  mockQuizRepository.getActiveQueue = () => {
    return [{
      id: 'existing0',
      quizzerId: 'quizzer1',
      overflow: false,
      ignore: false,
      priority: 5,
      content: 'whatever'
    }, {
      id: 'existing3',
      quizzerId: 'quizzer4',
      overflow: false,
      ignore: false,
      priority: 8,
      content: 'whatever'
    }, {
      id: 'existing2',
      quizzerId: 'quizzer3',
      overflow: false,
      ignore: false,
      priority: 7,
      content: 'whatever'
    }, {
      id: 'existing1',
      quizzerId: 'quizzer2',
      overflow: false,
      ignore: false,
      priority: 6,
      content: 'whatever'
    }]
  }
  const module = QuizMaster.makeModule(new MockModuleManager(mockAdapter, new MockUserRepository(), mockQuizRepository, singleRiddleConfig))
  await module.resume()

  await module.endRiddle('quizzer1', 'quizzer1')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'endRiddle', quizzerId: 'quizzer1' }
  ])

  await module.endRiddle('quizzer3', 'quizzer3')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'endRiddle', quizzerId: 'quizzer3' }
  ])

  await module.endRiddle('quizzer2', 'quizzer2')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'endRiddle', quizzerId: 'quizzer2' },
    { name: 'newRiddle', quizzerId: 'quizzer4', content: 'whatever', filename: 'riddle.png' }
  ])
})

test('correct extension returned', async () => {
  const mockAdapter = new MockAdapter()
  const module = QuizMaster.makeModule(new MockModuleManager(mockAdapter, new MockUserRepository(), new MockQuizRepository(), singleRiddleConfig))
  await module.resume()

  await module.enqueue('riddle1', 'quizzer1', 'url.mp3')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'downloadContent', riddleId: 'riddle1' },
    { name: 'newRiddle', quizzerId: 'quizzer1', content: 'content', filename: 'riddle.mp3' }
  ])

  await module.onCorrectAnswer('guesser1', 'guess', 'quizzer1', 'quizzer1')
  expect(mockAdapter.getCalls()).toStrictEqual([
    { name: 'correctAnswer', guesserId: 'guesser1', guess: 'guess', reactorId: 'quizzer1', newScore: 42 },
    { name: 'endRiddle', quizzerId: 'quizzer1' },
    { name: 'queueEmpty' }
  ])
})
