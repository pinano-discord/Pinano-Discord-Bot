const settings = require('../settings/settings.json')

const { makeUser } = require('../library/persistence.js')

const Leaderboard = require('../library/leaderboard.js')
const { PolicyEnforcer } = require('../library/policy_enforcer')
const QuizMaster = require('../library/quiz_master.js')
const SessionManager = require('../library/session_manager.js')
const SubscriberManager = require('../library/subscriber_manager')

let alreadyInitialized = false

module.exports = client => {
  client.on('error', client.log)

  client.on('ready', async () => {
    if (alreadyInitialized) {
      // uh-oh. Looks like we reconnected to Discord after an outage of some sort. This means we've
      // missed some events and we cannot be sure about the state of the world. Forcibly restart
      // the bot WITHOUT saving any sessions. Do unlock rooms, though.
      client.log('WARNING: forcibly restarting Pinano Bot after reconnection to Discord')
      await Promise.all(settings.pinano_guilds.map(guildId => {
        let guild = client.guilds.get(guildId)
        return Promise.all(client.policyEnforcer.getPracticeRooms(guild)
          .map(chan => client.policyEnforcer.unlockPracticeRoom(guild, chan)))
      }))

      client.restart(null, true)
    }

    alreadyInitialized = true
    client.log('Successfully connected to discord.')

    try {
      await client.user.setActivity(settings.activity, { type: 'Playing' })
      client.log(`Successfully set activity to ${settings.activity}`)
    } catch (err) {
      client.log('Could not set activity.')
    }

    // create leaderboard objects
    client.weeklyLeaderboard =
      new Leaderboard(client.userRepository, 'current_session_playtime', settings.leaderboard_size)
    client.overallLeaderboard =
      new Leaderboard(client.userRepository, 'overall_session_playtime', settings.leaderboard_size)
    client.teamLeaderboard =
      new Leaderboard(client.userRepository, 'team_playtime', settings.leaderboard_size)
    client.sessionManager =
      new SessionManager(client.userRepository, client.log)
    client.policyEnforcer = new PolicyEnforcer(client.log)
    client.quizMaster = new QuizMaster(client.userRepository)
    client.subscriberManager = new SubscriberManager(client, client.sessionManager, client.userRepository)

    await Promise.all(settings.pinano_guilds.map(async guildId => {
      let guild = client.guilds.get(guildId)

      // begin any sessions that are already in progress
      client.resume(guild)

      // start the guild update thread
      client.updateInformation(guild)
    }))
  })

  client.on('guildCreate', async guild => {
    if (!settings.pinano_guilds.includes(guild.id)) {
      // immediately leave any guilds that aren't in settings.json
      client.log(`Leaving unauthorized guild ${guild.id}`)
      guild.leave()
    }
  })

  client.on('message', async message => {
    if (message.content.startsWith(`<@${client.user.id}> `)) {
      // convert "@Pinano Bot help" syntax to p!help syntax
      message.content = `${settings.prefix}${message.content.replace(`<@${client.user.id}> `, '').trim()}`
    }

    if (message.channel.name === '🎶literature-quiz') {
      client.quizMaster.handleIncomingMessage(message)
    }

    if (!message.content.startsWith(settings.prefix)) {
      return
    }

    try {
      let tokenized = message.content.split(' ')
      let command = tokenized[0].replace(settings.prefix, '')

      if (!client.commands[command]) {
        throw new Error(`Unknown command: \`${command}\``)
      }

      if (command !== 'eval' && (message.guild == null || !settings.pinano_guilds.includes(message.guild.id))) {
        throw new Error('Please use this bot on the [Pinano server](https://discordapp.com/invite/3q3gWuD).')
      }

      await client.commands[command](client, message)
    } catch (err) {
      client.errorMessage(message, err.message)
    }

    if (message.guild != null) {
      // don't delete commands in DMs, because we can't.
      setTimeout(() => message.delete(), settings.req_destruct_time * 1000)
    }
  })

  client.on('guildMemberUpdate', async (oldMember, newMember) => {
    // if user was assigned/unassigned the Temp Muted role this could have implications
    // for their ability to speak in #practice-room-chat, so recompute.
    await client.policyEnforcer.applyPermissions(newMember.guild, newMember, newMember.voiceChannel)

    let oldTeam = client.getTeamForUser(oldMember)
    let newTeam = client.getTeamForUser(newMember)
    if (oldTeam !== newTeam) {
      // user changed roles; commit the old time (to the old team) and continue
      await client.sessionManager.saveSession(newMember, oldTeam)
    }
  })

  client.on('guildMemberRemove', async member => {
    // they may have left while in a practice room - enforce policy as if they left a channel.
    // TODO: do we want to bother counting their time?
    await client.policyEnforcer.applyPolicy(member.guild, member, member.voiceChannel, null)
  })

  client.on('voiceStateUpdate', async (oldMember, newMember) => {
    if (!settings.pinano_guilds.includes(newMember.guild.id)) {
      return
    }

    // save this as we might delete the old channel and want to keep the emoji around for record keeping.
    let emoji
    if (oldMember.voiceChannel != null) {
      emoji = oldMember.voiceChannel.emoji
    }

    await client.policyEnforcer.applyPolicy(newMember.guild, newMember, oldMember.voiceChannel, newMember.voiceChannel)

    // TODO: if changing the same user multiple times, do a single write
    if (newMember.voiceChannel != null) {
      let listeners = newMember.voiceChannel.members
        .filter(member => !client.isLiveUser(member) && !member.deaf)
      let players = newMember.voiceChannel.members
        .filter(member => client.isLiveUser(member))
      await Promise.all(players.map(async member => {
        let userInfo = await client.userRepository.load(member.id)
        if (userInfo == null) {
          userInfo = makeUser(member.id)
        }
        let maxListeners = userInfo.max_listeners || 0
        if (listeners.size >= maxListeners) {
          userInfo.max_listeners = listeners.size
          await client.userRepository.save(userInfo)
        }
      }))
    }

    if (client.isLiveUser(newMember)) {
      if (oldMember.s_time != null && oldMember.voiceChannel !== newMember.voiceChannel) {
        // user changed channels; save their time in the old channel for badging purposes
        let team = client.getTeamForUser(newMember)
        await client.sessionManager.saveSession(newMember, team, emoji)
      } else {
        client.sessionManager.startSession(newMember)
      }

      let activePracticeChannels = client.policyEnforcer.getPracticeRooms(newMember.guild)
        .filter(channel => channel.members.some(m => m.s_time != null))
      await Promise.all(activePracticeChannels.map(channel => Promise.all(channel.members
        .filter(m => m.s_time != null)
        .map(async member => {
          let userInfo = await client.userRepository.load(member.id)
          let maxConcurrent = userInfo.max_concurrent || 0
          if (activePracticeChannels.size >= maxConcurrent) {
            userInfo.max_concurrent = activePracticeChannels.size
            await client.userRepository.save(userInfo)
          }
        }))
      ))

      let twinnedChannels = activePracticeChannels
        .filter(channel => channel.emoji === newMember.voiceChannel.emoji && channel.emoji != null)
      if (twinnedChannels.size >= 2) {
        await Promise.all(twinnedChannels.map(channel => Promise.all(channel.members
          .filter(m => m.s_time != null)
          .map(async member => {
            let userInfo = await client.userRepository.load(member.id)
            let maxTwinning = userInfo.max_twinning || 0
            if (twinnedChannels.size >= maxTwinning) {
              userInfo.max_twinning = twinnedChannels.size
              await client.userRepository.save(userInfo)
            }
          }))
        ))
      }
    } else {
      let team = client.getTeamForUser(newMember)
      await client.sessionManager.endSession(newMember, team, emoji)
    }
  })
}
