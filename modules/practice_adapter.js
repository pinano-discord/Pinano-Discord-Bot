const { InteractionCollector, MessageActionRow, MessageButton, MessageEmbed } = require('discord.js')
const EventEmitter = require('events')
const log = require('../library/util').log

const MODULE_NAME = 'Practice Adapter'

class PracticeAdapter extends EventEmitter {
  constructor (moduleManager) {
    super()

    this._client = moduleManager.getClient()
    this._guild = moduleManager.getGuild()
    this._config = moduleManager.getConfig()
    this._moduleManager = moduleManager

    if (this._config.get('practiceRoomCategoryId') == null) {
      throw new Error('enablePracticeManager is true, but no category ID was specified.')
    }

    this._category = this._guild.channels.resolve(this._config.get('practiceRoomCategoryId'))
    if (this._category == null) {
      throw new Error('practiceRoomCategoryId does not refer to a valid category.')
    }

    if (this._config.get('enableLeaderboardDisplay')) {
      if (this._config.get('informationChannelId') == null) {
        throw new Error('enableLeaderboardDisplay is true, but no information channel was specified.')
      }

      this._informationChannel = this._guild.channels.resolve(this._config.get('informationChannelId'))
      if (this._informationChannel == null) {
        throw new Error('informationChannelId does not refer to a valid channel.')
      }
    }

    if (this._config.get('postLeaderboardOnReset') || (this._config.get('enableTokenCollecting') && this._config.get('announceCustomTokens'))) {
      if (this._config.get('announcementsChannelId') == null) {
        throw new Error('postLeaderboardOnReset is true, but no channel ID was specified.')
      }

      this._announcementsChannel = this._guild.channels.resolve(this._config.get('announcementsChannelId'))
      if (this._guild.channels.resolve(this._config.get('announcementsChannelId')) == null) {
        throw new Error('announcementsChannelId does not refer to a valid category.')
      }
    }
  }

  resume () {
    const dispatcher = this._moduleManager.getDispatcher()
    dispatcher.on('channelCreate', this._guild.id, channel => {
      if (channel.parent !== this._category) {
        return
      }

      const tokenMatch = channel.name.match(/Room (.*?)$/)
      this.emit('createPracticeRoom', channel.id, channel.name.includes('Feedback'), (tokenMatch == null) ? null : tokenMatch[1])
    })
    dispatcher.on('channelDelete', this._guild.id, channel => {
      if (channel.parent !== this._category) {
        return
      }

      this.emit('deletePracticeRoom', channel.id)
    })
    dispatcher.on('channelUpdate', this._guild.id, (oldChannel, newChannel) => {
      if (newChannel.parent !== this._category || newChannel.type !== 'GUILD_VOICE') {
        return
      }

      // when the permissions are updated, some members may find themselves
      // unmuted, but we don't get a voiceStateUpdate. Handle that case here.
      newChannel.members.forEach(async member => {
        if (this.effectiveMute(member.voice, oldChannel) && !this.effectiveMute(member.voice, newChannel)) {
          this.emit('unmute', member.id, newChannel.id, member.voice.deaf)
        } else if (!this.effectiveMute(member.voice, oldChannel) && this.effectiveMute(member.voice, newChannel)) {
          this.emit('mute', member.id, newChannel.id, member.voice.deaf)
        }
      })
    })
    dispatcher.on('voiceStateUpdate', this._guild.id, (oldState, newState) => {
      const oldChannelIsTracked = oldState.channel != null && oldState.channel.parent === this._category
      const newChannelIsTracked = newState.channel != null && newState.channel.parent === this._category
      if (!oldChannelIsTracked && !newChannelIsTracked) {
        // not interested in this event
        return
      }

      if (!oldChannelIsTracked && newChannelIsTracked) {
        // user joined a channel
        const isMuted = this.effectiveMute(newState, newState.channel)
        this.emit('joinPracticeRoom', newState.member.id, newState.channel.id, isMuted, newState.deaf)
      } else if (oldChannelIsTracked && !newChannelIsTracked) {
        // user left a channel
        const wasMuted = this.effectiveMute(oldState, oldState.channel)
        this.emit('leavePracticeRoom', newState.member.id, oldState.channel.id, wasMuted, oldState.deaf)
      } else {
        const wasMuted = this.effectiveMute(oldState, oldState.channel)
        const isMuted = this.effectiveMute(newState, newState.channel)
        if (oldState.channel.id !== newState.channel.id) {
          // user switched channels
          this.emit('switchPracticeRoom', newState.member.id, oldState.channel.id, newState.channel.id, wasMuted, oldState.deaf, isMuted, newState.deaf)
        } else if (!wasMuted && isMuted) {
          // user muted
          this.emit('mute', newState.member.id, newState.channel.id, newState.deaf)
        } else if (wasMuted && !isMuted) {
          // user unmuted
          this.emit('unmute', newState.member.id, newState.channel.id, oldState.deaf)
        } else if (isMuted && !oldState.deaf && newState.deaf) {
          // user deafened
          this.emit('deafen', newState.member.id, newState.channel.id)
        } else if (isMuted && oldState.deaf && !newState.deaf) {
          // user undeafened
          this.emit('undeafen', newState.member.id, newState.channel.id)
        }
      }
    })
  }

