const cron = require('node-cron')
let Discord = require('discord.js')

let client = new Discord.Client()

// client appends
client.settings = require('./settings/settings.json')
client.discord = Discord
client.fs = require('fs')
client.jimp = require('jimp')

// check devmode state
if (client.settings.dev_mode) {
  client.settings.token = client.settings.beta_token
  client.settings.prefix = client.settings.beta_prefix
}

// Require client events and functions
require('./library/client_functions.js')(client)
require('./library/client_events.js')(client)
require('./library/database_lib.js')(client)

// weekly wipe at 12 am on monday
cron.schedule('0 0 * * mon', () => {
  client.submitweek()
  client.clearWeekResults()
  client.log('Cleared weekly results')
})

// init
client.login(client.settings.token)
