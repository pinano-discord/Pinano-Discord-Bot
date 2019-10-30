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

  // rough overview of the heuristic: we autolock a room for a user X if X was the most recent
  // user who was the sole occupant of the room, and the room has had exactly one user unmuted
  // for the last five minutes, and that user was X. Unlocking a room is a hint that autolock
  // is not desired - if so, suppressAutolock is set on the channel and we will never attempt
  // autolock until that flag is cleared (which occurs when a channel becomes empty). If X
  // leaves the room leaving multiple people, autolock will not try to find a new occupant
  // until there is a sole occupant again. Any time there is more than one unmuted user, or
  // the unmuted user is not the occupant, or there are no unmuted users, the timer resets.
  client.enforceAutolock = (chan) => {
    let members = chan.members.filter(m => !m.deleted)
    if (members.get(chan.occupant) == null) {
      // occupant has left this room, clear out the value. Basically, start over again.
      // We will destroy the task if it exists below.
      chan.occupant = null
      chan.suppressAutolock = false
    }

    if (!chan.suppressAutolock) {
      if (members.size === 1) {
        chan.occupant = members.first().id
      }

      let unmutedMembers = members.filter(m => !m.mute)
      if (unmutedMembers.size === 1 && unmutedMembers.first().id === chan.occupant) {
        if (chan.autolockTask == null) {
          let member = unmutedMembers.first()
          chan.autolockTask = setTimeout(async () => {
            if (!chan.suppressAutolock && chan.locked_by == null) {
              await client.lockPracticeRoom(chan.guild, chan, member)
            }
          }, 2 * 60 * 1000)
        }
      } else {
        // wrong number of unmuted members: destroy the task.
        // wrong user is unmuted: destroy the task.
        // occupant has left: chan.occupant is null, task gets destroyed again.
        if (chan.autolockTask != null) {
          clearTimeout(chan.autolockTask)
          chan.autolockTask = null
        }
      }
    }
  }

  client.lockPracticeRoom = async (guild, channel, mem) => {
    channel.locked_by = mem.id
    if (channel.isTempRoom) {
      channel.unlocked_name = channel.name
      await channel.setName(`${mem.user.username}'s room`)
    }
    await channel.overwritePermissions(mem.user, { SPEAK: true })
    let everyone = guild.roles.find(r => r.name === '@everyone')
    await channel.overwritePermissions(everyone, { SPEAK: false }) // deny everyone speaking permissions
    try {
      await Promise.all(channel.members.map(async (m) => {
        if (m !== mem && !m.deleted) {
          return m.setMute(true)
        }
      }))
    } catch (err) {
      // this is likely an issue with trying to mute a user who has already left the channel
      client.log(err)
    }
  }

  client.unlockPracticeRoom = async (guild, channel) => {
    if (channel.unlocked_name != null) {
      await channel.setName(channel.unlocked_name)
    }

    // reset permissions overrides
    let pinanoBot = guild.roles.find(r => r.name === 'Pinano Bot')
    let tempMutedRole = guild.roles.find(r => r.name === 'Temp Muted')
    let verificationRequiredRole = guild.roles.find(r => r.name === 'Verification Required')
    let everyone = guild.roles.find(r => r.name === '@everyone')
    await channel.replacePermissionOverwrites({
      overwrites: [{
        id: pinanoBot,
        allow: ['MANAGE_CHANNELS', 'MANAGE_ROLES']
      }, {
        id: tempMutedRole,
        deny: ['SPEAK']
      }, {
        id: verificationRequiredRole,
        deny: ['VIEW_CHANNEL']
      }, {
        id: everyone,
        deny: ['MANAGE_CHANNELS', 'MANAGE_ROLES']
      }]
    })

    try {
      await Promise.all(channel.members.map(async m => {
        if (!m.deleted && !m.roles.some(r => r.name === 'Temp Muted')) {
          return m.setMute(false)
        }
      }))
    } catch (err) {
      // this is likely an issue with trying to mute a user who has already left the channel
      client.log(err)
    }

    // manual unlock is treated as a signal that we don't want autolock enabled.
    // unlocking an *empty* room can happen in some automatic circumstances and
    // should not suppress autolock.
    if (channel.members.size !== 0) {
      channel.suppressAutolock = true
    }

    channel.locked_by = null
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
    let guildInfo = await client.guildRepository.load(guild.id)
    await Promise.all(
      guildInfo.permitted_channels
        .map(chanId => guild.channels.get(chanId))
        .filter(chan => chan != null)
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

    // unlock extra rooms so that we can identify them as temp rooms when we come back up
    message = await message.edit(`${message.content} saved.\nUnlocking extra rooms...`)
    await Promise.all(
      guild.channels
        .filter(chan => chan.isTempRoom)
        .map(chan => client.unlockPracticeRoom(guild, chan)))

    message = await message.edit(`${message.content} unlocked.\nRestarting Pinano Bot...`)
    process.exit(0)
  }

  // a user is live if they are:
  // 1. not a bot (so we exclude ourselves and Craig)
  // 2. unmuted
  // 3. in a permitted channel
  // 4. that is not locked by someone else
  client.isLiveUser = (member, permittedChannels) => {
    return !member.user.bot &&
      !member.mute &&
      permittedChannels.includes(member.voiceChannelID) &&
      member.voiceChannel != null &&
      (member.voiceChannel.locked_by == null || member.voiceChannel.locked_by === member.id)
  }

  client.resume = async (guild) => {
    let infoChan = guild.channels.find(c => c.name === 'information')
    let messages = await infoChan.fetchMessages()
    let message = messages.find(m => m.content.startsWith('Beginning restart procedure...'))
    if (message != null) {
      message = await message.edit(`${message.content} ready.\nDetecting room status...`)
    }

    let guildInfo = await client.guildRepository.load(guild.id)
    let everyone = guild.roles.find(r => r.name === '@everyone')
    await Promise.all(guildInfo.permitted_channels
      .map(chanId => guild.channels.get(chanId))
      .filter(chan => chan != null)
      .map(chan => {
        if (chan.name === 'Extra Practice Room') {
          chan.isTempRoom = true

          // assume that if there's only one person playing in a temp room, it should be locked to them.
          let unmuted = chan.members.filter(m => !m.deleted && !m.mute)
          if (unmuted.size === 1) {
            return client.lockPracticeRoom(guild, chan, unmuted.first())
          }
        } else {
          let shouldUnlock = true

          // a room should be considered locked if there is an individual override granting SPEAK
          // and the everyone role is denied SPEAK, and that individual is in the channel.
          if (chan.permissionOverwrites.get(everyone.id).denied.has(Discord.Permissions.FLAGS.SPEAK)) {
            let overwrite = chan.permissionOverwrites.find(o => o.type === 'member')
            if (overwrite != null) {
              let member = guild.members.get(overwrite.id)
              if (member != null && member.voiceChannelID === chan.id) {
                shouldUnlock = false
                chan.locked_by = member.id
              }
            }
          }

          if (shouldUnlock) {
            // reset the permissions just in case they're borked
            return client.unlockPracticeRoom(guild, chan)
          }
        }
      }))

    if (message != null) {
      message = await message.edit(`${message.content} marked locked rooms.\nResuming active sessions...`)
    }

    guildInfo.permitted_channels
      .map(chanId => guild.channels.get(chanId))
      .filter(chan => chan != null)
      .forEach(chan => {
        chan.members.forEach(m => {
          if (client.isLiveUser(m, guildInfo.permitted_channels)) {
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
      let displayName = (chan.locked_by != null && chan.isTempRoom) ? chan.unlocked_name : chan.name
      rooms += `\n\n${displayName} | ${chan.bitrate}kbps`
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

    let guildInfo = await client.guildRepository.load(guild.id)
    client.roomInfo =
      guildInfo.permitted_channels
        .map(chanId => guild.channels.get(chanId))
        .filter(chan => chan != null && chan.members.some(m => !m.deleted))
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
