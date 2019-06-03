module.exports.load = (client) => {
  client.commands['unlock'] = {
    async run (message) {
      let args = message.content.split(' ').splice(1)
      let channel
      if (args.length >= 1) {
        if (!message.member.roles.find('name', 'Bot Manager')) {
          return client.errorMessage(message, 'You must be a Bot Manager to unlock other rooms.')
        }

        channel = client.channels.get(args[0].replace(/[<#>]/g, ''))
      } else {
        channel = message.member.voiceChannel
        if (channel == null) {
          return client.errorMessage(message, 'You are not currently in a channel.')
        }
      }

      if (channel.locked_by !== message.author.id && !message.member.roles.find('name', 'Bot Manager')) {
        return client.errorMessage(message, 'You do not have this channel locked.')
      }

      await client.unlockPracticeRoom(message.guild, channel.locked_by, channel)

      let m = await message.reply(`unlocked channel <#${channel.id}>.`)
      setTimeout(() => m.delete(), client.settings.res_destruct_time * 1000)
    }
  }
}
