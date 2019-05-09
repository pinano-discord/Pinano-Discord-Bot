const moment = require('moment')
const promisify = require('util').promisify
const readdir = promisify(require('fs').readdir)

module.exports = client => {
  client.log = (string) => {
    console.log(`${moment().format('MMMM Do YYYY, h:mm:ss a')} :: ${string}`)
  }

  client.commandExist = (message) => {
    let tokenized = message.content.split(' ')
    if (tokenized[0].replace(client.settings.prefix, '').replace(/[<@!>]/g, '') === client.user.id) {
      return client.commands[tokenized[1].replace(client.settings.prefix, '')]
    } else {
      return client.commands[tokenized[0].replace(client.settings.prefix, '')]
    }
  }

  client.isValidCommand = (message) => {
    return message.content.startsWith(client.settings.prefix) || message.content.replace(/[<@!>]/g, '').startsWith(`${client.user.id}`)
  }

  client.loadCommands = async () => {
    client.commands = {}
    try {
      let files = await readdir('./commands/general/')
      await Promise.all(files.map(async file => {
        if (file.endsWith('.js')) {
          require(`../commands/general/${file}`).load(client)
        }
      }))
    } catch (err) {
      client.log(`Error loading general commands : ${err}`)
    }

    try {
      let files = await readdir('./commands/admin/')
      await Promise.all(files.map(async (file) => {
        if (file.endsWith('.js')) {
          require(`../commands/admin/${file}`).load(client)
        }
      }))
    } catch (err) {
      client.log(`Error loading admin commands : ${err}`)
    }
  }

  client.successMessage = async (message, response) => {
    let m = await message.channel.send({
      embed: {
        title: 'Success',
        description: response,
        color: client.settings.embed_color,
        timestamp: new Date()
      }
    })

    setTimeout(() => m.delete(), client.settings.res_destruct_time * 1000)
  }

  client.errorMessage = async (message, response) => {
    let m = await message.channel.send({
      embed: {
        title: 'Error',
        description: response,
        color: client.settings.embed_color,
        timestamp: new Date()
      }
    })

    setTimeout(() => m.delete(), client.settings.res_destruct_time * 1000)
  }
}
