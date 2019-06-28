const Discord = require('discord.js')
const moment = require('moment')
const settings = require('../settings/settings.json')

// auto-VC creation: create a room if all high-bitrate rooms are occupied. Muted or unmuted doesn't matter, because
// in general we want to discourage people from using rooms that are occupied even if all the participants
// are currently muted (one person could have been practicing there but just muted temporarily).
function areAllPracticeRoomsFull (permittedChannels, guild) {
  let isFull = true
  permittedChannels.forEach(chanId => {
    let chan = guild.channels.get(chanId)
    // channel being null might happen if we have a stale channel in the db - just ignore if this happens.
    if (chan != null && chan.bitrate !== 64 && !chan.members.some(m => !m.deleted)) {
      isFull = false
    }
  })

  return isFull
}

// remove an extra room if 1) there are at least two empty rooms and 2) one of those
// rooms is a temp room. (We don't want to destroy the primary rooms.)
async function findChannelToRemove (permittedChannels, guild) {
  let emptyRooms = permittedChannels
    .map(chanId => guild.channels.get(chanId))
    .filter(chan => chan != null && !chan.members.some(m => !m.deleted))

  let tempChannelToRemove = null
  if (emptyRooms.length >= 2) {
    if (emptyRooms.filter(chan => chan.bitrate !== 64).length <= 1) {
      // there's at most one high-bitrate room - remove the first temp channel that's low-bitrate, if it exists
      tempChannelToRemove = emptyRooms.find(c => c.bitrate === 64 && (c.name === 'Extra Practice Room' || c.isTempRoom))
    } else {
      // just remove the first temp channel, regardless of bitrate
      tempChannelToRemove = emptyRooms.find(c => c.name === 'Extra Practice Room' || c.isTempRoom)
    }
  }

  return tempChannelToRemove
}

