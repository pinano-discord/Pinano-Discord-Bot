module.exports.load = (client) => {
  client.commands['addtime'] = {
    async run (message) {
      let args = message.content.split(' ').splice(1)
      if (!message.member.roles.find('name', 'Bot Manager')) {
        return client.errorMessage(message, `You require the bot manager role to use this command.`)
      }

      if (args.length !== 2) {
        return client.errorMessage(message, 'Invalid usage.')
      }

      if (!args[0].startsWith('<@') || !args[0].endsWith('>')) {
        return client.errorMessage(message, 'Invalid user.')
      }

      if (!Number.isInteger(parseInt(args[1]))) {
        return client.errorMessage(message, 'Invalid seconds to add.')
      }

      let delta = parseInt(args[1])
      let userInfo = await client.loadUserData(args[0].replace(/[<@!>]/g, ''))
      if (userInfo == null) {
        return client.errorMessage(message, 'User doesn\'t exist in DB')
      }

      userInfo.current_session_playtime += delta
      userInfo.overall_session_playtime += delta
      await client.writeUserData(args[0].replace(/[<@!>]/g, ''), userInfo)
      let m = await message.reply('added time to user.')
      setTimeout(() => m.delete(), client.settings.res_destruct_time * 1000)
    }
  }
}
