const Discord = require('discord.js')
const moment = require('moment')
const settings = require('../settings/settings.json')

let timeoutIds = new Map()

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

  client.unlockPracticeRoom = async (guild, userId, channel) => {
    if (channel.unlocked_name != null) {
      await channel.setName(channel.unlocked_name)
    }

    // remove permissions overrides
    let everyone = guild.roles.find(r => r.name === '@everyone')
    await channel.overwritePermissions(everyone, { SPEAK: null })

    let personalOverride = channel.permissionOverwrites.get(userId)
    // existingOverride shouldn't be null unless someone manually deletes the override, but if for some reason it's gone, no big deal, just move on.
    if (personalOverride != null) {
      if (personalOverride.allowed.bitfield === Discord.Permissions.FLAGS.SPEAK && personalOverride.denied.bitfield === 0) { // the only permission was allow SPEAK
        await personalOverride.delete()
      } else {
        await channel.overwritePermissions(userId, { SPEAK: null })
      }
    }

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

    const hourRole = member.guild.roles.find(r => r.name === '40 Hour Pracker')
    if (userInfo.overall_session_playtime >= 40 * 60 * 60 && !member.roles.has(hourRole.id)) {
      try {
        await member.addRole(hourRole)
        await member.send('You have achieved the 40 hour pracker role!')
      } catch (err) {
        client.log(`Error awarding user ${member.user.username} the forty hour role`)
      }
    }

    await client.userRepository.save(userInfo)
    client.log(`User ${member.user.username}#${member.user.discriminator} practiced for ${playtime} seconds`)

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

  client.patrolThread = async (guildInfo, guild) => {
    if (timeoutIds.has(guild.id)) {
      clearTimeout(timeoutIds.get(guild.id))
    }

    let possibleChannels = guildInfo.permitted_channels
      .map(chanId => guild.channels.get(chanId))
      .filter(chan => chan != null && chan.members.some(mem => mem.s_time != null))
    let existingConnection = client.voiceConnections.get(guild.id)

    if (possibleChannels.length === 0) {
      // nobody to listen to
      if (existingConnection != null) {
        existingConnection.disconnect()
      }
    } else {
      let currentIndex = -1
      if (existingConnection != null) {
        currentIndex = possibleChannels.indexOf(existingConnection.channel)
      }

      let newChannel = possibleChannels[(currentIndex + 1) % possibleChannels.length]
      let connection = await newChannel.join()
      if (connection.listeners('speaking').length === 0) {
        connection.on('speaking', (user, speaking) => client.log(`${user.username} is ${speaking ? 'speaking' : 'not speaking'}`))
      }
    }

    let timeoutId = setTimeout(() => client.patrolThread(guildInfo, guild), 60 * 1000)
    timeoutIds.set(guild.id, timeoutId)
  }
}
