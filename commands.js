const Discord = require('discord.js')
const hd = require('humanize-duration')
const jimp = require('jimp')
const moment = require('moment')
const settings = require('./settings/settings.json')

function requireRole (member, roleName = 'Bot Manager', errorMessage = 'You require the bot manager role to use this command.') {
  if (!member.roles.find(r => r.name === roleName)) {
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

  async addtime (message) {
    requireRole(message.member)

    let args = message.content.split(' ').splice(1)
    let usageStr = `${settings.prefix}addtime @user TIME_IN_SECONDS`
    requireParameterCount(args, 2, usageStr)
    requireParameterFormat(args[0], arg => arg.startsWith('<@') && arg.endsWith('>'), usageStr)
    requireParameterFormat(args[1], arg => Number.isInteger(parseInt(arg)), usageStr)

    let delta = parseInt(args[1])
    let userInfo = await this.client.userRepository.load(args[0].replace(/[<@!>]/g, ''))
    if (userInfo == null) {
      throw new Error('The user was not found in the database.')
    }

    userInfo.current_session_playtime += delta
    userInfo.overall_session_playtime += delta
    await this.client.userRepository.save(userInfo)
    selfDestructMessage(() => message.reply('added time to user.'))
  }

  async commit (message) {
    requireRole(message.member)
    await this.client.saveAllUsersTime(message.guild)
    selfDestructMessage(() => message.reply('committed all active sessions to storage.'))
  }

  async deltime (message) {
    requireRole(message.member)

    let args = message.content.split(' ').splice(1)
    let usageStr = `${settings.prefix}deltime @user TIME_IN_SECONDS`
    requireParameterCount(args, 2, usageStr)
    requireParameterFormat(args[0], arg => arg.startsWith('<@') && arg.endsWith('>'), usageStr)
    requireParameterFormat(args[1], arg => Number.isInteger(parseInt(arg)), usageStr)

    let delta = parseInt(args[1])
    let userInfo = await this.client.userRepository.load(args[0].replace(/[<@!>]/g, ''))
    if (userInfo == null) {
      throw new Error('The user was not found in the database.')
    }

    userInfo.current_session_playtime = Math.max(0, userInfo.current_session_playtime - delta)
    userInfo.overall_session_playtime = Math.max(0, userInfo.overall_session_playtime - delta)
    await this.client.userRepository.save(userInfo)
    selfDestructMessage(() => message.reply('removed time from user.'))
  }

  async help (message) {
    let isBotManager = message.member.roles.find(r => r.name === 'Bot Manager')

    let msg = new Discord.RichEmbed()
    msg.setTitle('Help')
    msg.addField(`\`${settings.prefix}help\``,
      'Displays this help message')
    msg.addField(`\`${settings.prefix}stats [ USERNAME#DISCRIMINATOR ]\``,
      'Displays practice statistics for the specified user (default: calling user)')
    msg.addField(`\`${settings.prefix}lb, ${settings.prefix}leaderboard [ [w]eekly | [o]verall ]\``,
      'Displays the weekly or overall leaderboard (default: weekly)')

    if (isBotManager) {
      msg.addField(`\`${settings.prefix}unlock [ <#CHANNEL_ID> ]\``,
        'Unlocks the specified room for shared use (default: currently occupied room)')
    } else {
      msg.addField(`\`${settings.prefix}unlock\``,
        'Unlocks the currently occupied room for shared use')
    }

    msg.addField(`\`${settings.prefix}info\``,
      'Displays information about the Discord server')
    msg.addField(`\`${settings.prefix}lock\``,
      'Locks the currently occupied room for exclusive use')

    if (isBotManager) {
      msg.addField(`\`${settings.prefix}rooms [ [ add | del | delete ] <#CHANNEL_ID> ]\``,
        'Lists, registers or unregisters practice rooms')
      msg.addField(`\`${settings.prefix}addtime @user TIME_IN_SECONDS\``,
        'Adds practice time to a user\'s record')
      msg.addField(`\`${settings.prefix}deltime @user TIME_IN_SECONDS\``,
        'Removes practice time from a user\'s record')
      msg.addField(`\`${settings.prefix}commit\``,
        'Commits all active practice sessions to storage')
    }

    msg.setColor(settings.embed_color)
    msg.setTimestamp()
    message.author.send(msg)

    selfDestructMessage(() => message.reply('sent you the command list.'))
  }

  _sendLeaderboard (channel, data, type, other) {
    selfDestructMessage(() => channel.send({
      embed: {
        title: `${type} Leaderboard`,
        description: data,
        footer: `To view the ${other} leaderboard use ${settings.prefix}leaderboard ${other}`,
        color: settings.embed_color,
        timestamp: Date.now()
      }
    }))
  }

  async leaderboard (message) {
    let args = message.content.split(' ').splice(1)
    if (args.length === 0 || args[0] === 'weekly' || args[0] === 'w') {
      let data = await this.client.getWeeklyLeaderboard(message.guild, message.author)
      this._sendLeaderboard(message.channel, data, 'Weekly', 'overall')
    } else if (args[0] === 'overall' || args[0] === 'o') {
      let data = await this.client.getOverallLeaderboard(message.guild, message.author)
      this._sendLeaderboard(message.channel, data, 'Overall', 'weekly')
    } else {
      let command = message.content.split(' ')[0]
      throw new Error(`Usage: \`${command} [ [w]eekly | [o]verall ]\``)
    }
  }

  async lock (message) {
    var channel = message.member.voiceChannel
    if (channel == null) {
      throw new Error('You are not currently in a channel.')
    }

    let guildInfo = await this.client.guildRepository.load(message.guild.id)
    if (!guildInfo.permitted_channels.includes(message.member.voiceChannelID)) {
      throw new Error('This channel is not a registered practice room.')
    }

    if (channel.locked_by != null) {
      throw new Error('This channel is already locked.')
    }

    channel.locked_by = message.author.id
    channel.overwritePermissions(message.author, { SPEAK: true })
    let everyone = message.guild.roles.find(r => r.name === '@everyone')
    channel.overwritePermissions(everyone, { SPEAK: false }) // deny everyone speaking permissions
    try {
      await Promise.all(channel.members.map(async (m) => {
        if (m !== message.member && !m.deleted) {
          return m.setMute(true)
        }
      }))
    } catch (err) {
      // this is likely an issue with trying to mute a user who has already left the channel
      this.client.log(err)
    }

    selfDestructMessage(() => message.reply(`locked channel <#${channel.id}>.`))
  }

  async rooms (message) {
    requireRole(message.member)

    let guildInfo = await this.client.guildRepository.load(message.guild.id)
    if (guildInfo == null) {
      throw new Error('No data for this guild.')
    }

    let args = message.content.split(' ').splice(1)
    if (args.length !== 0) {
      let usageStr = `${settings.prefix}rooms [ [ add | del | delete ] <#CHANNEL_ID> ]`
      requireParameterCount(args, 2, usageStr)
      requireParameterFormat(args[1], arg => arg.startsWith('<#') && arg.endsWith('>'), usageStr)

      let chanId = args[1].replace(/[<#>]/g, '')
      switch (args[0]) {
        case 'add':
        {
          if (guildInfo['permitted_channels'].includes(chanId)) {
            throw new Error(`${args[1]} is already registered.`)
          }

          await this.client.guildRepository.addToField(guildInfo, 'permitted_channels', chanId)
          selfDestructMessage(() => message.reply(`added ${args[1]} to practice channels.`))
          return
        }
        case 'del':
        case 'delete':
        {
          if (!guildInfo['permitted_channels'].includes(chanId)) {
            throw new Error(`${args[1]} is not currently registered.`)
          }

          await this.client.guildRepository.removeFromField(guildInfo, 'permitted_channels', chanId)
          selfDestructMessage(() => message.reply(`removed ${args[1]} from practice channels.`))
          return
        }
        default:
          throw new Error(`Usage: \`${usageStr}\``)
      }
    } else {
      let msg = 'Currently registered practice rooms:\n```\n'
      guildInfo.permitted_channels
        .map(chanId => message.guild.channels.get(chanId))
        .filter(chan => chan != null)
        .sort((x, y) => x.position > y.position)
        .forEach(chan => {
          msg += `${chan.name}`
          if (chan.name === 'Extra Practice Room') {
            msg += ` (channel ID: ${chan.id})`
          }

          if (chan.isTempRoom) {
            msg += ' (TEMP)'
          }

          if (chan.locked_by != null) {
            let occupant = chan.members.get(`${chan.locked_by}`)
            msg += ` LOCKED by ${occupant.user.username}#${occupant.user.discriminator}`
          }

          chan.members.forEach(m => {
            msg += `\n  - ${m.user.username}#${m.user.discriminator}`
            if (m.deleted) {
              msg += ' (GHOST)'
            }

            if (m.s_time != null) {
              msg += ' (LIVE)'
            }
          })

          msg += '\n'
        })

      msg += '```'
      message.channel.send(msg)
    }
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
   *   rank             // rank computed by leaderboard library (accounts for active time)
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
    // checks if user has pfp because discord dosnt return default pfp url >:C
    if (userInfo.mem.user.avatarURL != null) {
      userInfo.av = userInfo.mem.user.avatarURL
    } else {
      userInfo.av = './assets/default_avatar.jpg'
    }

    return true
  }

  async _render ({ av, username, discriminator, currentSession, overallSession, rank }) {
    // load template
    let [source, avatar, font] = await Promise.all([
      jimp.read('./assets/time_card.png'),
      jimp.read(av),
      jimp.loadFont(jimp.FONT_SANS_16_WHITE)
    ])

    await avatar.resize(98, 98)
    await source.composite(avatar, 14, 14)

    source.print(font, 245, 25, `${username}#${discriminator}`)
    source.print(font, 135, 90, abbreviateTime(currentSession))
    source.print(font, 280, 90, abbreviateTime(overallSession))
    source.print(font, 435, 90, rank)

    // send the pic as png
    return source.getBufferAsync(jimp.MIME_PNG)
  }

  async stats (message) {
    let userInfo = this._selectTargetUser(message)

    const user = await this.client.userRepository.load(userInfo.mem.id)
    if (user != null) {
      userInfo.currentSession = user.current_session_playtime
      userInfo.overallSession = user.overall_session_playtime
    } else {
      userInfo.currentSession = 0
      userInfo.overallSession = 0
    }

    userInfo.rank = await this.client.getWeeklyLeaderboardPos(userInfo.mem.guild, userInfo.mem.id)
    userInfo.rank = userInfo.rank.replace(/[`]/g, '')

    const guild = await this.client.guildRepository.load(message.guild.id)
    const mem = userInfo.mem
    if (guild.permitted_channels.includes(mem.voiceChannelID) && !mem.mute && mem.s_time != null) {
      let activeTime = moment().unix() - mem.s_time
      userInfo.currentSession += activeTime
      userInfo.overallSession += activeTime
    }

    let buffer = await this._render(userInfo)
    selfDestructMessage(() => message.channel.send({
      files: [{
        attachment: buffer,
        name: 'level.jpg'
      }]
    }))
  }

  async unlock (message) {
    let args = message.content.split(' ').splice(1)
    let channel
    if (args.length >= 1) {
      requireRole(message.member, 'Bot Manager', 'You must be a Bot Manager to unlock other rooms.')

      channel = message.guild.channels.get(args[0].replace(/[<#>]/g, ''))
    } else {
      channel = message.member.voiceChannel
    }

    if (channel == null) {
      throw new Error('You are not currently in a channel.')
    }

    if (channel.locked_by !== message.author.id && !message.member.roles.find(r => r.name === 'Bot Manager')) {
      throw new Error('You do not have this channel locked.')
    }

    await this.client.unlockPracticeRoom(message.guild, channel.locked_by, channel)
    selfDestructMessage(() => message.reply(`unlocked channel <#${channel.id}>.`))
  }

  async settings (message) {
    requireRole(message.member)
    throw new Error(`This command has been retired; use \`${settings.prefix}rooms [ add | del | delete ] <#CHANNEL_ID>\` to register and unregister practice channels.`)
  }
}

function loadCommands (client) {
  let c = new Commands(client)
  client.commands = {}

  client.commands['addtime'] = (message) => { return c.addtime(message) }
  client.commands['commit'] = (message) => { return c.commit(message) }
  client.commands['deltime'] = (message) => { return c.deltime(message) }
  client.commands['help'] = (message) => { return c.help(message) }
  client.commands['leaderboard'] = client.commands['lb'] = (message) => { return c.leaderboard(message) }
  client.commands['lock'] = (message) => { return c.lock(message) }
  client.commands['rooms'] = (message) => { return c.rooms(message) }
  client.commands['settings'] = (message) => { return c.settings(message) }
  client.commands['stats'] = (message) => { return c.stats(message) }
  client.commands['unlock'] = (message) => { return c.unlock(message) }
}

module.exports = loadCommands
