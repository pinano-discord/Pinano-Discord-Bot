const Discord = require('discord.js')
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
    let userInfo = await this.client.loadUserData(args[0].replace(/[<@!>]/g, ''))
    if (userInfo == null) {
      throw new Error('The user was not found in the database.')
    }

    userInfo.current_session_playtime += delta
    userInfo.overall_session_playtime += delta
    await this.client.writeUserData(args[0].replace(/[<@!>]/g, ''), userInfo)
    selfDestructMessage(() => message.reply('added time to user.'))
  }

  async deltime (message) {
    requireRole(message.member)

    let args = message.content.split(' ').splice(1)
    let usageStr = `${settings.prefix}deltime @user TIME_IN_SECONDS`
    requireParameterCount(args, 2, usageStr)
    requireParameterFormat(args[0], arg => arg.startsWith('<@') && arg.endsWith('>'), usageStr)
    requireParameterFormat(args[1], arg => Number.isInteger(parseInt(arg)), usageStr)

    let delta = parseInt(args[1])
    let userInfo = await this.client.loadUserData(args[0].replace(/[<@!>]/g, ''))
    if (userInfo == null) {
      throw new Error('The user was not found in the database.')
    }

    userInfo.current_session_playtime = Math.max(0, userInfo.current_session_playtime - delta)
    userInfo.overall_session_playtime = Math.max(0, userInfo.overall_session_playtime - delta)
    await this.client.writeUserData(args[0].replace(/[<@!>]/g, ''), userInfo)
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
    msg.addField(`\`${settings.prefix}lb, ${settings.prefix}leaderboard [ weekly | overall ]\``,
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
    }

    msg.setColor(settings.embed_color)
    msg.setTimestamp()
    message.author.send(msg)

    selfDestructMessage(() => message.reply('sent you the command list.'))
  }

  _sendLeaderboard (channel, data, type, other) {
    let msg = new Discord.RichEmbed()
    msg.setTitle(`${type} Leaderboard`)
    msg.setDescription(data)
    msg.setFooter(`To view the ${other} leaderboard use ${settings.prefix}leaderboard ${other}`)
    msg.setColor(settings.embed_color)
    msg.setTimestamp()
    selfDestructMessage(() => channel.send(msg))
  }

  async leaderboard (message) {
    let args = message.content.split(' ').splice(1)
    if (args.length === 0 || args[0] === 'weekly') {
      let data = await this.client.getWeeklyLeaderboard(message.guild, message.author)
      this._sendLeaderboard(message.channel, data, 'Weekly', 'overall')
    } else if (args[0] === 'overall') {
      let data = await this.client.getOverallLeaderboard(message.guild, message.author)
      this._sendLeaderboard(message.channel, data, 'Overall', 'weekly')
    } else {
      let command = message.content.split(' ')[0]
      throw new Error(`Usage: \`${command} [ weekly | overall ]\``)
    }
  }

  async lock (message) {
    var channel = message.member.voiceChannel
    if (channel == null) {
      throw new Error('You are not currently in a channel.')
    }

    let guildInfo = await this.client.loadGuildData(message.guild.id)
    if (!guildInfo.permitted_channels.includes(message.member.voiceChannelID)) {
      throw new Error('This channel is not a registered practice room.')
    }

    if (channel.locked_by != null) {
      throw new Error('This channel is already locked.')
    }

    channel.locked_by = message.author.id
    channel.overwritePermissions(message.author, { SPEAK: true })
    let everyone = message.guild.roles.find('name', '@everyone')
    channel.overwritePermissions(everyone, { SPEAK: false }) // deny everyone speaking permissions
    try {
      await Promise.all(channel.members.map(async (m) => {
        if (m !== message.member && !m.deleted) {
          return m.setMute(true)
        }
      }))
    } catch (err) {
      // this is likely an issue with trying to mute a user who has already left the channel
      console.log(err)
    }

    selfDestructMessage(() => message.reply(`locked channel <#${channel.id}>.`))
  }

  async rooms (message) {
    requireRole(message.member)

    let guildInfo = await this.client.loadGuildData(message.guild.id)
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

          guildInfo['permitted_channels'].push(chanId)
          await this.client.writeGuildData(message.guild.id, guildInfo)
          selfDestructMessage(() => message.reply(`added ${args[1]} to practice channels.`))
          return
        }
        case 'del':
        case 'delete':
        {
          if (!guildInfo['permitted_channels'].includes(chanId)) {
            throw new Error(`${args[1]} is not currently registered.`)
          }

          guildInfo['permitted_channels'].splice(guildInfo.permitted_channels.indexOf(chanId), 1)
          await this.client.writeGuildData(message.guild.id, guildInfo)
          selfDestructMessage(() => message.reply(`removed ${args[1]} from practice channels.`))
          return
        }
        default:
          throw new Error(`Usage: \`${usageStr}\``)
      }
    } else {
      let msg = `Currently registered practice rooms:\n\`\`\`\n`
      guildInfo.permitted_channels
        .map(chanId => message.guild.channels.get(chanId))
        .filter(chan => chan != null)
        .sort((x, y) => x.position > y.position)
        .forEach(chan => {
          msg += `${chan.name}`
          if (chan.name === 'Extra Practice Room') {
            msg += ` (channel ID: ${chan.id})`
          }

          if (chan.locked_by != null) {
            let occupant = chan.members.get(`${chan.locked_by}`)
            msg += ` LOCKED by ${occupant.user.username}#${occupant.user.discriminator}`
          }

          chan.members.forEach(m => {
            msg += `\n  - ${m.user.username}#${m.user.discriminator}`
            if (m.deleted) {
              msg += ` (GHOST)`
            }

            if (m.s_time != null) {
              msg += ` (LIVE)`
            }
          })

          msg += '\n'
        })

      msg += `\`\`\``
      message.channel.send(msg)
    }
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
  client.commands['addtime'] = (message) => { return c.addtime(message) }
  client.commands['deltime'] = (message) => { return c.deltime(message) }
  client.commands['help'] = (message) => { return c.help(message) }
  client.commands['leaderboard'] = client.commands['lb'] = (message) => { return c.leaderboard(message) }
  client.commands['lock'] = (message) => { return c.lock(message) }
  client.commands['rooms'] = (message) => { return c.rooms(message) }
  client.commands['settings'] = (message) => { return c.settings(message) }
  client.commands['unlock'] = (message) => { return c.unlock(message) }
}

module.exports = loadCommands
