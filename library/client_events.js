const Leaderboard = require('../library/leaderboard.js')
const PolicyEnforcer = require('../library/policy_enforcer.js')
const QuizMaster = require('../library/quiz_master.js')
const SessionManager = require('../library/session_manager.js')
const settings = require('../settings/settings.json')

module.exports = client => {
  client.on('error', client.log)

  client.on('ready', async () => {
    client.log('Successfully connected to discord.')

    try {
      await client.user.setActivity(settings.activity, { type: 'Playing' })
      client.log(`Successfully set activity to ${settings.activity}`)
    } catch (err) {
      client.log('Could not set activity.')
    }

    await client.loadCommands()
    client.log('Successfully loaded commands!')

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

      await client.commands[command](message)
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

  client.on('voiceStateUpdate', async (oldMember, newMember) => {
    if (!settings.pinano_guilds.includes(newMember.guild.id)) {
      return
    }

    await client.policyEnforcer.applyPolicy(newMember.guild, newMember, oldMember.voiceChannel, newMember.voiceChannel)

    if (client.isLiveUser(newMember)) {
      client.sessionManager.startSession(newMember)
    } else {
      let team = client.getTeamForUser(newMember)
      await client.sessionManager.endSession(newMember, team)
    }
  })
}
