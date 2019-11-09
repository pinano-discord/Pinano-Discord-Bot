// TODO: decouple settings from policy enforcer
const settings = require('../settings/settings.json')
const Discord = require('discord.js')

function findChannel (guild, name) {
  return guild.channels.find(c => c.name === name)
}

function findRole (guild, name) {
  return guild.roles.find(r => r.name === name)
}

function isTempMuted (member) {
  return member.roles.some(r => r.name === 'Temp Muted')
}

class PolicyEnforcer {
  constructor (guildRepository, logFn) {
    this.guildRepository_ = guildRepository
    this.logFn_ = logFn
  }

  async lockPracticeRoom (guild, channel, member) {
    channel.locked_by = member.id
    if (channel.isTempRoom) {
      channel.unlocked_name = channel.name
      await channel.setName(`${member.user.username}'s room`)
    }

    await channel.overwritePermissions(member.id, { SPEAK: true })
    let everyone = findRole(guild, '@everyone')
    await channel.overwritePermissions(everyone, { SPEAK: false })
    try {
      await Promise.all(channel.members
        .filter(m => m !== member && !m.deleted)
        .map(m => m.setMute(true)))
    } catch (err) {
      // this is likely an issue with trying to mute a user who has already left the channel
      this.logFn_(err)
    }
  }

  async unlockPracticeRoom (guild, channel) {
    if (channel.unlocked_name != null) {
      await channel.setName(channel.unlocked_name)
    }

    // reset permissions overrides
    const pinanoBot = findRole(guild, 'Pinano Bot')
    const tempMuted = findRole(guild, 'Temp Muted')
    const verifRequired = findRole(guild, 'Verification Required')
    const everyone = findRole(guild, '@everyone')
    await channel.replacePermissionOverwrites({
      overwrites: [{
        id: pinanoBot,
        allow: ['MANAGE_CHANNELS', 'MANAGE_ROLES']
      }, {
        id: tempMuted,
        deny: ['SPEAK']
      }, {
        id: verifRequired,
        deny: ['VIEW_CHANNEL']
      }, {
        id: everyone,
        deny: ['MANAGE_CHANNELS', 'MANAGE_ROLES']
      }]
    })

    try {
      await Promise.all(channel.members
        .filter(m => !m.deleted && !isTempMuted(m))
        .map(m => m.setMute(false)))
    } catch (err) {
      // maybe they left already.
      this.logFn_(err)
    }

    // manual unlock is treated as a signal that we don't want autolock enabled. However, unlocking
    // an *empty* room can happen in some circumstances and should not suppress autolock.
    if (channel.members.size !== 0) {
      channel.suppressAutolock = true
    }

    channel.locked_by = null
  }

  async applyPolicy (guild, member, oldChannel, newChannel) {
    await this.maybeLiftServerMute(member, newChannel)
    let deletedRoom = await this.createRemoveRooms(guild)
    await this.applyPermissions(guild, member, newChannel)
    if (deletedRoom !== oldChannel) {
      await this.maybeUnlockRoom(guild, member, oldChannel)
    }
    this.enforceAutolock(guild)
    await this.resetBitrateIfEmpty(oldChannel)
  }

  // if the member is in an unlocked channel that we track, but is server muted, they probably came
  // in from a locked room. Unmute the user, unless someone muted them for a reason.
  async maybeLiftServerMute (member, channel) {
    if (member.serverMute &&
      channel != null &&
      channel.isPermittedChannel &&
      channel.locked_by == null &&
      !isTempMuted(member)) {
      try {
        await member.setMute(false)
      } catch (err) {
        // maybe they left already.
        this.logFn_(err)
      }
    }
  }

