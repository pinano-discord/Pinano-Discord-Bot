module.exports.load = (client) => {
  client.commands['deltime'] = {
    run (message) {
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
      client.loadUserData(args[0].replace(/[<@!>]/g, ''), async res => {
        if (res === null) {
          return client.errorMessage(message, 'User doesn\'t exist in DB')
        }

        res.current_session_playtime = Math.max(0, res.current_session_playtime - delta)
        res.overall_session_playtime = Math.max(0, res.overall_session_playtime - delta)
        client.writeUserData(args[0].replace(/[<@!>]/g, ''), res, () => {
          message.reply('Removed time from user.')
            .then(m => {
              setTimeout(() => {
                m.delete()
              }, client.settings.res_destruct_time * 1000)
            })
        })
      })
    }
  }
}
