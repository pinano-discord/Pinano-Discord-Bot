const Discord = require('discord.js')
const cron = require('node-cron')
const settings = require('./settings/settings.json')
const { connect, makeUser } = require('./library/persistence')

let client = new Discord.Client({ fetchAllMembers: true })

if (process.env.PINANO_TOKEN !== undefined) {
  settings.token = process.env.PINANO_TOKEN
}
if (process.env.PINANO_PREFIX !== undefined) {
  settings.prefix = process.env.PINANO_PREFIX
}
if (process.env.PINANO_DEFAULT_BITRATE !== undefined) {
  settings.default_bitrate = process.env.PINANO_DEFAULT_BITRATE
}

require('./library/client_functions.js')(client)
client.log('Loaded client functions')

require('./library/client_events.js')(client)
client.log('Loaded client events')

// weekly wipe at midnight on Monday (local time zone)
cron.schedule('0 0 * * mon', async () => {
  await client.submitWeek()
  await client.userRepository.resetSessionTimes()
  client.log('Cleared weekly results')
})

connect('mongodb://localhost:27017/', 'pinano').then(mongoManager => {
  client.log('Connected to database')

  client.userRepository = mongoManager.newUserRepository()
  client.makeUser = makeUser
  client.login(settings.token)
    .catch((error) => {
      client.log(error)
      process.exit(1)
    })
})
