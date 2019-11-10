const { connect, makeUser } = require('../library/persistence')

let mongoManager
let userRepository

beforeAll(async () => {
  mongoManager = await connect('mongodb://localhost:27017', 'test_db', { socketTimeoutMS: 500 })
  userRepository = mongoManager.newUserRepository()
})
beforeEach(async () => {
  await mongoManager.dropDatabase()
})
afterAll(async () => {
  await mongoManager.shutdown()
})

test('connects to mongo', async () => {
  expect(userRepository).not.toBeNull()
})

test('can store user', async () => {
  const newUser = makeUser(1)
  return expect(userRepository.save(newUser)).resolves.not.toBeNull()
})

test('return null for missing user', async () => {
  const existingUser = await userRepository.load(987654321)
  expect(existingUser).toBeNull()
})

test('can load user', async () => {
  const newUser = makeUser(1)
  await userRepository.save(newUser)
  newUser.current_session_playtime = 12345

  let user = await userRepository.load(1)
  expect(user.id).toBe(1)
  expect(user.current_session_playtime).toBe(0)
})

test('can load top users', async () => {
  await createSomeUsers(10, () => randomInt(1, 3600))
  let topThree = await userRepository.loadTopSession(3)

  expect(topThree).toHaveLength(3)
  expect(topThree[0].current_session_playtime)
    .toBeGreaterThan(topThree[1].current_session_playtime)
  expect(topThree[1].current_session_playtime)
    .toBeGreaterThan(topThree[2].current_session_playtime)
})

test('can get overall rank', async () => {
  await createSomeUsers(10, () => randomInt(1, 3600))
  let topTen = await userRepository.loadTopOverall(10)
  for (let expectedRank = 1; expectedRank <= topTen.length; expectedRank++) {
    let rank = await userRepository.getOverallRank(topTen[expectedRank - 1].id)
    expect(rank).toBe(expectedRank)
  }
})

test('session rank with zero time is undefined', async () => {
  const user = makeUser(314159)
  await userRepository.save(user)

  let rank = await userRepository.getSessionRank(user.id)
  expect(rank).toBeUndefined()
})

test('can get session rank by user', async () => {
  await createSomeUsers(10, () => randomInt(1, 3600))
  let topTen = await userRepository.loadTopSession(10)
  for (let expectedRank = 1; expectedRank <= topTen.length; expectedRank++) {
    let rank = await userRepository.getSessionRank(topTen[expectedRank - 1].id)
    expect(rank).toBe(expectedRank)
  }
})

test('session rank ignores zero practice time users', async () => {
  await createSomeUsers(5, () => randomInt(1, 3600))
  await createSomeUsers(10, () => 0)

  let topUsers = await userRepository.loadTopSession(10)

  expect(topUsers).toHaveLength(5)
  for (let user of topUsers) {
    expect(user.current_session_playtime).not.toBe(0)
  }
})

test('overall rank ignores zero practice time users', async () => {
  await createSomeUsers(5, () => randomInt(1, 3600))
  await createSomeUsers(10, () => 0)

  let topUsers = await userRepository.loadTopOverall(10)

  expect(topUsers).toHaveLength(5)
  for (let user of topUsers) {
    expect(user.overall_session_playtime).not.toBe(0)
  }
})

test('can reset session times', async () => {
  await createSomeUsers(10, () => 3600) // everyone has an hour

  await userRepository.resetSessionTimes()

  let topUsers = await userRepository.loadTopSession(100)
  for (let user of topUsers) {
    expect(user.id).not.toBe(0)
    expect(user.current_session_playtime).toBe(0)
  }
})

function randomInt (low, high) {
  return Math.floor(Math.random() * (high - low) + low)
}

let totalUsers = 0
function createSomeUsers (n, currentPlaytimeFn) {
  let promises = []
  for (let i = 0; i < n; i++) {
    const user = makeUser(++totalUsers)
    user.current_session_playtime = currentPlaytimeFn()
    user.overall_session_playtime = currentPlaytimeFn() + user.current_session_playtime
    promises.push(userRepository.save(user))
  }
  return Promise.all(promises)
}
