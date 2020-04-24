const settings = require('../settings/settings.json')

const {
  requireRole,
  selfDestructMessage
} = require('./helpers')

async function lock (client, message) {
  let channel, mem

  let args = message.content.split(' ').splice(1)
  if (args.length >= 1) {
    requireRole(message.member, 'Bot Manager', 'You must be a Bot Manager to lock other rooms.')

    channel = message.guild.channels.get(args[0].replace(/[<#>]/g, ''))

    let userInfo = this._parseUserInfo(args.slice(1))
    if (userInfo == null) {
      throw new Error('Unable to parse as username#discriminator.')
    }

    mem = userInfo._finder(message.guild.members)
    if (mem == null) {
      throw new Error(`Unable to find user ${userInfo.username}#${userInfo.discriminator}.`)
    }
  } else {
    channel = message.member.voiceChannel
    mem = message.member
  }

  if (channel == null || !client.policyEnforcer.isPracticeRoom(channel)) {
    throw new Error(`<@${message.author.id}>! This isn't the time to use that!`)
  }

  if (!channel.members.has(mem.id)) { // this might happen if a bot manager locks a channel to an absent user
    throw new Error(`The user is not in the specified channel.`)
  }

  if (channel.locked_by != null) {
    throw new Error('This channel is already locked.')
  }

  await client.policyEnforcer.lockPracticeRoom(message.guild, channel, mem)
  selfDestructMessage(() => message.reply(`locked channel <#${channel.id}>.`))
}

async function unlock (client, message) {
  let args = message.content.split(' ').splice(1)
  let channel
  if (args.length >= 1) {
    requireRole(message.member, 'Bot Manager', 'You must be a Bot Manager to unlock other rooms.')

    channel = message.guild.channels.get(args[0].replace(/[<#>]/g, ''))
  } else {
    channel = message.member.voiceChannel
  }

  if (channel == null) {
    throw new Error(`<@${message.author.id}>! This isn't the time to use that!`)
  }

  if (channel.locked_by !== message.author.id && !message.member.roles.find(r => r.name === 'Bot Manager')) {
    throw new Error('You do not have this channel locked.')
  }

  await client.policyEnforcer.unlockPracticeRoom(message.guild, channel)
  selfDestructMessage(() => message.reply(`unlocked channel <#${channel.id}>.`))
}

async function bitrate (client, message) {
  let args = message.content.split(' ').splice(1).filter(str => str !== '')
  let channel = message.member.voiceChannel
  if (channel == null) {
    throw new Error(`<@${message.author.id}>! This isn't the time to use that!`)
  }

  if (args.length === 0) {
    selfDestructMessage(() => message.reply(`the current bitrate for <#${channel.id}> is ${channel.bitrate}kbps.`))
    return
  }

  let newrate = parseInt(args[0])
  if (isNaN(args[0]) || newrate < 8 || newrate > settings.default_bitrate) {
    throw new Error(`Bitrate must be a number between 8 and ${settings.default_bitrate}.`)
  }

  if (channel.locked_by !== message.author.id) {
    throw new Error('You do not have this channel locked.')
  }

  await channel.setBitrate(newrate)
  selfDestructMessage(() => message.reply(`set bitrate for <#${channel.id}> to ${channel.bitrate} kbps.`))
}

async function rooms (client, message) {
  throw new Error('This command is deprecated; please use [#information](http://discordapp.com/channels/188345759408717825/629841121551581204) instead.')
}

module.exports = { lock, unlock, bitrate, rooms }
