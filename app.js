const cron = require('node-cron')
let Discord = require('discord.js')
const { connect, shutdown, makeUser, makeGuild } = require('library/persistence')

let client = new Discord.Client()

// client appends
client.settings = require('./settings/settings.json')
client.discord = Discord

// check devmode state
if (client.settings.dev_mode) {
  client.settings.token = client.settings.beta_token
  client.settings.prefix = client.settings.beta_prefix
}

require('./library/client_functions.js')(client)
client.log(`Loaded client functions`)
require('./library/database_lib.js')(client)
client.log(`Loaded database functions`)

require('./library/client_events.js')(client)
client.log(`Loaded client events`)

let oldConnect = () => {
  return new Promise(resolve => {
    client.connectDB(db => resolve(db))
  })
}

// weekly wipe at 12 am on monday
cron.schedule('0 0 * * mon', () => {
  client.submitweek()
  client.clearWeekResults()
  client.log('Cleared weekly results')
})

connect("mongodb://localhost:27017/", "pinano").then((userRepository, guildRepository) => {
  client.log(`Connected Database`)
  client.userRepository = userRepository
  client.guildRepository = guildRepository
  client.makeUser = makeUser
  client.makeGuild = makeGuild
  client.login(client.settings.token)
    .catch((error) => {
      client.log(error)
      process.exit(1)
    })
})

oldConnect().then(db => {
  client.log(`Connected Database`)
  require('./library/leaderboard_fetch.js')(client, db)
  client.log(`loaded leaderboard library`)

  client.login(client.settings.token)
    .catch((error) => {
      client.log(error)
      process.exit(1)
    })
})
