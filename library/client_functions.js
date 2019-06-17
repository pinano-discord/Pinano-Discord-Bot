const moment = require('moment')
const promisify = require('util').promisify
const readdir = promisify(require('fs').readdir)
const Discord = require('discord.js')
const settings = require('./settings/settings.json')

module.exports = client => {
  client.log = (string) => {
    console.log(`${moment().format('MMMM Do YYYY, h:mm:ss a')} :: ${string}`)
  }

  client.commandExist = (message) => {
    let tokenized = message.content.split(' ')
    if (tokenized[0].replace(settings.prefix, '').replace(/[<@!>]/g, '') === client.user.id) {
      return client.commands[tokenized[1].replace(settings.prefix, '')]
    } else {
      return client.commands[tokenized[0].replace(settings.prefix, '')]
    }
  }

  client.isValidCommand = (message) => {
    return message.content.startsWith(settings.prefix) || message.content.replace(/[<@!>]/g, '').startsWith(`${client.user.id}`)
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

    let loadCommands = require('../commands.js')
    loadCommands(client)
  }

  client.errorMessage = async (message, response) => {
    let m = await message.channel.send({
      embed: {
        title: 'Error',
        description: response,
        color: settings.embed_color,
        timestamp: new Date()
      }
    })

    setTimeout(() => m.delete(), settings.res_destruct_time * 1000)
  }

  client.unlockPracticeRoom = async (guild, userId, channel) => {
    channel.locked_by = null

    // remove permissions overrides
    let everyone = guild.roles.find(r => r.name === '@everyone')
    channel.overwritePermissions(everyone, { SPEAK: null })

    let personalOverride = channel.permissionOverwrites.get(userId)
    // existingOverride shouldn't be null unless someone manually deletes the override, but if for some reason it's gone, no big deal, just move on.
    if (personalOverride != null) {
      if (personalOverride.allowed.bitfield === Discord.Permissions.FLAGS.SPEAK && personalOverride.denied.bitfield === 0) { // the only permission was allow SPEAK
        personalOverride.delete()
      } else {
        channel.overwritePermissions(userId, { SPEAK: null })
      }
    }

    try {
      await Promise.all(channel.members.map(async m => {
        if (!m.deleted && !m.roles.some(r => r.name === 'Temp Muted')) {
          return m.setMute(false)
        }
      }))
    } catch (err) {
      // this is likely an issue with trying to mute a user who has already left the channel
      console.log(err)
    }
  }
}
