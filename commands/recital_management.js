const settings = require('../settings/settings.json')
const {
  requireRole, requireParameterCount, requireParameterFormat,
  selfDestructMessage
} = require('./helpers')

async function recital (client, message) {
  requireRole(message.member, 'Recital Manager', 'You require the Recital Manager role to use this command.')

  let args = message.content.split(' ').splice(1)
  let usageStr = `${settings.prefix}recital(s) [ add | del(ete) | rem(ove) ] @user RECITAL_ID`
  requireParameterCount(args, 3, usageStr)
  requireParameterFormat(args[1], arg => arg.startsWith('<@') && arg.endsWith('>'), usageStr)

  let userId = args[1].replace(/[<@!>]/g, '')
  let userInfo = await client.userRepository.load(userId)
  if (userInfo == null) {
    userInfo = {
      'id': userId,
      'current_session_playtime': 0,
      'overall_session_playtime': 0
    }

    await client.userRepository.save(userInfo)
  }

  switch (args[0]) {
    case 'add':
    {
      await client.userRepository.addToField(userInfo, 'recitals', args[2])
      selfDestructMessage(() => message.reply(`added recital to user.`))
      return
    }
    case 'del':
    case 'delete':
    case 'rem':
    case 'remove':
    {
      await client.userRepository.removeFromField(userInfo, 'recitals', args[2])
      selfDestructMessage(() => message.reply(`removed recital from user.`))
      return
    }
    default:
      throw new Error(`Usage: \`${usageStr}\``)
  }
}

module.exports = { recital }
