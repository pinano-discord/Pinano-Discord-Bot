const jimp = require('jimp')
const hd = require('humanize-duration')
const moment = require('moment')

module.exports.load = (client) => {
  client.commands['stats'] = {
    async run (message) {
      let userInfo
      try {
        userInfo = selectTargetUser(message)
      } catch (err) {
        console.log(err.stack)
        return client.errorMessage(message, `Unable to identify user: ${err}`)
      }

      try {
        const [user, pos, tot, guild] = await Promise.all([
          client.userRepository.load(userInfo.userId),
          client.userRepository.getSessionPos(userInfo.userId),
          client.userRepository.getSessionCount(),
          client.guildRepository.load(message.guild.id)
        ])
        if (user !== null) {
          const activeTime = getActiveTime(guild, userInfo.mem)

          userInfo.currentSession = user.current_session_playtime + activeTime
          userInfo.overallSession = user.overall_session_playtime + activeTime
          userInfo.rank = `${pos + 1} / ${tot}`
        } else {
          userInfo.currentSession = 0
          userInfo.overallSession = 0
          userInfo.rank = `?? / ${tot}`
        }
      } catch (err) {
        console.log(err.stack)
        return client.errorMessage(message,
          `Error fetching stats for ${userInfo.username}#${userInfo.discriminator}: ${err}`)
      }

      render(userInfo).then(buffer => {
        message.channel.send({
          files: [{
            attachment: buffer,
            name: 'level.jpg'
          }]
        })
        // delete response after set time
          .then(m => {
            setTimeout(() => {
              m.delete()
            }, client.settings.res_destruct_time * 1000)
          })
      })
    }
  }

  /*
   * The command works by building a userInfo structure with enough
   * information to render a stats display for the user.
   *
   * userInfo = {
   *   // via selectTargetUser
   *   username,
   *   discriminator,
   *   // via selectTargetUser -> enrichUserData
   *   userId,
   *   mem,    // A discord.js GuildMember, with s_time
   *   av,     // Avatar URL (or path)
   *   // Our data
   *   currentSession,
   *   overallSession,
   *   rank
   * }
   */

  function selectTargetUser (message) {
    let args = message.content.split(' ').splice(1)
    let userInfo
    if (args.length >= 1) {
      userInfo = parseUserInfo(args)
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
    const enriched = enrichUserInfo(userInfo, message.guild.id)
    if (!enriched) {
      throw new Error(`Unable to find user ${userInfo.username}#${userInfo.discriminator}.`)
    }
    return userInfo
  }

  function parseUserInfo (args) {
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

  function enrichUserInfo (userInfo, guildId) {
    const mem = userInfo._finder(client.guilds.get(guildId).members)
    if (mem === null) {
      return false
    }

    userInfo.mem = mem
    userInfo.userId = mem.user.id
    // checks if user has pfp because discord dosnt return default pfp url >:C
    if (userInfo.mem.user.avatarURL != null) {
      userInfo.av = userInfo.mem.user.avatarURL
    } else {
      userInfo.av = './assets/default_avatar.jpg'
    }
    return true
  }

  function getActiveTime (guild, mem) {
    // check if the user is actively pracking and update times live if necessary
    let activeTime = 0
    // these last two conditions should be equivalent but maybe they were already pracking when the bot came up
    if (mem.voiceChannel != null && guild.permitted_channels.includes(mem.voiceChannel.id) && !mem.mute && mem.s_time != null) {
      activeTime = moment().unix() - mem.s_time
    }
    return activeTime
  }

  async function render ({ av, username, discriminator, currentSession, overallSession, rank }) {
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

  function abbreviateTime (playtime) {
    return hd(playtime * 1000, { units: ['h', 'm', 's'], round: true })
      .replace('hours', 'h')
      .replace('minutes', 'm')
      .replace('seconds', 's')
      .replace('hour', 'h')
      .replace('minute', 'm')
      .replace('second', 's')
  }
}
