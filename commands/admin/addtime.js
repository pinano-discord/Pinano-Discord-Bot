module.exports.load = (client) => {
  client.commands['addtime'] = {
    run (message) {
      let args = message.content.split(' ').splice(1)
      if (message.member.hasPermission('BAN_MEMBERS') === false) return client.errorMessage(message, `You must have \`BAN_MEMBERS\` permission to use.`)
      if (args.length !== 2) return client.errorMessage(message, 'Invalid usage.')
      if (!args[0].startsWith('<@') || !args[0].includes('>')) return client.errorMessage(message, 'Invalid user.')
      if (!Number.isInteger(parseInt(args[1]))) return client.errorMessage(message, 'Invalid seconds to add.')
      client.loadUserData(args[0].replace(/[<@!>]/g, ''), async res => {
        if (res === null) return client.errorMessage(message, 'User doesn\'t exist in DB')
        res.current_session_playtime += parseInt(args[1])
        res.overall_session_playtime += parseInt(args[1])
        client.writeUserData(args[0].replace(/[<@!>]/g, ''), res, () => {
          message.reply('Added time to user.')
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