  notifyEggHatched (userId, hatched) {
    if (this._config.get('enableCustomTokens') && this._config.get('announceCustomTokens')) {
      if (hatched == null) {
        if (this._config.get('customTokenFailureMessage') != null) {
          this._announcementsChannel.send(`Uh-oh, <@${userId}>! ${this._config.get('customTokenFailureMessage')}`)
        } else {
          this._announcementsChannel.send(`Oops! <@${userId}>, your :egg: got fried. :cooking:`)
        }
      } else {
        this._announcementsChannel.send(`Congratulations, <@${userId}>! Your :egg: hatched into a ${hatched}!`)
      }
    }
  }

  notifyEggObtained (userId) {
    if (this._config.get('enableCustomTokens') && this._config.get('announceCustomTokens')) {
      this._announcementsChannel.send(`<@${userId}>, you earned a :egg:!`)
    }
  }

  notifyTokenTransfer (userId, token, completedSet) {
    this._announcementsChannel.send(`The wise monkey ${token} was claimed by <@${userId}>!${completedSet ? ` <@${userId}> has collected all three wise monkeys!` : ''}`)
  }

  notifyExclusiveTokenExpired (token) {
    this._announcementsChannel.send(`The wise monkey ${token} ran away. \`"I haven't got all day!"\``)
  }

  notifyExclusiveTokenDenied (token) {
    this._announcementsChannel.send(`The wise monkey ${token} won't respond. \`"Someone else was here first!"\``)
  }

  getCurrentState () {
    const currentTimestamp = Math.floor(Date.now() / 1000)
    const result = {}
    this._category.children.filter(c => c.type === 'GUILD_VOICE').forEach(channel => {
      const tokenMatch = channel.name.match(/Room (.*?)$/)
      result[channel.id] = {
        live: channel.members.filter(m => !this.effectiveMute(m.voice, channel)).map(m => {
          return {
            id: m.id,
            since: currentTimestamp
          }
        }),
        listening: channel.members.filter(m => this.effectiveMute(m.voice, channel) && !m.voice.deaf).map(m => {
          return {
            id: m.id,
            since: currentTimestamp
          }
        }),
        isFeedback: channel.name.includes('Feedback'),
        token: (tokenMatch == null) ? null : tokenMatch[1]
      }
    })
    return result
  }

  effectiveMute (voiceState, channel) {
    return voiceState.mute || !channel.permissionsFor(voiceState.member).has('SPEAK')
  }

  _translateLeaderboard (page) {
    let reducer
    if (page.formatAsTime) {
      reducer = (msgStr, row, index) => {
        let seconds = row.time
        let minutes = Math.floor(seconds / 60)
        const hours = Math.floor(minutes / 60)
        seconds %= 60
        minutes %= 60
        seconds = ('00' + seconds).slice(-2)
        minutes = ('00' + minutes).slice(-2)

        const timeStr = `${hours}:${minutes}:${seconds}`
        return msgStr + `**${page.startRank + index}. <@${page.data[index].id}>**\n \`${timeStr}\`\n`
      }
    } else {
      reducer = (msgStr, row, index) => {
        return msgStr + `**${page.startRank + index}. <@${page.data[index].id}>**\n \`${row.time}\`\n`
      }
    }

    const data = page.data.reduce(reducer, '')
    return (data === '') ? '\u200B' : data
  }

