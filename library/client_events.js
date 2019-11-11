const moment = require('moment')
const Leaderboard = require('../library/leaderboard.js')
const PolicyEnforcer = require('../library/policy_enforcer.js')
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
    client.policyEnforcer = new PolicyEnforcer(client.log)

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
  })

  client.on('voiceStateUpdate', async (oldMember, newMember) => {
    if (!settings.pinano_guilds.includes(newMember.guild.id)) {
      return
    }

    await client.policyEnforcer.applyPolicy(newMember.guild, newMember, oldMember.voiceChannel, newMember.voiceChannel)

    // n.b. if this is the first time the bot sees a user, s_time may be undefined but *not* null. Therefore, == (and not ===)
    // comparison is critical here. Otherwise, when they finished practicing, we'll try to subtract an undefined value, and we'll
    // record that they practiced for NaN seconds. This is really bad because adding NaN to their existing time produces more NaNs.
    if (client.isLiveUser(newMember) && oldMember.s_time == null) {
      client.log(`Beginning session for user <@${newMember.user.id}> ${newMember.user.username}#${newMember.user.discriminator}`)
      newMember.s_time = moment().unix()
    } else if (oldMember.s_time != null) {
      // this might happen if a live session jumps across channels, or if a live session is ending.
      // in either case we want newMember.s_time to be populated with the old one (either we need it
      // for the time calculation before commit, or we transfer the start time to the new session).
      newMember.s_time = oldMember.s_time
    }

    if (!client.isLiveUser(newMember)) {
      // if they aren't live, commit the session to the DB if they were live before.
      if (newMember.s_time == null) {
        return
      }

      await client.saveUserTime(newMember)

      // client.saveUserTime() commits the time to the DB and sets s_time to current time.
      // Our user has actually stopped practicing, so set s_time to be null instead.
      newMember.s_time = null
      oldMember.s_time = null
    }
  })
}
