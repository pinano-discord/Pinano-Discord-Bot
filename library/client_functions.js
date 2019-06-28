const Discord = require('discord.js')
const moment = require('moment')
const settings = require('../settings/settings.json')

module.exports = client => {
  client.log = (string) => {
    console.log(`${moment().format('MMMM Do YYYY, h:mm:ss a')} :: ${string}`)
  }

  client.loadCommands = async () => {
    let loadCommands = require('../commands.js')
    loadCommands(client)

    require('../eval.js').load(client)
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
      client.log(err)
    }
  }
}