  // Update the leaderboards. This doesn't strictly have to be done in the practice adapter, but
  // for historical reasons (namely, the first leaderboards were all for stats measured by the
  // practice manager) the updating is done in this module.
  async updateInformation (interaction) {
    const practiceManager = this._moduleManager.getModule('Practice Manager')
    const literatureQuiz = this._moduleManager.getModule('Literature Quiz')

    const leaderboards = []
    const actionRows = []
    const leaderboardConfig = this._config.get('leaderboards')
    if (leaderboardConfig == null) return
    leaderboardConfig.forEach(leaderboard => {
      switch (leaderboard) {
        case 'WEEKLY':
          if (practiceManager != null) {
            leaderboards.push(practiceManager._weeklyLeaderboard)
          }
          break
        case 'OVERALL':
          if (practiceManager != null) {
            leaderboards.push(practiceManager._overallLeaderboard)
          }
          break
        case 'LISTENER':
          if (practiceManager != null) {
            leaderboards.push(practiceManager._topListeners)
          }
          break
        case 'LITQUIZ':
          if (literatureQuiz != null) {
            leaderboards.push(literatureQuiz._leaderboard)
          }
          break
      }
    })

    const embed = new MessageEmbed()
      .setTitle('Information')
      .setColor(this._config.get('embedColor') || 'DEFAULT')
      .setTimestamp(Date.now())
    leaderboards.forEach((leaderboard, index) => {
      embed.addField(leaderboard.title, this._translateLeaderboard(leaderboard.getPageData()), true)
      // Force two columns per row and space between rows.
      if (index < leaderboards.length - 1) {
        embed.addField('\u200B', '\u200B', index % 2 === 0)
      }
      actionRows.push(new MessageActionRow()
        .addComponents(new MessageButton().setCustomId(`${index}r`).setStyle('PRIMARY').setEmoji('⏪'))
        .addComponents(new MessageButton().setCustomId(`${index}p`).setStyle('PRIMARY').setEmoji('◀'))
        .addComponents(new MessageButton().setCustomId(`${index}l`).setStyle('SECONDARY').setLabel(leaderboard.title))
        .addComponents(new MessageButton().setCustomId(`${index}n`).setStyle('PRIMARY').setEmoji('▶'))
        .addComponents(new MessageButton().setCustomId(`${index}f`).setStyle('PRIMARY').setEmoji('⏩')))
    })

    const messages = await this._informationChannel.messages.fetch()
    let message = messages.find(m => m.author === this._client.user)
    if (interaction != null) {
      interaction.update({ embeds: [embed], components: actionRows })
    } else if (message == null) {
      message = await this._informationChannel.send({ embeds: [embed], components: actionRows })
    } else {
      message.edit({ embeds: [embed], components: actionRows })
    }

    if (this._informationInteractionCollector == null) {
      this._informationInteractionCollector = new InteractionCollector(this._client, { message: message })
      this._informationInteractionCollector.on('collect', interaction => {
        if (!interaction.isButton()) return
        // there can be a maximum of five leaderboards, so grabbing the first digit is safe.
        const lbIndex = interaction.customId[0]
        const command = interaction.customId[1]
        switch (command) {
          case 'r':
            leaderboards[lbIndex].resetPage()
            this.updateInformation(interaction)
            break
          case 'p':
            leaderboards[lbIndex].decrementPage()
            this.updateInformation(interaction)
            break
          case 'n':
            leaderboards[lbIndex].incrementPage()
            this.updateInformation(interaction)
            break
          case 'f':
            leaderboards[lbIndex].endPage()
            this.updateInformation(interaction)
            break
          default:
            interaction.deferUpdate()
            break
        }
      })
    }
  }

  async postLeaderboard (leaderboard) {
    if (this._config.get('postLeaderboardOnReset')) {
      // First unpin any old leaderboards
      // Assume that all pinned messages in the announcementChannel by the bot are leaderboards
      this._announcementsChannel.messages.fetchPinned()
        .then(pinned => pinned.filter(msg => msg.author === this._client.user)
          .forEach(msg => msg.unpin()))

      // Post the new leaderboard
      const message = await this._announcementsChannel.send({
        embeds: [{
          title: 'Weekly Leaderboard - Results',
          description: this._translateLeaderboard(leaderboard.getPageData()),
          color: this._config.get('embedColor') || 'DEFAULT',
          timestamp: Date.now()
        }]
      })
      message.pin()
    }
  }

