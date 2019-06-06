module.exports.load = (client) => {
  client.commands['rooms'] = {
    async run (message) {
      if (!message.member.roles.find('name', 'Bot Manager')) {
        return client.errorMessage(message, 'You require the bot manager role to use this command.')
      }

      let guildInfo = await client.loadGuildData(message.guild.id)
      if (guildInfo == null) {
        return client.errorMessage(message, 'No data for this guild.')
      }

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
