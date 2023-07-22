const { PermissionFlagsBits } = require('discord.js')
const EventEmitter = require('events')
const PeriodicBadges = require('../library/periodic_badges')
const RoomIdentifiers = require('../library/room_identifiers')
const util = require('../library/util')

const MODULE_NAME = 'Policy Enforcer'

class PolicyEnforcer extends EventEmitter {
  constructor (moduleManager) {
    super()

    this._guild = moduleManager.getGuild()
    this._config = moduleManager.getConfig()
    this._moduleManager = moduleManager

    if (this._config.get('managementRoleId') == null) {
      throw new Error('User management commands require a management role ID.')
    }

    if (this._guild.roles.resolve(this._config.get('managementRoleId')) == null) {
      throw new Error('managementRoleId does not refer to a valid role.')
    }

    if (this._config.get('enableExclusiveChat')) {
      if (this._config.get('exclusiveChatChannelId') == null) {
        throw new Error('Exclusive chat was enabled, but no channel ID was specified.')
      }

      this._exclusiveChat = this._guild.channels.resolve(this._config.get('exclusiveChatChannelId'))
      if (this._exclusiveChat == null) {
        throw new Error('exclusiveChatChannelId does not refer to a valid channel.')
      }

      if (this._config.get('exclusiveChatExceptionRoleId') != null) {
        this._exclusiveChatExceptionRole = this._guild.roles.resolve(this._config.get('exclusiveChatExceptionRoleId'))
        if (this._exclusiveChatExceptionRole == null) {
          throw new Error('exclusiveChatExceptionRoleId does not refer to a valid role.')
        }
      }
    }
  }

