const Discord = require('discord.js')
const hd = require('humanize-duration')
const moment = require('moment')
const settings = require('./settings/settings.json')
const { badgesForUser } = require('./library/badges')

function requireRole (member, roleName = 'Bot Manager', errorMessage = 'You require the bot manager role to use this command.') {
  if (!member.roles.find(r => r.name === roleName) || !settings.pinano_guilds.includes(member.guild.id)) {
    throw new Error(errorMessage)
  }
}

function requireParameterCount (args, argCount, usageStr) {
  if (args.length !== argCount) {
    throw new Error(`Usage: \`${usageStr}\``)
  }
}

function requireParameterFormat (arg, formatFn, usageStr) {
  if (!formatFn(arg)) {
    throw new Error(`Usage: \`${usageStr}\``)
  }
}

async function selfDestructMessage (messageFn) {
  let m = await messageFn()
  setTimeout(() => m.delete(), settings.res_destruct_time * 1000)
}

function abbreviateTime (playtime) {
  return hd(playtime * 1000, { units: ['h', 'm', 's'], round: true })
    .replace('hours', 'h')
    .replace('minutes', 'm')
    .replace('seconds', 's')
    .replace('hour', 'h')
    .replace('minute', 'm')
    .replace('second', 's')
}

class Commands {
  constructor (client) {
    this.client = client
  }