  // auto-VC creation: create a room if all rooms are occupied. Muted or unmuted doesn't matter,
  // because in general we want to discourage people from using rooms that are occupied even if all
  // the participants are currently muted. Remove a temp room if there are at least two empty ones.
  async createRemoveRooms (guild) {
    let emptyRooms =
      guild.channels.filter(chan => chan.isPermittedChannel && !chan.members.some(m => !m.deleted))

    if (emptyRooms.size === 0) {
      // no empty rooms; create a new channel
      const categoryChan = findChannel(guild, 'practice-room-chat').parent
      const pinanoBot = findRole(guild, 'Pinano Bot')
      const tempMuted = findRole(guild, 'Temp Muted')
      const verifRequired = findRole(guild, 'Verification Required')
      const everyone = findRole(guild, '@everyone')

      let newChan = await guild.createChannel('Practice Room', {
        type: 'voice',
        parent: categoryChan,
        bitrate: settings.dev_mode ? 96000 : 384000,
        position: categoryChan.children.size,
        permissionOverwrites: [{
          id: pinanoBot,
          allow: ['MANAGE_CHANNELS', 'MANAGE_ROLES']
        }, {
          id: tempMuted,
          deny: ['SPEAK']
        }, {
          id: verifRequired,
          deny: ['VIEW_CHANNEL']
        }, {
          id: everyone,
          deny: ['MANAGE_CHANNELS', 'MANAGE_ROLES']
        }]
      })

      newChan.isPermittedChannel = true
      newChan.isTempRoom = true

      // update the db
      await this.guildRepository_.addToField(guild.id, 'permitted_channels', newChan.id)
    } else if (emptyRooms.size >= 2) {
      // remove an extra room if 1) there are at least two empty rooms and 2) one of those rooms is
      // a temp room. (We don't want to destroy the primary rooms.)
      let emptyRoom = emptyRooms.find(c => c.name === 'Practice Room' || c.isTempRoom)
      if (emptyRoom != null) {
        // before removing the channel from the guild, remove it in the db.
        await this.guildRepository_.removeFromField(guild.id, 'permitted_channels', emptyRoom.id)
        await emptyRoom.delete()
        return emptyRoom
      }
    }
  }

  // members in any practice channel who are not deaf-muted may speak in #practice-room-chat.
  async applyPermissions (guild, member, channel) {
    let prChat = findChannel(guild, 'practice-room-chat')
    if (prChat == null) {
      return
    }

    if (channel != null &&
      channel.isPermittedChannel &&
      !(member.mute && member.selfDeaf) &&
      !isTempMuted(member)) {
      await prChat.overwritePermissions(member.id, { SEND_MESSAGES: true })
    } else {
      // if removing the SEND_MESSAGES permission would result in no permissions allowed or denied,
      // just delete the permissions overwrite completely.
      let overwrite = prChat.permissionOverwrites.get(member.id)
      if (overwrite != null) {
        if (overwrite.allow === Discord.Permissions.FLAGS.SEND_MESSAGES && overwrite.deny === 0) {
          await overwrite.delete()
        } else {
          await prChat.overwritePermissions(member.id, { SEND_MESSAGES: null })
        }
      }
    }
  }

  async maybeUnlockRoom (guild, member, channel) {
    if (channel != null &&
      channel !== member.voiceChannel &&
      channel.locked_by === member.id) {
      // user left a room they had locked; unlock it.
      await this.unlockPracticeRoom(guild, channel)

      // no need to suppress autolock if locking user left
      channel.suppressAutolock = false
    }
  }

  // rough overview of the autolocking heuristic: we autolock a room for a user X if X was the most
  // recent user who was the sole occupant of the room, and the room has had exactly one user
  // unmuted for the last two minutes, and that user was X. Unlocking a room is a hint that
  // autolock is not desired - if so, suppressAutolock is set on the channel and we will never
  // attempt autolock until that flag is cleared (which occurs when a channel becomes empty). If X
  // leaves the room leaving multiple people, autolock will not try to find a new occupant until
  // there is a sole occupant again. Any time there is more than one unmuted user, or the unmuted
  // user is not the occupant, or there are no unmuted users, the timer resets.
  enforceAutolock (guild) {
    guild.channels
      .filter(chan => chan.isPermittedChannel && chan.locked_by == null)
      .forEach(chan => {
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
                  await this.lockPracticeRoom(guild, chan, member)
                }
              }, 2 * 60 * 1000)
            }
          } else {
            // destroy the autolock task if we have the wrong number of unmuted members, or the
            // wrong user is unmuted (this includes the case where the occupant has left).
            if (chan.autolockTask != null) {
              clearTimeout(chan.autolockTask)
              chan.autolockTask = null
            }
          }
        }
      })
  }

  async resetBitrateIfEmpty (channel) {
    let defaultBitrate = settings.dev_mode ? 96 : 384
    if (channel != null &&
      !channel.members.some(m => !m.deleted) &&
      channel.bitrate !== defaultBitrate) {
      return channel.setBitrate(defaultBitrate)
    }
  }
}

module.exports = PolicyEnforcer
