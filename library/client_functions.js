const Discord = require('discord.js')
const hd = require('humanize-duration')
const moment = require('moment')
const settings = require('../settings/settings.json')

function translateLeaderboard (page) {
  const reducer = (msgStr, row, index) => {
    let timeStr = hd(row.time * 1000, { units: ['h', 'm', 's'] })
    return msgStr + `**${page.startRank + index}. <@${page.data[index].id}>**\n \`${timeStr}\`\n`
  }

  let data = page.data.reduce(reducer, '')
  return (data === '') ? '\u200B' : data
}

module.exports = client => {
  client.log = (string) => {
    console.log(`${moment().format('MMMM Do YYYY, h:mm:ss a')} :: ${string}`)
  }

  client.loadCommands = async () => {
    let loadCommands = require('../commands.js')
    loadCommands(client)

    require('../eval.js').load(client)
  }

  client.errorMessage = async (message, response) => {
    let m = await message.channel.send({
      embed: {
        title: 'Error',
        description: response,
        color: settings.embed_color,
        timestamp: new Date()
      }
    })

    setTimeout(() => m.delete(), settings.res_destruct_time * 1000)
  }

  client.saveUserTime = async (member) => {
    // if the user doesn't exist then create a user for the person
    let userInfo = await client.userRepository.load(member.user.id)
    if (userInfo == null) {
      userInfo = {
        'id': member.user.id,
        'current_session_playtime': 0,
        'overall_session_playtime': 0
      }
      await client.userRepository.save(userInfo)
      client.log(`User created for ${member.user.username}#${member.user.discriminator}`)
    }

    const now = moment().unix()
    const playtime = now - member.s_time
    userInfo.current_session_playtime += playtime
    userInfo.overall_session_playtime += playtime
    await client.userRepository.save(userInfo)
    client.log(`User <@${member.user.id}> ${member.user.username}#${member.user.discriminator} practiced for ${playtime} seconds`)

    member.s_time = now
  }

  client.saveAllUsersTime = async (guild) => {
    await Promise.all(
      client.policyEnforcer.getPracticeRooms(guild)
        .map(chan =>
          Promise.all(chan.members
            .filter(member => !member.mute && member.s_time != null && !member.deleted)
            .map(member => client.saveUserTime(member)))))
  }

  client.restart = async (guild) => {
    let notifChan = guild.channels.find(c => c.name === 'information')
    let message = await notifChan.send('Beginning restart procedure...')
    let edited = await message.edit(`${message.content}\nSaving all active sessions...`)
    message = edited // for some reason the linter thinks message isn't being used if we assign it directly?
    await client.saveAllUsersTime(guild)

    message = await message.edit(`${message.content} saved.\nUnlocking rooms...`)
    await Promise.all(
      client.policyEnforcer.getPracticeRooms(guild)
        .map(chan => client.policyEnforcer.unlockPracticeRoom(guild, chan)))

    message = await message.edit(`${message.content} unlocked.\nRestarting Pinano Bot...`)
    process.exit(0)
  }

  // a user is live if they are:
  // 1. not a bot (so we exclude ourselves and Craig)
  // 2. unmuted
  // 3. in a permitted channel
  // 4. that is not locked by someone else
  client.isLiveUser = (member) => {
    return !member.user.bot &&
      !member.mute &&
      member.voiceChannel != null &&
      client.policyEnforcer.isPracticeRoom(member.voiceChannel) &&
      (member.voiceChannel.locked_by == null || member.voiceChannel.locked_by === member.id)
  }

  client.resume = async (guild) => {
    let infoChan = guild.channels.find(c => c.name === 'information')
    let messages = await infoChan.fetchMessages()
    let message = messages.find(m => m.content.startsWith('Beginning restart procedure...'))
    if (message != null) {
      message = await message.edit(`${message.content} ready.\nDetecting room status...`)
    }

    let practiceRooms = client.policyEnforcer.getPracticeRooms(guild)
    await Promise.all(practiceRooms.map(async chan => {
      // assume that if there's only one person playing in a room, it should be locked to them.
      let unmuted = chan.members.filter(m => !m.deleted && !m.mute)
      if (unmuted.size === 1) {
        return client.policyEnforcer.lockPracticeRoom(guild, chan, unmuted.first())
      } else {
        // keep the room unlocked; reset the permissions just in case they're borked
        await client.policyEnforcer.unlockPracticeRoom(guild, chan)
        chan.suppressAutolock = false
      }
    }))

    if (message != null) {
      message = await message.edit(`${message.content} marked locked rooms.\nResuming active sessions...`)
    }

    practiceRooms.forEach(chan => {
      chan.members.forEach(m => {
        if (client.isLiveUser(m) && m.s_time == null) {
          client.log(`Beginning session for user <@${m.user.id}> ${m.user.username}#${m.user.discriminator}`)
          m.s_time = moment().unix()
        }
      })
    })

    if (message != null) {
      message = await message.edit(`${message.content} resumed.\nRestart procedure completed.`)
      setTimeout(() => message.delete(), settings.res_destruct_time * 1000)
    }
  }

  client.refreshRoomInfo = async (guild) => {
    const reducer = (rooms, chan) => {
      let displayName = (chan.locked_by != null) ? chan.unlocked_name : chan.name
      rooms += `\n\n${displayName}`
      if (chan.bitrate !== 384) {
        rooms += ` | ${chan.bitrate}kbps`
      }

      if (chan.bitrate > 64) { // don't bother with video links for low-bitrate rooms
        rooms += ` | [Video](http://www.discordapp.com/channels/${guild.id}/${chan.id})`
      }

      chan.members.forEach(m => {
        rooms += `\n<@${m.id}>`
        if (m.deleted) {
          rooms += ' :ghost:'
        }

        if (m.s_time != null) {
          rooms += ' :microphone2:'
        }
      })

      return rooms
    }

    client.roomInfo =
      client.policyEnforcer.getPracticeRooms(guild)
        .filter(chan => chan.members.some(m => !m.deleted))
        .sort((x, y) => x.position > y.position)
        .reduce(reducer, '')
  }

  client.updateInformation = async (guild) => {
    let liveData = await client.findCurrentPrackers(guild)
    await client.refreshRoomInfo(guild)
    await client.weeklyLeaderboard.refresh(liveData)
    await client.overallLeaderboard.refresh(liveData)

    await client.redrawInformation(guild)

    setTimeout(() => client.updateInformation(guild), 15 * 1000)
  }

  client.redrawInformation = async (guild) => {
    let weeklyData = client.weeklyLeaderboard.getPageData()
    let overallData = client.overallLeaderboard.getPageData()
    let currentTime = moment().unix()
    let endOfWeek = moment().endOf('isoWeek').unix()
    let timeUntilReset = hd((endOfWeek - currentTime) * 1000, { units: [ 'd', 'h', 'm' ], maxDecimalPoints: 0 })

    let pinnedPostUrl = 'https://discordapp.com/channels/188345759408717825/411657964198428682/518693148877258776'
    let embed = new Discord.RichEmbed()
      .setTitle('Practice Rooms')
      .setColor(settings.embed_color)
      .setDescription(`${client.roomInfo}\n\u200B`) // stupid formatting hack
      .addField('Weekly Leaderboard', translateLeaderboard(weeklyData), true)
      .addField('Overall Leaderboard', translateLeaderboard(overallData), true)
      .addField(`Weekly leaderboard resets in ${timeUntilReset}`,
        `\u200B\nClick [here](${pinnedPostUrl}) for optimal Discord voice settings\n\
Use \`p!stats\` for individual statistics\n\
Use \`p!bitrate [ BITRATE_IN_KBPS ]\` to adjust a channel's bitrate\n\u200B`)
      .setTimestamp(Date.now())

    let infoChan = guild.channels.find(c => c.name === 'information')
    let messages = await infoChan.fetchMessages()
    let message = messages.find(m => m.embeds != null && m.embeds.some(e => e.title === 'Practice Rooms'))
    if (message == null) {
      message = await infoChan.send(embed)
    } else {
      message = await message.edit({ embed: embed })
    }

    if (client.reactionsHandler == null) {
      const filter = (r, u) => u !== client.user
      client.reactionsHandler = message.createReactionCollector(filter)
      client.reactionsHandler.on('collect', async reaction => {
        switch (reaction.emoji.name) {
          case '◀':
            client.weeklyLeaderboard.decrementPage()
            await client.redrawInformation(guild)
            break
          case '▶':
            client.weeklyLeaderboard.incrementPage()
            await client.redrawInformation(guild)
            break
          case '⬅':
            client.overallLeaderboard.decrementPage()
            await client.redrawInformation(guild)
            break
          case '➡':
            client.overallLeaderboard.incrementPage()
            await client.redrawInformation(guild)
            break
        }

        reaction.users
          .filter(u => u !== client.user)
          .forEach(u => reaction.remove(u))
      })

      await message.clearReactions()
      await message.react('◀')
      await message.react('🇼')
      await message.react('▶')
      await message.react('⬅')
      await message.react('🇴')
      await message.react('➡')
    }
  }

  client.findCurrentPrackers = async (guild) => {
    // playtimes only get updated when a user leaves/mutes a channel. Therefore, in order to keep up-to-date statistics,
    // find out what users are currently in permitted voice channels, then add their times as if current.
    let currentPrackers = new Map()

    client.policyEnforcer.getPracticeRooms(guild)
      .forEach(chan => {
        chan.members
          .filter(member => !member.mute && member.s_time != null && !member.deleted)
          .forEach(member => currentPrackers.set(member.user.id, moment().unix() - member.s_time))
      })

    return currentPrackers
  }
  client.getOverallLeaderboardPos = async (guild, userId) => {
    return client.getLeaderboardPos(guild, userId,
      p => p.overall_session_playtime,
      () => client.userRepository.getOverallCount(),
      userId => client.userRepository.getOverallRank(userId),
      totalTime => client.userRepository.getOverallRankByTime(totalTime))
  }

  client.getWeeklyLeaderboardPos = async (guild, userId) => {
    return client.getLeaderboardPos(guild, userId,
      p => p.current_session_playtime,
      () => client.userRepository.getSessionCount(),
      userId => client.userRepository.getSessionRank(userId),
      totalTime => client.userRepository.getSessionRankByTime(totalTime))
  }

  client.getLeaderboardPos = async (guild, userId, playtimeFn, userCountFn, getRankFn, getRankByTimeFn) => {
    let currentPrackers = await client.findCurrentPrackers(guild)

    let tentativeRank, totalTime
    let totalCount = await userCountFn()
    if (currentPrackers.has(userId)) {
      // the calling user is live. Need to figure out where their rank is after accounting for active time.
      let user = await client.userRepository.load(userId)
      if (user == null) {
        // we've never seen them before... consider their DB time to be zero.
        totalTime = currentPrackers.get(userId)
      } else {
        totalTime = currentPrackers.get(userId) + playtimeFn(user)
      }

      tentativeRank = await getRankByTimeFn(totalTime)
    } else {
      let user = await client.userRepository.load(userId)
      if (user == null || playtimeFn(user) === 0) {
        // calling user has zero time, active or stored
        return 'N / A'
      }

      totalTime = playtimeFn(user)
      tentativeRank = await getRankFn(userId)
    }

    // now figure out how many active prackers (if any) they've been passed by.
    for (const [currentId, currentTime] of currentPrackers.entries()) {
      if (currentId !== userId) {
        let otherUser = await client.userRepository.load(currentId)
        let otherTime = 0
        let dbTime = 0
        if (otherUser == null || playtimeFn(otherUser) === 0) {
          // an active user who won't show up in getSessionCount() => increment the total number of users
          totalCount++
        } else {
          dbTime = playtimeFn(otherUser)
          otherTime += dbTime
        }

        otherTime += currentTime
        if (otherTime > totalTime && totalTime > dbTime) {
          // this active user started out behind us but has passed us
          tentativeRank++
        }
      }
    }

    return `\`${tentativeRank}\` / \`${totalCount}\``
  }

  client.submitWeek = async () => {
    let pinano = client.guilds.get('188345759408717825')
    let liveData = await client.findCurrentPrackers(pinano)
    await client.weeklyLeaderboard.refresh(liveData)

    client.weeklyLeaderboard.resetPage()
    let pageData = client.weeklyLeaderboard.getPageData()
    let data = translateLeaderboard(pageData)
    await client.saveAllUsersTime(pinano)

    pinano.channels.find(chan => chan.name === 'practice-room-chat').send({
      embed: {
        title: 'Weekly Leaderboard - Results',
        description: data,
        color: settings.embed_color,
        timestamp: Date.now()
      }
    })
  }
}
