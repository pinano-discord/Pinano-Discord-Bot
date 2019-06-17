const hd = require('humanize-duration')
const moment = require('moment')
const settings = require('./settings/settings.json')

module.exports = (client) => {
  client.findCurrentPrackers = async (guild) => {
    // playtimes only get updated when a user leaves/mutes a channel. Therefore, in order to keep up-to-date statistics,
    // find out what users are currently in permitted voice channels, then add their times as if current.
    let guildInfo = await client.guildRepository.load(guild.id)
    let currentPrackers = new Map()

    guildInfo.permitted_channels
      .map(chanId => guild.channels.get(chanId))
      .filter(chan => chan != null)
      .forEach(chan => {
        chan.members
          .filter(member => !member.mute && member.s_time != null && !member.deleted)
          .forEach(member => currentPrackers.set(member.user.id, moment().unix() - member.s_time))
      })

    return currentPrackers
  }

  client.getOverallLeaderboard = async (guild, user) => {
    let msgStr = await client.getLeaderboard(guild, p => p.overall_session_playtime,
      size => client.userRepository.loadTopOverall(size))
    let posStr = await client.getOverallLeaderboardPos(guild, user.id)
    return `**${user.username}**, you are rank ${posStr}\n${msgStr}`
  }

  client.getWeeklyLeaderboard = async (guild, user) => {
    let msgStr = await client.getLeaderboard(guild, p => p.current_session_playtime,
      size => client.userRepository.loadTopSession(size))

    if (user != null) {
      let posStr = await client.getWeeklyLeaderboardPos(guild, user.id)
      return `**${user.username}**, you are rank ${posStr}\n${msgStr}`
    } else {
      return msgStr
    }
  }

  client.getLeaderboard = async (guild, playtimeFn, loadTopFn) => {
    let leaderboard = []

    let topPrackers = await loadTopFn(settings.leaderboard_size)
    topPrackers.forEach(pracker => leaderboard.push({ userId: pracker.id, time: playtimeFn(pracker) }))

    let currentPrackers = await client.findCurrentPrackers(guild)
    for (let [currentId, currentTime] of currentPrackers) {
      let lbEntry = leaderboard.find(p => p.userId === currentId)
      if (lbEntry == null) {
        // we didn't get this current pracker as part of the top N, so pull from DB and calculate their total time.
        let currentPracker = await client.userRepository.load(currentId)
        if (currentPracker != null) {
          currentTime += playtimeFn(currentPracker)
        }

        leaderboard.push({ userId: currentId, time: currentTime })
      } else {
        // this current pracker is part of the top N. Calculate their total time.
        lbEntry.time += currentTime
      }
    }

    leaderboard.sort((a, b) => b.time - a.time)

    let msgStr = ''
    for (let j = 0; j < settings.leaderboard_size; j++) {
      if (leaderboard[j] == null || leaderboard[j].time === 0) {
        break
      }

      let timeStr = hd(leaderboard[j].time * 1000, { units: ['h', 'm', 's'] })
      let user = client.users.get(leaderboard[j].userId)
      if (user != null) {
        msgStr += `**${j + 1}. ${user.username}#${user.discriminator}**\n \`${timeStr}\`\n`
      } else {
        msgStr += `**${j + 1}.** *${leaderboard[j].userId}* \n \`${timeStr}\`\n`
      }
    }

    return msgStr
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
        if (otherUser == null || playtimeFn(otherUser) === 0) {
          // an active user who won't show up in getSessionCount() => increment the total number of users
          totalCount++
        } else {
          otherTime += playtimeFn(otherUser)
        }

        otherTime += currentTime
        if (otherTime > totalTime) {
          // this active user has passed us
          tentativeRank++
        }
      }
    }

    return `\`${tentativeRank}\` / \`${totalCount}\``
  }

  client.submitWeek = async () => {
    let pinano = client.guilds.get('188345759408717825')
    let data = await client.getWeeklyLeaderboard(pinano, null)
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
