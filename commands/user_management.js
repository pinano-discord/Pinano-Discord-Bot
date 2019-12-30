const settings = require('../settings/settings.json')
const {
  requireRole,
  requireParameterCount,
  requireParameterFormat,
  selfDestructMessage
} = require('./helpers')

async function addtime (client, message) {
  requireRole(message.member)

  let args = message.content.split(' ').splice(1)
  let usageStr = `${settings.prefix}addtime @user TIME_IN_SECONDS`
  requireParameterCount(args, 2, usageStr)
  requireParameterFormat(args[0], arg => arg.startsWith('<@') && arg.endsWith('>'), usageStr)
  requireParameterFormat(args[1], arg => Number.isInteger(parseInt(arg)), usageStr)

  let delta = parseInt(args[1])
  let userInfo = await client.userRepository.load(args[0].replace(/[<@!>]/g, ''))
  if (userInfo == null) {
    throw new Error('The user was not found in the database.')
  }

  userInfo.current_session_playtime += delta
  userInfo.overall_session_playtime += delta
  await client.userRepository.save(userInfo)

  client.log(`Add ${delta} time for user <@${userInfo.id}> by <@${message.member.user.id}> ${message.member.user.username}#${message.member.user.discriminator}`)
  selfDestructMessage(() => message.reply('added time to user.'))
}

async function deltime (client, message) {
  requireRole(message.member)

  let args = message.content.split(' ').splice(1)
  let usageStr = `${settings.prefix}deltime @user TIME_IN_SECONDS`
  requireParameterCount(args, 2, usageStr)
  requireParameterFormat(args[0], arg => arg.startsWith('<@') && arg.endsWith('>'), usageStr)
  requireParameterFormat(args[1], arg => Number.isInteger(parseInt(arg)), usageStr)

  let delta = parseInt(args[1])
  let userInfo = await client.userRepository.load(args[0].replace(/[<@!>]/g, ''))
  if (userInfo == null) {
    throw new Error('The user was not found in the database.')
  }

  userInfo.current_session_playtime = Math.max(0, userInfo.current_session_playtime - delta)
  userInfo.overall_session_playtime = Math.max(0, userInfo.overall_session_playtime - delta)
  await client.userRepository.save(userInfo)

  client.log(`Delete ${delta} time for user <@${userInfo.id}> by <@${message.member.user.id}> ${message.member.user.username}#${message.member.user.discriminator}`)
  selfDestructMessage(() => message.reply('removed time from user.'))
}

module.exports = { addtime, deltime }
