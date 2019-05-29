module.exports.load = (client) => {
  client.commands['lock'] = {
    async run (message) {
      var channel = message.member.voiceChannel
      if (channel == null) {
        return client.errorMessage(message, 'You are not currently in a channel.')
      }

      let guildInfo = await client.loadGuildData(message.guild.id)
      if (!guildInfo.permitted_channels.includes(message.member.voiceChannelID)) {
        return client.errorMessage(message, 'This channel is not a registered practice room.')
      }

      if (channel.locked_by != null) {
        return client.errorMessage(message, 'This channel is already locked.')
      }

      channel.locked_by = message.author.id
      channel.overwritePermissions(message.author, { SPEAK: true })
      let everyone = message.guild.roles.find('name', '@everyone')
      channel.overwritePermissions(everyone, { SPEAK: false }) // deny everyone speaking permissions
      try {
        await Promise.all(channel.members.map(async (m) => {
          if (m !== message.member) {
            return m.setMute(true)
          }
        }))
      } catch (err) {
        // this is likely an issue with trying to mute a user who has already left the channel
        console.log(err)
      }

      let m = await message.reply(`locked channel <#${channel.id}>.`)
      setTimeout(() => m.delete(), client.settings.res_destruct_time * 1000)
    }
  }
}
