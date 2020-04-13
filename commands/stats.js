const settings = require('../settings/settings.json')

const Discord = require('discord.js')
const moment = require('moment')

const { badgesForUser } = require('../library/badges')
const {
  selfDestructMessage,
  abbreviateTime
} = require('./helpers')

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
function _selectTargetUser (message) {
  let args = message.content.split(' ').splice(1)
  let userInfo
  if (args.length >= 1) {
    userInfo = _parseUserInfo(args)
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

  const enriched = _enrichUserInfo(userInfo, message.guild)
  if (!enriched) {
    throw new Error(`Unable to find user ${userInfo.username}#${userInfo.discriminator}.`)
  }

  return userInfo
}

function _parseUserInfo (args) {
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

function _enrichUserInfo (userInfo, guild) {
  const mem = userInfo._finder(guild.members)
  if (mem == null) {
    return false
  }

  userInfo.mem = mem
  return true
}

async function stats (client, message) {
  let userInfo = _selectTargetUser(message)

  const user = await client.userRepository.load(userInfo.mem.id)
  if (user != null) {
    userInfo.currentSession = user.current_session_playtime
    userInfo.overallSession = user.overall_session_playtime
    userInfo.dailySession = user.daily_session_playtime
  } else {
    userInfo.currentSession = 0
    userInfo.overallSession = 0
    userInfo.dailySession = 0
  }

  const mem = userInfo.mem
  let isPracticing = false
  if (mem.voiceChannel != null && client.policyEnforcer.isPracticeRoom(mem.voiceChannel) && !mem.mute && mem.s_time != null) {
    let activeTime = moment().unix() - mem.s_time
    userInfo.currentSession += activeTime
    userInfo.overallSession += activeTime
    userInfo.dailySession += activeTime
    if (activeTime >= settings.practice_session_minimum_time) {
      isPracticing = true
    }
  }

  let roomsSeen = ':shrug:'
  if (user != null) {
    if (user.rooms_practiced == null) {
      user.rooms_practiced = []
    }

    if (isPracticing && mem.voiceChannel.emoji != null && !user.rooms_practiced.includes(mem.voiceChannel.emoji)) {
      user.rooms_practiced.push(mem.voiceChannel.emoji)
    }

    if (user.rooms_practiced.length > 0) {
      roomsSeen = user.rooms_practiced.reduce((acc, curr) => `${acc}${curr}`)
    }
  }

  let embed = new Discord.RichEmbed()
    .setTitle(`${userInfo.username}#${userInfo.discriminator}`)
    .setColor(settings.embed_color)
    .addField(`Daily Time (resets on ${user.daily_reset_hour}:00 UTC`, `\`${abbreviateTime(userInfo.dailySession)}\``, true)
    .addField('Weekly Time', `\`${abbreviateTime(userInfo.currentSession)}\``, true)
    .addField('Overall Time', `\`${abbreviateTime(userInfo.overallSession)}\``, true)
    .addField('Rooms Seen', roomsSeen, true)
    .addField('Badges', badgesForUser(userInfo, user, isPracticing))

  // checks if user has pfp because discord dosnt return default pfp url >:C
  if (userInfo.mem.user.avatarURL != null) {
    embed.setThumbnail(userInfo.mem.user.avatarURL)
  } else {
    embed.attachFiles(['./assets/default_avatar.jpg'])
      .setThumbnail('attachment://default_avatar.jpg')
  }

  selfDestructMessage(() => message.channel.send(embed))
}

module.exports = { stats }