  async addtime (client, message) {
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

  async bitrate (client, message) {
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
    if (isNaN(args[0]) || newrate < 8 || newrate > 384) {
      throw new Error('Bitrate must be a number between 8 and 384.')
    }

    if (channel.locked_by !== message.author.id) {
      throw new Error('You do not have this channel locked.')
    }

    await channel.setBitrate(newrate)
    selfDestructMessage(() => message.reply(`set bitrate for <#${channel.id}> to ${channel.bitrate} kbps.`))
  }

  async deltime (client, message) {
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

  async help (client, message) {
    let isBotManager = message.member.roles.find(r => r.name === 'Bot Manager')
    let isRecitalManager = message.member.roles.find(r => r.name === 'Recital Manager')

    let msg = new Discord.RichEmbed()
    msg.setTitle('Help')
    msg.addField(`\`${settings.prefix}help\``,
      'Displays this help message')
    msg.addField(`\`${settings.prefix}stats [ USERNAME#DISCRIMINATOR ]\``,
      'Displays practice statistics for the specified user (default: calling user)')
    msg.addField(`\`${settings.prefix}lock\``,
      'Locks the currently occupied room for exclusive use')
    msg.addField(`\`${settings.prefix}bitrate [ BITRATE_IN_KBPS ]\``,
      'Adjusts the bitrate of the currently occupied room')

    if (isBotManager) {
      msg.addField(`\`${settings.prefix}unlock [ <#CHANNEL_ID> ]\``,
        'Unlocks the specified room for shared use (default: currently occupied room)')
    } else {
      msg.addField(`\`${settings.prefix}unlock\``,
        'Unlocks the currently occupied room for shared use')
    }

    if (isRecitalManager) {
      msg.addField(`\`${settings.prefix}recital[s] [ add | del(ete) | rem(ove) ] @user RECITAL_ID\``,
        'Add or remove a recital from a user\'s record')
    }

    if (isBotManager) {
      msg.addField(`\`${settings.prefix}addtime @user TIME_IN_SECONDS\``,
        'Adds practice time to a user\'s record')
      msg.addField(`\`${settings.prefix}deltime @user TIME_IN_SECONDS\``,
        'Removes practice time from a user\'s record')
      msg.addField(`\`${settings.prefix}restart, ${settings.prefix}reboot\``,
        'Saves all active sessions and restarts Pinano Bot')
    }

    msg.setColor(settings.embed_color)
    msg.setTimestamp()
    message.author.send(msg)

    selfDestructMessage(() => message.reply('sent you the command list.'))
  }

  async lock (client, message) {
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

  async recital (client, message) {
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

  async restart (client, message) {
    requireRole(message.member)
    await message.delete() // we're not going to get a chance anywhere else
    await client.restart(message.guild, false)

    throw new Error('Something that should never happen has happened.')
  }

  async rooms (client, message) {
    throw new Error('This command is deprecated; please use [#information](http://discordapp.com/channels/188345759408717825/629841121551581204) instead.')
  }

  /*
   * The stats command works by building a userInfo structure with enough
   * information to render a stats card for the user.
   *
   * userInfo = {
   *   username,        // via _selectTargetUser
   *   discriminator,   // via _selectTargetUser
   *   mem,             // the GuildMember, via _selectTargetUser -> _enrichUserData
   *   av,              // the avatar URL or path, via _selectTargetUser -> _enrichUserData
   *   currentSession,  // current session time (computed from db current session time + active time)
   *   overallSession,  // overall session time (computed from db overall session time + active time)
   * }
   */
  _selectTargetUser (message) {
    let args = message.content.split(' ').splice(1)
    let userInfo
    if (args.length >= 1) {
      userInfo = this._parseUserInfo(args)
      if (userInfo === null) {
        throw new Error('Unable to parse as username#discriminator.')
      }
    } else {
      userInfo = {
        username: message.author.username,
        discriminator: message.author.discriminator,
        _finder: (members) => members.get(message.author.id)
      }
    }

    const enriched = this._enrichUserInfo(userInfo, message.guild)
    if (!enriched) {
      throw new Error(`Unable to find user ${userInfo.username}#${userInfo.discriminator}.`)
    }

    return userInfo
  }

  _parseUserInfo (args) {
    // fqName: "fully qualified name"
    let fqName = args.join(' ').trim().split('#')
    if (fqName.length !== 2) {
      return null
    }

    return {
      username: fqName[0],
      discriminator: fqName[1],
      _finder: (members) =>
        members.find(val => val.user.username === fqName[0] &&
          val.user.discriminator === fqName[1])
    }
  }

  _enrichUserInfo (userInfo, guild) {
    const mem = userInfo._finder(guild.members)
    if (mem == null) {
      return false
    }

    userInfo.mem = mem
    return true
  }

  async stats (client, message) {
    let userInfo = this._selectTargetUser(message)

    const user = await client.userRepository.load(userInfo.mem.id)
    if (user != null) {
      userInfo.currentSession = user.current_session_playtime
      userInfo.overallSession = user.overall_session_playtime
    } else {
      userInfo.currentSession = 0
      userInfo.overallSession = 0
    }

    const mem = userInfo.mem
    let hasLongSession = false
    if (mem.voiceChannel != null && client.policyEnforcer.isPracticeRoom(mem.voiceChannel) && !mem.mute && mem.s_time != null) {
      let activeTime = moment().unix() - mem.s_time
      userInfo.currentSession += activeTime
      userInfo.overallSession += activeTime
      if (activeTime >= 15 * 60) {
        hasLongSession = true
      }
    }

    let roomsSeen = ':shrug:'
    if (user != null) {
      if (user.rooms_practiced == null) {
        user.rooms_practiced = []
      }

      if (hasLongSession && mem.voiceChannel.emoji != null && !user.rooms_practiced.includes(mem.voiceChannel.emoji)) {
        user.rooms_practiced.push(mem.voiceChannel.emoji)
      }

      if (user.rooms_practiced.length > 0) {
        roomsSeen = user.rooms_practiced.reduce((acc, curr) => `${acc}${curr}`)
      }
    }

    let embed = new Discord.RichEmbed()
      .setTitle(`${userInfo.username}#${userInfo.discriminator}`)
      .setColor(settings.embed_color)
      .addField('Weekly Time', `\`${abbreviateTime(userInfo.currentSession)}\``, true)
      .addField('Overall Time', `\`${abbreviateTime(userInfo.overallSession)}\``, true)
      .addField('Rooms Seen', roomsSeen, true)
      .addField('Badges', badgesForUser(userInfo, user, hasLongSession))

    // checks if user has pfp because discord dosnt return default pfp url >:C
    if (userInfo.mem.user.avatarURL != null) {
      embed.setThumbnail(userInfo.mem.user.avatarURL)
    } else {
      embed.attachFiles(['./assets/default_avatar.jpg'])
        .setThumbnail('attachment://default_avatar.jpg')
    }

    selfDestructMessage(() => message.channel.send(embed))
  }

  async unlock (client, message) {
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
}

function loadCommands (client) {
  let c = new Commands(client)
  client.commands = {}

  client.commands['addtime'] = (client, message) => { return c.addtime(client, message) }
  client.commands['bitrate'] = (client, message) => { return c.bitrate(client, message) }
  client.commands['deltime'] = (client, message) => { return c.deltime(client, message) }
  client.commands['help'] = (client, message) => { return c.help(client, message) }
  client.commands['lock'] = (client, message) => { return c.lock(client, message) }
  client.commands['recital'] = client.commands['recitals'] = (client, message) => { return c.recital(client, message) }
  client.commands['restart'] = client.commands['reboot'] = (client, message) => { return c.restart(client, message) }
  client.commands['rooms'] = (client, message) => { return c.rooms(client, message) }
  client.commands['stats'] = (client, message) => { return c.stats(client, message) }
  client.commands['unlock'] = (client, message) => { return c.unlock(client, message) }
}

module.exports = loadCommands
