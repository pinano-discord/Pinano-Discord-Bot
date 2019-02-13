const { connect, shutdown, makeUser, _getDatabase } = require('../library/persistence')

let userRepository
let guildRepository

beforeAll(async () => {
  let results = await connect('mongodb://localhost:27017', 'test_db')
  userRepository = results.userRepository
  guildRepository = results.guildRepository
})
afterAll(shutdown)

beforeEach(async () => {
  await _getDatabase().dropDatabase()
})

test('connects to mongo', async () => {
  expect(userRepository).not.toBeNull()
  expect(guildRepository).not.toBeNull()
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
  await createSomeUsers(10, () => randomInt(0, 3600))
  let topThree = await userRepository.loadTopSession(3)

  expect(topThree).toHaveLength(3)
  expect(topThree[0].current_session_playtime)
    .toBeGreaterThan(topThree[1].current_session_playtime)
  expect(topThree[1].current_session_playtime)
    .toBeGreaterThan(topThree[2].current_session_playtime)
})

test('can get overall rank', async () => {
  await createSomeUsers(10, () => randomInt(0, 3600))
  let topTen = await userRepository.loadTopOverall(10)
  for (let expectedRank = 0; expectedRank < topTen.length; expectedRank++) {
    let rank = await userRepository.getOverallPos(topTen[expectedRank].id)
    expect(rank).toBe(expectedRank)
  }
})

test('can get session rank', async () => {
  await createSomeUsers(10, () => randomInt(0, 3600))
  let topTen = await userRepository.loadTopSession(10)
  for (let expectedRank = 0; expectedRank < topTen.length; expectedRank++) {
    let rank = await userRepository.getSessionPos(topTen[expectedRank].id)
    expect(rank).toBe(expectedRank)
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
