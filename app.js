const Discord = require('discord.js')
const cron = require('node-cron')
const settings = require('./settings/settings.json')
const { connect, makeUser, makeGuild } = require('./library/persistence')

let client = new Discord.Client({ fetchAllMembers: true })

// check devmode state
if (settings.dev_mode) {
  settings.token = settings.beta_token
  settings.prefix = settings.beta_prefix
}

require('./library/client_functions.js')(client)
client.log('Loaded client functions')

require('./library/client_events.js')(client)
client.log('Loaded client events')

require('./library/leaderboard.js')(client)
client.log('Loaded leaderboard library')

// weekly wipe at midnight on Monday (local time zone)
cron.schedule('0 0 * * mon', async () => {
  await client.submitWeek()
  await client.userRepository.resetSessionTimes()
  client.log('Cleared weekly results')
})

connect('mongodb://localhost:27017/', 'pinano').then(mongoManager => {
  client.log('Connected to database')

  client.userRepository = mongoManager.newUserRepository()
  client.guildRepository = mongoManager.newGuildRepository()
  client.makeUser = makeUser
  client.makeGuild = makeGuild
  client.login(settings.token)
    .catch((error) => {
      client.log(error)
      process.exit(1)
    })
})
