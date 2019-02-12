const { connect, shutdown, makeUser, makeGuild, _getDatabase } = require("../library/persistence")

let userRepository
let guildRepository

beforeAll(async () => {
  results = await connect("mongodb://localhost:27017", "test_db")
  await _getDatabase().dropDatabase()
  userRepository = results.userRepository
  guildRepository = results.guildRepository
})
afterAll(shutdown)

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
  topThree = await userRepository.loadTopSession(3)

  expect(topThree).toHaveLength(3)
  expect(topThree[0].current_session_playtime)
    .toBeGreaterThan(topThree[1].current_session_playtime)
  expect(topThree[1].current_session_playtime)
    .toBeGreaterThan(topThree[2].current_session_playtime)
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

function randomInt(low, high) {
  return Math.floor(Math.random() * (high - low) + low)
}

function createSomeUsers (n, currentPlaytimeFn) {
  let promises = []
  for (let i = 0; i < n; i++) {
    const user = makeUser(randomInt(1, 100))
    user.current_session_playtime = currentPlaytimeFn()
    promises.push(userRepository.save(user))
  }
  return Promise.all(promises)
}
