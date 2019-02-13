const cron = require('node-cron')
const { Discord } = require('discord.js')

const { log } = require('library/logging')
const { connect, makeUser, makeGuild } = require('library/persistence')

const App = {
  client: new Discord.Client(),
  settings: require('./settings/settings.json')
}

async function main () {
  const { userRepository, guildRepository } = await connect('mongodb://localhost:27017/', 'pinano')
  App.userRepository = userRepository
  App.guildRepository = guildRepository
  App.makeUser = makeUser
  App.makeGuild = makeGuild

  cron.schedule('0 0 * * mon', () => {
    App.submitweek()
    App.userRepository.resetSessionTimes()
    console.log('Cleared weekly results')
  })

  App.client.login(App.settings.token)
    .catch(error => {
      log(error)
      process.exit(1)
    })
}

main()
