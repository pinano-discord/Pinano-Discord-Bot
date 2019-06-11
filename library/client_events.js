const moment = require('moment')
const Mutex = require('async-mutex').Mutex
const Discord = require('discord.js')

const mutex = new Mutex()

module.exports = client => {
  client.on('error', client.log)

  client.on('ready', async () => {
    client.log('Successfully connected to discord.')

    try {
      await client.user.setActivity(client.settings.activity, { type: 'Playing' })
      client.log(`Successfully set activity to ${client.settings.activity}`)
    } catch (err) {
      client.log('Could not set activity.')
    }

    await client.loadCommands()
    client.log('Successfully loaded commands!')
  })

  client.on('message', async message => {
    if (!client.isValidCommand(message) || !client.commandExist(message)) {
      return
    }

    if (!client.settings.pinano_guilds.includes(message.guild.id)) {
      return client.errorMessage(message, 'This bot can only be used on official Pinano servers.')
    }

    let user = await client.userRepository.load(message.author.id)
    if (user == null) {
      user = client.makeUser(message.author.id)
      await client.userRepository.save(user)
      client.log(`User created for ${message.author.username}#${message.author.discriminator}`)
    }

    try {
      await client.commands[message.content.split(' ')[0].replace(client.settings.prefix, '')](message)
    } catch (err) {
      client.errorMessage(message, err.message)
    }

    setTimeout(() => message.delete(), client.settings.req_destruct_time * 1000)
  })

  client.on('voiceStateUpdate', async (oldMember, newMember) => {
    if (!client.settings.pinano_guilds.includes(newMember.guild.id)) {
      return
    }

    // time handler
    let userInfo = await client.loadUserData(newMember.user.id)

    // auto-VC creation: create a room if all rooms are occupied. Muted or unmuted doesn't matter, because
    // in general we want to discourage people from using rooms that are occupied even if all the participants
    // are currently muted (one person could have been practicing there but just muted temporarily).
    function areAllPracticeRoomsFull (guildInfo) {
      let isFull = true
      guildInfo.permitted_channels.forEach(chanId => {
        let chan = client.guilds.get(newMember.guild.id).channels.get(chanId)
        // channel being null might happen if we have a stale channel in the db - just ignore if this happens.
        if (chan != null && !chan.members.exists(m => !m.deleted)) {
          isFull = false
        }
      })

      return isFull
    }

    // auto-VC creation: remove an extra room if 1) there are at least two empty rooms and 2) one of those
    // rooms is a temp room. (We don't want to destroy the primary rooms.)
    async function removeTempRoomIfPossible (guildInfo) {
      let emptyCount = 0
      let tempChannelToRemove = null
      guildInfo.permitted_channels.forEach(chanId => {
        let chan = client.guilds.get(newMember.guild.id).channels.get(chanId)
        if (chan != null && !chan.members.exists(m => !m.deleted)) {
          emptyCount++
          if (chan.name === 'Extra Practice Room') {
            tempChannelToRemove = chan
          }
        }
      })

      // if tempChannelToRemove is null, it means we didn't find an empty temp channel. Don't do anything.
      if (emptyCount >= 2 && tempChannelToRemove != null) {
        // before removing the channel from the guild, remove it in the db.
        guildInfo['permitted_channels'].splice(guildInfo.permitted_channels.indexOf(tempChannelToRemove.id), 1)
        await client.writeGuildData(newMember.guild.id, guildInfo)
        tempChannelToRemove.delete()
      }
    }

    function updatePracticeRoomChatPermissions (guildInfo, newMember) {
      // if in any practice channel, member has rights to speak in practice room chat (can be muted)
      let prChan = client.guilds.get(newMember.guild.id).channels.find(chan => chan.name === 'practice-room-chat')
      if (prChan == null) {
        client.log('Cannot find #practice-room-chat!')
      } else if (guildInfo.permitted_channels.includes(newMember.voiceChannelID) && !(newMember.mute && newMember.selfDeaf)) {
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

    // if the user doesn't exist then create a user for the person
    if (userInfo == null) {
      userInfo = {
        'id': newMember.user.id,
        'current_session_playtime': 0,
        'overall_session_playtime': 0
      }
      await client.writeUserData(newMember.user.id, userInfo)
      client.log(`User created for ${newMember.user.username}#${newMember.user.discriminator}`)
    } else {
      if (newMember.serverMute && newMember.voiceChannel != null && newMember.voiceChannel.locked_by == null && !newMember.roles.exists(r => r.name === 'Temp Muted')) {
        // they're server muted, but they're in an unlocked channel - means they probably left a locked room.
        try {
          newMember.setMute(false)
        } catch (err) {
          // did they leave already?
          console.log(err)
        }
      }

      if (oldMember.voiceChannel != null && oldMember.voiceChannel.locked_by === oldMember.id && newMember.voiceChannelID !== oldMember.voiceChannelID) {
        // user left a room they had locked; unlock it
        await client.unlockPracticeRoom(oldMember.guild, oldMember.id, oldMember.voiceChannel)
      }

      mutex.runExclusive(async () => {
        let guildInfo = await client.loadGuildData(newMember.guild.id)
        if (guildInfo == null) {
          await client.createGuild(newMember.guild.id)
          client.log('Created new guild.')
        } else {
          updatePracticeRoomChatPermissions(guildInfo, newMember)

          // run auto-VC creation logic
          if (areAllPracticeRoomsFull(guildInfo)) {
            let newChan = await client.guilds.get(newMember.guild.id).createChannel('Extra Practice Room', 'voice')

            // make the new channel go in the right place
            let categoryChan = client.guilds.get(newMember.guild.id).channels.find(chan => chan.name === 'practice-room-chat').parent
            newChan = await newChan.setParent(categoryChan)
            newChan.setPosition(categoryChan.children.size)

            // gotta update the db
            guildInfo['permitted_channels'].push(newChan.id)
            await client.writeGuildData(newMember.guild.id, guildInfo)
          } else {
            removeTempRoomIfPossible(guildInfo)
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

            const playtime = moment().unix() - newMember.s_time
            userInfo.current_session_playtime += playtime
            userInfo.overall_session_playtime += playtime

            const hourrole = '529404918885384203'
            // const activerole = '542790691617767424'

            if (userInfo.overall_session_playtime >= 40 * 60 * 60 && !newMember.roles.has(hourrole)) {
              try {
                await newMember.addRole(hourrole)
                await newMember.send('You have achieved the 40 hour pracker role!')
              } catch (err) {
                client.log(`error awarding user ${newMember.username} the forty hour role`)
              }
            }

            await client.writeUserData(newMember.user.id, userInfo)
            client.log(`User ${newMember.user.username}#${newMember.user.discriminator} practiced for ${playtime} seconds`)
            newMember.s_time = null
            oldMember.s_time = null
          }
        }
      })
    }
  })
}