function updatePracticeRoomChatPermissions (permittedChannels, newMember) {
  // if in any practice channel, member has rights to speak in practice room chat (can be muted)
  let prChan = newMember.guild.channels.find(chan => chan.name === 'practice-room-chat')
  if (prChan == null) {
    return
  }

  if (permittedChannels.includes(newMember.voiceChannelID) && !(newMember.mute && newMember.selfDeaf)) {
    prChan.overwritePermissions(newMember.user, { SEND_MESSAGES: true })
  } else {
    let existingOverride = prChan.permissionOverwrites.get(newMember.user.id)
    // existingOverride shouldn't be null unless someone manually deletes the override, but if for some reason it's gone, no big deal, just move on.
    if (existingOverride != null) {
      if (existingOverride.allowed.bitfield === Discord.Permissions.FLAGS.SEND_MESSAGES && existingOverride.denied.bitfield === 0) { // the only permission was allow SEND_MESSAGES
        existingOverride.delete()
      } else {
        prChan.overwritePermissions(newMember.user, { SEND_MESSAGES: null })
      }
    }
  }
}

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
        throw new Error(`Unknown command: ${command}`)
      }

      if (!settings.pinano_guilds.includes(message.guild.id)) {
        throw new Error('This bot can only be used on official Pinano servers.')
      }

      await client.commands[command](message)
    } catch (err) {
      client.errorMessage(message, err.message)
    }

    setTimeout(() => message.delete(), settings.req_destruct_time * 1000)
  })

  client.on('voiceStateUpdate', async (oldMember, newMember) => {
    if (!settings.pinano_guilds.includes(newMember.guild.id)) {
      return
    }

    if (newMember.serverMute && newMember.voiceChannel != null && newMember.voiceChannel.locked_by == null && !newMember.roles.some(r => r.name === 'Temp Muted')) {
      // they're server muted, but they're in an unlocked channel - means they probably left a locked room.
      try {
        newMember.setMute(false)
      } catch (err) {
        // did they leave already?
        client.log(err)
      }
    }

    if (oldMember.voiceChannel != null && oldMember.voiceChannel.locked_by === oldMember.id && newMember.voiceChannelID !== oldMember.voiceChannelID) {
      // user left a room they had locked; unlock it
      await client.unlockPracticeRoom(oldMember.guild, oldMember.id, oldMember.voiceChannel)
    }

    let guildInfo = await client.guildRepository.load(newMember.guild.id)
    if (guildInfo == null) {
      guildInfo = client.makeGuild(newMember.guild.id)
      await client.guildRepository.save(guildInfo)
      client.log('Created new guild.')
      return
    }

    updatePracticeRoomChatPermissions(guildInfo.permitted_channels, newMember)

    // run auto-VC creation logic
    if (areAllPracticeRoomsFull(guildInfo.permitted_channels, newMember.guild)) {
      let categoryChan = newMember.guild.channels.find(chan => chan.name === 'practice-room-chat').parent
      let tempMutedRole = newMember.guild.roles.find(r => r.name === 'Temp Muted')
      let mutedRole = newMember.guild.roles.find(r => r.name === 'Muted')
      let verificationRequiredRole = newMember.guild.roles.find(r => r.name === 'Verification Required')

      let newChan = await newMember.guild.createChannel('Extra Practice Room', {
        type: 'voice',
        parent: categoryChan,
        bitrate: settings.dev_mode ? 96000 : 256000,
        position: categoryChan.children.size,
        permissionOverwrites: [{
          id: tempMutedRole,
          deny: ['SPEAK']
        }, {
          id: mutedRole,
          deny: ['SPEAK']
        }, {
          id: verificationRequiredRole,
          deny: ['VIEW_CHANNEL']
        }]
      })

      newChan.isTempRoom = true

      // update the db
      await client.guildRepository.addToField(guildInfo, 'permitted_channels', newChan.id)
    } else {
      let tempChannelToRemove = await findChannelToRemove(guildInfo.permitted_channels, newMember.guild)
      if (tempChannelToRemove != null) {
        // before removing the channel from the guild, remove it in the db.
        await client.guildRepository.removeFromField(guildInfo, 'permitted_channels', tempChannelToRemove.id)
        tempChannelToRemove.delete()
      }
    }

    // n.b. if this is the first time the bot sees a user, s_time may be undefined but *not* null. Therefore, == (and not ===)
    // comparison is critical here. Otherwise, when they finished practicing, we'll try to subtract an undefined value, and we'll
    // record that they practiced for NaN seconds. This is really bad because adding NaN to their existing time produces more NaNs.
    if (!newMember.selfMute &&
      !newMember.serverMute &&
      oldMember.s_time == null &&
      guildInfo.permitted_channels.includes(newMember.voiceChannelID) &&
      newMember.voiceChannel != null &&
      (newMember.voiceChannel.locked_by == null || newMember.voiceChannel.locked_by === newMember.id)) {
      // if they are unmuted and a start time dosnt exist and they are in a good channel and the room is not locked by someone else
      newMember.s_time = moment().unix()
    } else if (oldMember.s_time != null) {
      // if a start time exist transfer it to new user object
      newMember.s_time = oldMember.s_time
    }

    // if user gets muted or leaves or transfers to a bad channel
    if (newMember.voiceChannelID === null || !guildInfo.permitted_channels.includes(newMember.voiceChannelID) || newMember.selfMute || newMember.serverMute) {
      if (newMember.s_time == null) {
        return
      }

      // if the user doesn't exist then create a user for the person
      let userInfo = await client.userRepository.load(newMember.user.id)
      if (userInfo == null) {
        userInfo = {
          'id': newMember.user.id,
          'current_session_playtime': 0,
          'overall_session_playtime': 0
        }
        await client.userRepository.save(userInfo)
        client.log(`User created for ${newMember.user.username}#${newMember.user.discriminator}`)
      }

      const playtime = moment().unix() - newMember.s_time
      userInfo.current_session_playtime += playtime
      userInfo.overall_session_playtime += playtime

      const hourRole = newMember.guild.roles.find(r => r.name === '40 Hour Pracker')
      if (userInfo.overall_session_playtime >= 40 * 60 * 60 && !newMember.roles.has(hourRole.id)) {
        try {
          await newMember.addRole(hourRole)
          await newMember.send('You have achieved the 40 hour pracker role!')
        } catch (err) {
          client.log(`Error awarding user ${newMember.user.username} the forty hour role`)
        }
      }

      await client.userRepository.save(userInfo)
      client.log(`User ${newMember.user.username}#${newMember.user.discriminator} practiced for ${playtime} seconds`)
      newMember.s_time = null
      oldMember.s_time = null
    }
  })
}