  muteMember (memberId) {
    const member = this._guild.members.cache.get(memberId)
    member.voice.setMute(true).catch(err => {
      log(`Failed to mute ${memberId}: ${err.message}. This message is safe to ignore.`)
    })
  }

  unmuteMember (memberId) {
    this._guild.members.cache.get(memberId).voice.setMute(false)
      .catch(err => {
        log(`Failed to unmute ${memberId}: ${err.message} This message is safe to ignore.`)
      })
  }

  allRoomsOccupied (roomType) {
    return this._category.children.filter(chan => chan.type === 'GUILD_VOICE' && chan.name.includes(roomType)).every(chan => chan.members.size > 0)
  }

  async createChannel (name, permissions, atFront) {
    const channel = await this._guild.channels.create(name, {
      type: 'GUILD_VOICE',
      parent: this._category,
      bitrate: (this._config.get('bitrate') || 96) * 1000,
      position: atFront ? 1 : this._category.children.size,
      permissionOverwrites: permissions || []
    })
    return channel.id
  }

  maybeRemoveEmptyRoom (roomType) {
    const practiceRooms = this._category.children
      .filter(chan => chan.type === 'GUILD_VOICE' && chan.name.includes(roomType))
      .sort((a, b) => a.position - b.position)
    if (practiceRooms.size > 0) {
      const basePosition = practiceRooms.first().position
      const emptyRooms = practiceRooms.filter(chan => chan.members.size === 0).sort((a, b) => a.createdTimestamp - b.createdTimestamp)
      if (emptyRooms.size >= 2 && practiceRooms.size > (this._config.get('minimumRooms') || 4)) {
        const roomToRemove = this._config.get('preserveOriginalRooms') ? emptyRooms.find(room => room.position >= basePosition + (this._config.get('minimumRooms') || 4)) : emptyRooms.first()
        if (roomToRemove != null) {
          return roomToRemove.delete()
        }
      }
    }
  }

  lockPracticeRoom (channel, member) {
    channel.permissionOverwrites.create(member.id, { STREAM: true, SPEAK: true })
    channel.permissionOverwrites.edit(this._guild.roles.everyone, { STREAM: false, SPEAK: false })
    channel.members
      .filter(m => m !== member)
      .forEach(m => m.voice.setMute(true)
        .catch(err => {
          log(`Failed to mute ${m.id}: ${err.message}. This message is safe to ignore.`)
        }))
    // if they locked the room after someone else unlocked the room, then Discord won't apply new
    // permissions to them without us explicitly unmuting them.
    member.voice.setMute(false)
      .catch(err => {
        log(`Failed to unmute ${member.id}: ${err.message}. This message is safe to ignore.`)
      })
  }

  unlockPracticeRoom (channel, permissions) {
    // reset permissions to original
    channel.permissionOverwrites.set(permissions || [])
    // 2020/07/25: after too many instances of people accidentally being
    // unmuted after the occupant left and automatically unlocked, we decided
    // to make it so that users have to rejoin in order to be unmuted in a
    // room that has just been unlocked.
    //
    // channel.members.forEach(m => {
    //   m.voice.setMute(false)
    //     .catch(err => {
    //       log(`Failed to unmute ${m.id}: ${err.message} This message is safe to ignore.`)
    //     })
    // })
  }

  adjustChannelName (channelId, isLocked, isFeedback, token) {
    // don't adjust channel names when we don't have a token; it's probably a custom room.
    if (token == null) return
    const channel = this._guild.channels.cache.get(channelId)
    if (channel != null) {
      return channel.setName(`${isLocked ? '🔒' : ''} ${isFeedback ? 'Feedback' : 'Practice'} Room ${token}`)
    }
  }

  notifyUntrackedRoom (channelId) {
    if (this._announcementsChannel != null) {
      this._announcementsChannel.send(`WARNING: not tracking time for <#${channelId}>.`)
    }
  }
}

function makeModule (moduleManager) {
  if (!moduleManager.getConfig().get('enablePracticeManager')) return
  return new PracticeAdapter(moduleManager)
}

module.exports = { name: MODULE_NAME, makeModule: makeModule }
