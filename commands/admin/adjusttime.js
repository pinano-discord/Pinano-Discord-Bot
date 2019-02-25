module.exports.load = (client) => {
  client.commands['addtime'] = {
    async run (message) {
      return handler(message)
    }
  }

  client.commands['deltime'] = {
    async run (message) {
      let shouldNegate = true
      return handler(message, shouldNegate)
    }
  }

  function handler (message, shouldNegate = false) {
    if (!message.member.roles.find(r => r['name'] === 'Bot Manager')) {
      return client.errorMessage(message, `You require the bot manager role to use this command.`)
    }

    let args = message.content.split(' ').splice(1)
    if (args.length !== 2) {
      return client.errorMessage(message, 'Invalid usage.')
    }

    if (!args[0].startsWith('<@') || !args[0].endsWith('>')) {
      return client.errorMessage(message, 'Invalid user.')
    }
    let userIdArg = args[0].replace(/[<@!>]/g, '')

    let delta = parseInt(args[1])
    if (!Number.isInteger(delta)) {
      return client.errorMessage(message, 'Invalid seconds arg.')
    }

    return adjustTime(message, userIdArg, shouldNegate ? -delta : delta)
  }

  async function adjustTime (message, userId, delta) {
    let user = await client.userRepository.load(userId)
    if (user === null) {
      return client.errorMessage(message, `User <@${userId}> doesn't exist in DB`)
    }

    user.current_session_playtime = Math.max(0, user.current_session_playtime + delta)
    user.overall_session_playtime = Math.max(0, user.overall_session_playtime + delta)

    return client.userRepository.save(user).then(res => {
      client.successMessage(message, `Applied ${delta}s to <@${userId}>.`)
    }).catch(err => {
      client.errorMessage(message, `Unable to modify <@${userId}> time: ${err}`)
    })
  }
}
