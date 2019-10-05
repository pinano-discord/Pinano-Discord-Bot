const Discord = require('discord.js')
const hd = require('humanize-duration')
const moment = require('moment')
const settings = require('./settings/settings.json')

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
    let isRecitalManager = message.member.roles.find(r => r.name === 'Recital Manager')

    let msg = new Discord.RichEmbed()
    msg.setTitle('Help')
    msg.addField(`\`${settings.prefix}help\``,
      'Displays this help message')
    msg.addField(`\`${settings.prefix}stats [ USERNAME#DISCRIMINATOR ]\``,
      'Displays practice statistics for the specified user (default: calling user)')
    msg.addField(`\`${settings.prefix}lock\``,
      'Locks the currently occupied room for exclusive use')

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
      msg.addField(`\`${settings.prefix}rooms [ [ add | del(ete) | rem(ove) ] <#CHANNEL_ID> ]\``,
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

  async leaderboard (message) {
    throw new Error(`This command has been retired; please use [#information](http://discordapp.com/channels/188345759408717825/629841121551581204) instead.`)
  }

  async lock (message) {
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

    if (channel == null) {
      throw new Error(`<@${message.author.id}>! This isn't the time to use that!`)
    }

    if (!channel.members.has(mem.id)) { // this might happen if a bot manager locks a channel to an absent user
      throw new Error(`The user is not in the specified channel.`)
    }

    let guildInfo = await this.client.guildRepository.load(message.guild.id)
    if (!guildInfo.permitted_channels.includes(channel.id)) {
      throw new Error(`<@${message.author.id}>! This isn't the time to use that!`)
    }

    if (channel.locked_by != null) {
      throw new Error('This channel is already locked.')
    }

    channel.locked_by = mem.id
    if (channel.isTempRoom) {
      channel.unlocked_name = channel.name
      await channel.setName(`${mem.user.username}'s room`)
    }
    await channel.overwritePermissions(mem.user, { SPEAK: true })
    let everyone = message.guild.roles.find(r => r.name === '@everyone')
    await channel.overwritePermissions(everyone, { SPEAK: false }) // deny everyone speaking permissions
    try {
      await Promise.all(channel.members.map(async (m) => {
        if (m !== mem && !m.deleted) {
          return m.setMute(true)
        }
      }))
    } catch (err) {
      // this is likely an issue with trying to mute a user who has already left the channel
      this.client.log(err)
    }

    selfDestructMessage(() => message.reply(`locked channel <#${channel.id}>.`))
  }

  async recital (message) {
    requireRole(message.member, 'Recital Manager', 'You require the Recital Manager role to use this command.')

    let args = message.content.split(' ').splice(1)
    let usageStr = `${settings.prefix}recital(s) [ add | del(ete) | rem(ove) ] @user RECITAL_ID`
    requireParameterCount(args, 3, usageStr)
    requireParameterFormat(args[1], arg => arg.startsWith('<@') && arg.endsWith('>'), usageStr)

    let userId = args[1].replace(/[<@!>]/g, '')
    let userInfo = await this.client.userRepository.load(userId)
    if (userInfo == null) {
      userInfo = {
        'id': userId,
        'current_session_playtime': 0,
        'overall_session_playtime': 0
      }

      await this.client.userRepository.save(userInfo)
    }

    switch (args[0]) {
      case 'add':
      {
        await this.client.userRepository.addToField(userInfo, 'recitals', args[2])
        selfDestructMessage(() => message.reply(`added recital to user.`))
        return
      }
      case 'del':
      case 'delete':
      case 'rem':
      case 'remove':
      {
        await this.client.userRepository.removeFromField(userInfo, 'recitals', args[2])
        selfDestructMessage(() => message.reply(`removed recital from user.`))
        return
      }
      default:
        throw new Error(`Usage: \`${usageStr}\``)
    }
  }

  async rooms (message) {
    requireRole(message.member)

    let guildInfo = await this.client.guildRepository.load(message.guild.id)
    if (guildInfo == null) {
      throw new Error('No data for this guild.')
    }

    let args = message.content.split(' ').splice(1)
    if (args.length === 0) {
      throw new Error('Parameterless `p!rooms` arguments is deprecated; please use [#information](http://discordapp.com/channels/188345759408717825/629841121551581204) instead.')
    }

    let usageStr = `${settings.prefix}rooms [ [ add | del(ete) | rem(ove) ] <#CHANNEL_ID> ]`
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
      case 'rem':
      case 'remove':
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
    return true
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
    userInfo.overallRank = await this.client.getOverallLeaderboardPos(userInfo.mem.guild, userInfo.mem.id)

    const guild = await this.client.guildRepository.load(message.guild.id)
    const mem = userInfo.mem
    if (guild.permitted_channels.includes(mem.voiceChannelID) && !mem.mute && mem.s_time != null) {
      let activeTime = moment().unix() - mem.s_time
      userInfo.currentSession += activeTime
      userInfo.overallSession += activeTime
    }

    let embed = new Discord.RichEmbed()
      .setTitle(`${userInfo.username}#${userInfo.discriminator}`)
      .setColor(settings.embed_color)
      .addField('Weekly Time', `\`${abbreviateTime(userInfo.currentSession)}\``, true)
      .addField('Rank', `${userInfo.rank}`, true)
      .addField('Overall Time', `\`${abbreviateTime(userInfo.overallSession)}\``, true)
      .addField('Rank', `${userInfo.overallRank}`, true)

    let badges = ''
    if (moment().unix() * 1000 - mem.joinedTimestamp >= 88 * 86400 * 1000) {
      // join date is more than 88 days ago
      badges += ':musical_keyboard: It has been at least 88 days since this user joined Pinano\n'
    }

    if (mem.roles.some(r => r.name === 'Hand Revealed')) {
      badges += ':hand_splayed: This user has revealed their hand on [#hand-reveals](https://discordapp.com/channels/188345759408717825/440705391454584834)\n'
    }

    if (user.recitals != null && user.recitals.length >= 3) {
      // one for each note in the emoji
      badges += ':notes: This user has played in three recitals\n'
    }

    if (settings.contributors.includes(mem.id)) {
      badges += ':robot: This user contributed code to Pinano Bot on [GitHub](https://github.com/pinano-discord/Pinano-Discord-Bot)\n'
    }

    if (userInfo.overallSession >= 500 * 60 * 60) {
      badges += '<:FiveHundredHours:627099475701268480> This user has practiced for 500 hours\n'
    } else if (userInfo.overallSession >= 250 * 60 * 60) {
      badges += '<:TwoFiftyHours:627099476120829982> This user has practiced for 250 hours\n'
    } else if (userInfo.overallSession >= 100 * 60 * 60) {
      badges += '<:HundredHours:627099476078755850> This user has practiced for 100 hours\n'
    } else if (userInfo.overallSession >= 40 * 60 * 60) {
      badges += '<:FortyHours:627099475869171712> This user has practiced for 40 hours\n'
    }

    let effectiveName = ((mem.nickname == null) ? mem.user.username : mem.nickname).toLowerCase()
    if (effectiveName.endsWith('juice') || effectiveName.endsWith('juwuice')) {
      badges += ':tropical_drink: This user\'s username ends in \'juice\'\n'
    }

    if (badges === '') {
      badges = '<:wtf:593197993264414751> no badges yet!'
    }

    embed.addField('Badges', badges)

    // checks if user has pfp because discord dosnt return default pfp url >:C
    if (userInfo.mem.user.avatarURL != null) {
      embed.setThumbnail(userInfo.mem.user.avatarURL)
    } else {
      embed.attachFiles(['./assets/default_avatar.jpg'])
        .setThumbnail('attachment://default_avatar.jpg')
    }

    selfDestructMessage(() => message.channel.send(embed))
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
      throw new Error(`<@${message.author.id}>! This isn't the time to use that!`)
    }

    if (channel.locked_by !== message.author.id && !message.member.roles.find(r => r.name === 'Bot Manager')) {
      throw new Error('You do not have this channel locked.')
    }

    await this.client.unlockPracticeRoom(message.guild, channel.locked_by, channel)
    selfDestructMessage(() => message.reply(`unlocked channel <#${channel.id}>.`))
  }

  async settings (message) {
    requireRole(message.member)
    throw new Error(`This command has been retired; use \`${settings.prefix}rooms [ add | del(ete) | rem(ove) ] <#CHANNEL_ID>\` to register and unregister practice channels.`)
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
  client.commands['recital'] = client.commands['recitals'] = (message) => { return c.recital(message) }
  client.commands['rooms'] = (message) => { return c.rooms(message) }
  client.commands['settings'] = (message) => { return c.settings(message) }
  client.commands['stats'] = (message) => { return c.stats(message) }
  client.commands['unlock'] = (message) => { return c.unlock(message) }
}

module.exports = loadCommands
