const { connect, shutdown, makeUser, makeGuild } = require("../library/persistence")

let userRepository
let guildRepository

beforeAll(async () => {
  results = await connect("mongodb://localhost:27017", "test_db")
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

test('can load user', async () => {
  const newUser = makeUser(1)
  await userRepository.save(newUser)
  newUser.current_session_playtime = 12345

  let user = await userRepository.load(1)
  expect(user.id).toBe(1)
  expect(user.current_session_playtime).toBe(0)
})

test('can load top users', async () => {
  const user1 = makeUser(1)
  user1.current_session_playtime = 100
  save1 = userRepository.save(user1)

  const user2 = makeUser(2)
  user2.current_session_playtime = 50
  save2 = userRepository.save(user2)

  const user3 = makeUser(3)
  user3.current_session_playtime = 150
  save3 = userRepository.save(user3)

  const user4 = makeUser(4)
  user4.current_session_playtime = 5 
  save4 = userRepository.save(user4)

  const user5 = makeUser(5)
  user5.current_session_playtime = 25 
  save5 = userRepository.save(user5)

  await Promise.all([save1, save2, save3, save4, save5])

  topThree = await userRepository.loadTopSession(3)
  expect(topThree).toHaveLength(3)
  expect(topThree[0].id).toBe(3)
  expect(topThree[1].id).toBe(1)
  expect(topThree[2].id).toBe(2)
})