  resume () {
    this._adapter = this._moduleManager.getModule('Practice Adapter')
    this._pracman = this._moduleManager.getModule('Practice Manager')
    this._tokenCollecting = this._moduleManager.getModule('Token Collecting')

    this._adapter.on('joinPracticeRoom', async (userId, channelId, isMuted, isDeaf) => {
      this._onJoinPracticeRoom(userId, channelId)
      this._applyExclusiveChatPermissions(userId, isMuted, isDeaf)
    })

    this._adapter.on('leavePracticeRoom', async (userId, channelId) => {
      await this._onLeavePracticeRoom(userId, channelId)
      this._applyExclusiveChatPermissions(userId, true, true)
    })

    this._adapter.on('switchPracticeRoom', async (userId, oldChannelId, newChannelId, wasMuted, wasDeaf, isMuted, isDeaf) => {
      await this._onLeavePracticeRoom(userId, oldChannelId)
      this._onJoinPracticeRoom(userId, newChannelId)
      this._applyExclusiveChatPermissions(userId, isMuted, isDeaf)
    })

    this._adapter.on('mute', async (userId, channelId, isDeaf) => {
      this._enforceAutolock(channelId)
      this._applyExclusiveChatPermissions(userId, true, isDeaf)
    })

    this._adapter.on('unmute', async (userId, channelId, isDeaf) => {
      this._enforceAutolock(channelId)
      this._applyExclusiveChatPermissions(userId, false, isDeaf)
    })

    this._adapter.on('deafen', async (userId) => {
      this._applyExclusiveChatPermissions(userId, true, true)
    })

    this._adapter.on('undeafen', async (userId) => {
      this._applyExclusiveChatPermissions(userId, true, false)
    })

    const managementRole = this._guild.roles.resolve(this._config.get('managementRoleId'))
    const dispatcher = this._moduleManager.getDispatcher()
    dispatcher.on('voiceStateUpdate', this._guild.id, (oldState, newState) => {
      if (newState.channel != null && newState.channel !== oldState.channel && newState.serverMute) {
        if (newState.channel.id === this._config.get('voiceChannelId')) {
          // don't unmute people joining the Recital Hall. This is because
          // Discord unmutes override permissions - so someone who doesn't
          // have permissions to speak will still be able to speak, if we
          // proceed with the unmute. We could tie this to actual permissions,
          // but then admins might become unmuted in the Recital Hall by
          // accident. Best to let the unmute process be explicit.
          return
        }
        const tracker = this._pracman._tracker[newState.channel.id]
        if (tracker == null || tracker.lockedBy == null) {
          // the user was probably last a locked room; unmute them if they aren't
          // supposed to be suppressed for other reasons (i.e. being muted). Note
          // that we don't do this in _onJoinPracticeRoom() because the user may
          // have joined a channel that's not a practice room.
          if (this._exclusiveChatExceptionRole == null || !newState.member.roles.cache.has(this._exclusiveChatExceptionRole.id)) {
            this._adapter.unmuteMember(newState.member.id)
          }
        }
      }
    })

    dispatcher.command('lock', this._guild.id, (message, tokenized) => {
      const authorMember = message.member
      let channel = null
      let target = authorMember
      if (tokenized.length > 0) {
        util.requireRole(authorMember, managementRole)

        const USAGE = `${this._config.get('commandPrefix') || 'p!'}lock <#CHANNEL_ID> USERNAME#DISCRIMINATOR`
        util.requireParameterFormat(tokenized[0], arg => arg.startsWith('<#') && arg.endsWith('>'), USAGE)

        const channelId = tokenized.shift().replace(/[<#!>]/g, '')
        channel = this._guild.channels.resolve(channelId)

        const fullyQualifiedName = tokenized.join(' ').trim()
        target = util.resolveUntaggedMember(this._guild, fullyQualifiedName)
      } else if (authorMember.voice != null) {
        channel = authorMember.voice.channel
      }

      if (channel == null || this._pracman._tracker[channel.id] == null) {
        throw new Error(`<@${authorMember.id}>! This isn't the time to use that!`)
      }

      if (!channel.members.has(target.id)) {
        // this might happen if a bot manager locks a channel to an absent user
        throw new Error('The user is not in the specified channel.')
      }

      const tracker = this._pracman._tracker[channel.id]
      if (tracker.lockedBy != null) {
        throw new Error('This channel is already locked.')
      }

      this._lockPracticeRoom(channel, target)
      return {
        embeds: [{
          title: MODULE_NAME,
          description: `<@${authorMember.id}>, locked <#${channel.id}>.`,
          color: this._config.get('embedColor') || 0,
          timestamp: new Date()
        }]
      }
    })

    dispatcher.command('unlock', this._guild.id, (message, tokenized) => {
      const authorMember = message.member
      let channel = null
      if (tokenized.length > 0) {
        util.requireRole(authorMember, managementRole)

        const USAGE = `${this._config.get('commandPrefix') || 'p!'}unlock <#CHANNEL_ID>`
        util.requireParameterCount(1, USAGE)
        util.requireParameterFormat(tokenized[0], arg => arg.startsWith('<#') && arg.endsWith('>'), USAGE)

        const channelId = tokenized[0].replace(/[<#!>]/g, '')
        channel = this._guild.channels.resolve(channelId)
      } else if (authorMember.voice != null) {
        channel = authorMember.voice.channel
      }

      if (channel == null || this._pracman._tracker[channel.id] == null) {
        throw new Error(`<@${authorMember.id}>! This isn't the time to use that!`)
      }

      const tracker = this._pracman._tracker[channel.id]
      if (tracker.lockedBy !== authorMember.id) {
        util.requireRole(authorMember, managementRole, 'You do not have this channel locked.')
      }

      this._unlockPracticeRoom(channel)
      this._adapter.adjustChannelName(channel.id, /* isLocked= */false, tracker.isFeedback, tracker.token)
      return {
        embeds: [{
          title: MODULE_NAME,
          description: `<@${authorMember.id}>, unlocked <#${channel.id}>.`,
          color: this._config.get('embedColor') || 0,
          timestamp: new Date()
        }]
      }
    })

    Object.keys(this._pracman._tracker).forEach(async (channelId) => {
      const channel = this._guild.channels.resolve(channelId)
      let lockedBy = null
      channel.permissionOverwrites.cache.forEach((overwrite, principalId) => {
        if (overwrite.allow.equals(PermissionFlagsBits.Speak | PermissionFlagsBits.Stream) && channel.members.get(principalId) != null) {
          lockedBy = principalId
        }
      })

      if (lockedBy != null) {
        this._pracman.markAsLocked(channelId, lockedBy)
      } else {
        await channel.permissionOverwrites.set(this._config.get('newChannelPermissions') || [])
      }
    })
  }

  _isLoneOccupant (userId, channelId) {
    return !this._pracman._tracker[channelId].live.some(entry => entry.id === userId) &&
      !this._pracman._tracker[channelId].listening.some(entry => entry.id === userId)
  }

  _onJoinPracticeRoom (userId, channelId) {
    if (this._config.get('enableRoomAutocreation')) {
      this._applyRoomAutocreationPolicy()
    }
    const tracker = this._pracman._tracker[channelId]
    if (tracker == null) return
    const channel = this._guild.channels.resolve(channelId)
    if (channel.name.includes('🧧')) {
      // reveal token when someone joins the room
      this._adapter.adjustChannelName(channel.id, tracker.lockedBy != null, tracker.isFeedback, tracker.token)
    }
    if (tracker.lockedBy == null) {
      this._enforceAutolock(channelId)
    } else {
      // if the room is locked, server mute them.
      this._adapter.muteMember(userId)
    }
  }

  async _onLeavePracticeRoom (userId, channelId) {
    let removedChannelId
    if (this._config.get('enableRoomAutocreation')) {
      removedChannelId = await this._applyRoomAutodeletionPolicy()
    }
    const tracker = this._pracman._tracker[channelId]
    if (tracker == null) return
    if (removedChannelId !== channelId) {
      if (tracker.lockedBy === userId) {
        this._unlockPracticeRoom(this._guild.channels.cache.get(channelId))
      }
      this._enforceAutolock(channelId)
    }
  }

  async _applyRoomAutocreationPolicy () {
    const roomTypes = this._config.get('enableFeedbackRooms') ? ['Practice', 'Feedback'] : ['Practice']
    for (const roomType of roomTypes) {
      if (this._adapter.allRoomsOccupied(roomType)) {
        let token = null
        if (this._tokenCollecting != null) {
          token = this._tokenCollecting.generateNewToken()
        }

        // cover Lunar New Year tokens with red pockets
        const displayToken = PeriodicBadges.lunarNewYear.isHappening(new Date()) && RoomIdentifiers.lunarNewYear.includes(token) ? '🧧' : token
        const channelId = await this._adapter.createChannel(
          token == null ? `Extra ${roomType} Room` : `${roomType} Room ${displayToken}`,
          this._config.get('newChannelPermissions'),
          roomType === 'Feedback')
        this._pracman.addPracticeRoom(channelId, roomType === 'Feedback', token)
        if (RoomIdentifiers.exclusive.includes(token)) {
          this._pracman._tracker[channelId].exclusiveAt = Math.floor(Date.now() / 1000)
        }
      }
    }
  }

  async _applyRoomAutodeletionPolicy () {
    const roomTypes = this._config.get('enableFeedbackRooms') ? ['Practice', 'Feedback'] : ['Practice']
    for (const roomType of roomTypes) {
      const removedChannel = await this._adapter.maybeRemoveEmptyRoom(roomType)
      if (removedChannel != null) {
        if (this._tokenCollecting != null) {
          this._tokenCollecting.setMostRecentToken(this._pracman._tracker[removedChannel.id].token)
        }
        await this._pracman.removePracticeRoom(removedChannel.id)
        return removedChannel.id
      }
    }
  }

  _enforceAutolock (channelId) {
    if (!this._config.get('enableAutolock')) {
      return
    }

    const channel = this._guild.channels.resolve(channelId)
    const tracker = this._pracman._tracker[channelId]
    if (tracker == null) return
    if (channel.members.get(tracker.occupant) == null) {
      // occupant has left this room, clear out the value. Basically, start over again.
      // We will destroy the task if it exists below.
      tracker.occupant = null
      tracker.suppressAutolock = false
    }

    if (!tracker.suppressAutolock) {
      if (channel.members.size === 1) {
        tracker.occupant = channel.members.first().id
      }

      const unmutedMembers = channel.members.filter(m => !this._adapter.effectiveMute(m.voice, channel))
      if (unmutedMembers.size === 1 && unmutedMembers.first().id === tracker.occupant) {
        if (tracker.autolockTask == null) {
          const member = unmutedMembers.first()
          tracker.autolockTask = setTimeout(() => {
            if (!tracker.suppressAutolock && tracker.lockedBy == null) {
              this._lockPracticeRoom(channel, member)
            }
          }, (this._config.get('autolockDelayInSeconds') || 120) * 1000)
        }
      } else {
        // destroy the autolock task if we have the wrong number of unmuted members, or the
        // wrong user is unmuted (this includes the case where the occupant has left).
        if (tracker.autolockTask != null) {
          clearTimeout(tracker.autolockTask)
          tracker.autolockTask = null
        }
      }
    }
  }

  _lockPracticeRoom (channel, member) {
    // if channel is null, that means we want the adapter to find out what
    // channel they're in and tell us so we know which channel to mark locked.
    this._adapter.lockPracticeRoom(channel, member)
    const tracker = this._pracman._tracker[channel.id]
    this._adapter.adjustChannelName(channel.id, /* isLocked= */true, tracker.isFeedback, tracker.token)
    this._pracman.markAsLocked(channel.id, member.id)
    this.emit('lockPracticeRoom', member.id, member.user.username)
  }

  _unlockPracticeRoom (channel) {
    this._adapter.unlockPracticeRoom(channel, this._config.get('newChannelPermissions'))
    const tracker = this._pracman._tracker[channel.id]
    this._adapter.adjustChannelName(channel.id, /* isLocked= */false, tracker.isFeedback, tracker.token)
    this._pracman.markAsUnlocked(channel.id)
  }

  _applyExclusiveChatPermissions (userId, isMuted, isDeaf) {
    if (!this._config.get('enableExclusiveChat')) {
      return
    }

    if (!isMuted || !isDeaf) {
      // continue to suppress certain muted roles in the exclusive chat, even
      // if they are properly in a practice room.
      if (this._exclusiveChatExceptionRole == null || !this._guild.members.cache.get(userId).roles.cache.has(this._exclusiveChatExceptionRole.id)) {
        this._exclusiveChat.permissionOverwrites.edit(userId, { SendMessages: true })
      }
    } else {
      const existingOverwrite = this._exclusiveChat.permissionOverwrites.cache.get(userId)
      if (existingOverwrite != null) {
        existingOverwrite.delete()
      }
    }
  }
}

function makeModule (moduleManager) {
  if (!moduleManager.getConfig().get('enablePolicyEnforcer')) return
  return new PolicyEnforcer(moduleManager)
}

module.exports = { name: MODULE_NAME, makeModule: makeModule }
