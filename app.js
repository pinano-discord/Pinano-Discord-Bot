const cron = require('node-cron')
let Discord = require('discord.js')
const { connect, makeUser, makeGuild } = require('./library/persistence')

let client = new Discord.Client({ fetchAllMembers: true })

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

require('./library/client_events.js')(client)
client.log(`Loaded client events`)

// weekly wipe at 12 am on monday
cron.schedule('0 0 * * mon', async () => {
  await client.submitWeek()
  await client.userRepository.resetSessionTimes()
  client.log('Cleared weekly results')
}, {
  timezone: 'America/New_York'
})

connect('mongodb://localhost:27017/', 'pinano').then(mongoManager => {
  client.log(`Connected Database`)
  require('./library/leaderboard_fetch.js')(client, mongoManager.db)
  client.log(`loaded legacy leaderboard library`)

  client.userRepository = mongoManager.newUserRepository()
  client.guildRepository = mongoManager.newGuildRepository()
  client.makeUser = makeUser
  client.makeGuild = makeGuild
  client.login(client.settings.token)
    .catch((error) => {
      client.log(error)
      process.exit(1)
    })
})
