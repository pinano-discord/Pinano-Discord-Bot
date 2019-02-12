const cron = require('node-cron')
const { Discord } = require('discord.js')

const { log } = require('library/logging')
const { connect, shutdown, makeUser, makeGuild } = require('library/persistence')

const App = {
  client: new Discord.Client()
  settings: require('./settings/settings.json')
}

async function main () {
  const { userRepository, guildRepository } = await connect("mongodb://localhost:27017/", "pinano")
  App.client.login(App.settings.token)
    .catch(error => {
      log(error)
      process.exit(1)
    })
}
