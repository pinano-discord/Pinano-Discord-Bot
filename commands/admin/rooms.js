// usage:
//
// p!rooms
//   - displays all registered practice rooms, their lock status, the members present
//     in each room, their liveness status, and whether or not they are a ghost user
// p!rooms add <#CHANNEL_ID>
//   - registers a VoiceChannel as a practice room
// p!rooms [del|delete] <#CHANNEL_ID>
//   - unregisters a VoiceChannel as a practice room

module.exports.load = (client) => {
  client.commands['rooms'] = {
    async run (message) {
      if (!message.member.roles.find(r => r.name === 'Bot Manager')) {
        return client.errorMessage(message, 'You require the bot manager role to use this command.')
      }

      let guildInfo = await client.loadGuildData(message.guild.id)
      if (guildInfo == null) {
        return client.errorMessage(message, 'No data for this guild.')
      }

      let args = message.content.split(' ').splice(1)
      if (args.length !== 0) {
        let usageStr = `Usage: \`${client.settings.prefix}rooms [ [ add | del | delete ] <#CHANNEL_ID> ]\``
        if (args.length !== 2) {
          return client.errorMessage(message, usageStr)
        }

        if (!args[1].startsWith('<#') || !args[1].endsWith('>')) {
          return client.errorMessage(message, usageStr)
        }

        let chanId = args[1].replace(/[<#>]/g, '')
        switch (args[0]) {
          case 'add':
          {
            if (guildInfo['permitted_channels'].includes(chanId)) {
              return client.errorMessage(message, `${args[1]} is already registered.`)
            }

            guildInfo['permitted_channels'].push(chanId)
            await client.writeGuildData(message.guild.id, guildInfo)

            let m = await message.reply(`added ${args[1]} to practice channels.`)
            setTimeout(() => m.delete(), client.settings.res_destruct_time * 1000)
            return
          }
          case 'del':
          case 'delete':
          {
            if (!guildInfo['permitted_channels'].includes(chanId)) {
              return client.errorMessage(message, `${args[1]} is not currently registered.`)
            }

            guildInfo['permitted_channels'].splice(guildInfo.permitted_channels.indexOf(chanId), 1)
            await client.writeGuildData(message.guild.id, guildInfo)

            let m = await message.reply(`removed ${args[1]} from practice channels.`)
            setTimeout(() => m.delete(), client.settings.res_destruct_time * 1000)
            return
          }
          default:
            return client.errorMessage(message, usageStr)
        }
      } else {
        let msg = `Currently registered practice rooms:\n\`\`\`\n`
        guildInfo.permitted_channels
          .map(chanId => message.guild.channels.get(chanId))
          .filter(chan => chan != null)
          .sort((x, y) => x.position > y.position)
          .forEach(chan => {
            msg += `${chan.name}`
            if (chan.name === 'Extra Practice Room') {
              msg += ` (channel ID: ${chan.id})`
            }

            if (chan.locked_by != null) {
              let occupant = chan.members.get(`${chan.locked_by}`)
              msg += ` LOCKED by ${occupant.user.username}#${occupant.user.discriminator}`
            }

            chan.members.forEach(m => {
              msg += `\n  - ${m.user.username}#${m.user.discriminator}`
              if (m.deleted) {
                msg += ` (GHOST)`
              }

              if (m.s_time != null) {
                msg += ` (LIVE)`
              }
            })

            msg += '\n'
          })

        msg += `\`\`\``
        message.channel.send(msg)
      }
    }
  }
}
