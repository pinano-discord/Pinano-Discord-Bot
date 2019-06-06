module.exports.load = (client) => {
  client.commands['help'] = {
    async run (message) {
      let isBotManager = message.member.roles.find('name', 'Bot Manager')

      let msg = new client.discord.RichEmbed()
      msg.setTitle('Help')
      msg.addField(`\`${client.settings.prefix}help\``,
        'Displays this help message')
      msg.addField(`\`${client.settings.prefix}stats [username#discriminator]\``,
        'Displays practice statistics for the specified user (default: calling user)')
      msg.addField(`\`${client.settings.prefix}lb, ${client.settings.prefix}leaderboard [ weekly | overall ]\``,
        'Displays the weekly or overall leaderboard (default: weekly)')

      if (isBotManager) {
        msg.addField(`\`${client.settings.prefix}unlock [<#channel_id>]\``,
          'Unlocks the specified room for shared use (default: currently occupied room)')
      } else {
        msg.addField(`\`${client.settings.prefix}unlock\``,
          'Unlocks the currently occupied room for shared use')
      }

      msg.addField(`\`${client.settings.prefix}info\``,
        'Displays information about the Discord server')
      msg.addField(`\`${client.settings.prefix}lock\``,
        'Locks the currently occupied room for exclusive use')

      if (isBotManager) {
        msg.addField(`\`${client.settings.prefix}settings\``,
          'Displays/modifies bot settings (including registering/unregistering practice rooms)')
        msg.addField(`\`${client.settings.prefix}addtime @user [time_in_seconds]\``,
          'Adds practice time to a user\'s record')
        msg.addField(`\`${client.settings.prefix}deltime @user [time_in_seconds]\``,
          'Removes practice time from a user\'s record')
      }

      msg.setColor(client.settings.embed_color)
      msg.setTimestamp()
      message.author.send(msg)

      let m = await message.reply('sent you the command list.')
      setTimeout(() => m.delete(), 3000)
    }
  }
}
