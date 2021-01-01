const cron = require('node-cron')
const RoomIdentifiers = require('../library/room_identifiers')
const util = require('../library/util')

const MODULE_NAME = 'Token Collecting'

function getCurrentTimeToken () {
  return RoomIdentifiers.timeBased[new Date().getUTCHours() % 12]
}

function containsNoneOf (list, items) {
  let result = true
  items.forEach(item => {
    if (list.includes(item)) {
      result = false
    }
  })
  return result
}

class TokenCollecting {
  constructor (moduleManager) {
    this._config = moduleManager.getConfig()
    this._moduleManager = moduleManager
    this._deletedTokens = []
  }

  resume () {
    const guild = this._moduleManager.getGuild()
    const userRepository = this._moduleManager.getPersistence().getUserRepository(guild.id)
    this._adapter = this._moduleManager.getModule('Practice Adapter')
    this._pracman = this._moduleManager.getModule('Practice Manager')
    if (this._pracman == null) {
      throw new Error('enableTokenCollecting is true, but there is no practice manager to attach to.')
    }

    if (this._config.get('enableTimeBasedTokens')) {
      cron.schedule('0 * * * *', () => {
        const newToken = getCurrentTimeToken()
        const now = Math.floor(Date.now() / 1000)
        Object.keys(this._pracman._tracker).forEach(channelId => {
          const tracker = this._pracman._tracker[channelId]
          if (RoomIdentifiers.timeBased.includes(tracker.token)) {
            tracker.live
              .filter(entry => now - entry.since >= this._config.get('minimumSessionTimeToEarnToken'))
              .forEach(entry => userRepository.addToSet(entry.id, 'rooms_practiced', tracker.token))
            this._adapter.adjustChannelName(channelId, tracker.lockedBy, tracker.isFeedback, newToken)
            tracker.token = newToken
          }
        })
      })
    }

    // monkeys only stick around for fifteen minutes. If there's someone in the
    // process of claiming the token, then give them a reprieve.
    cron.schedule('* * * * *', () => {
      Object.keys(this._pracman._tracker).forEach(channelId => {
        const tracker = this._pracman._tracker[channelId]
        if (RoomIdentifiers.exclusive.includes(tracker.token) && (Math.floor(Date.now() / 1000) - tracker.exclusiveAt >= 900) && guild.channels.resolve(channelId).members.size > 0 && tracker.live.length === 0) {
          // don't bother making an announcement about a disappearing monkey if
          // nobody's around. (I guess if the only users are deafened, there
          // won't be a notification either. It doesn't really matter.)
          if (tracker.listening.length > 0) {
            this._adapter.notifyExclusiveTokenExpired(tracker.token)
          }
          const recycledToken = tracker.token
          this.resetExclusiveToken(channelId)
          this.setMostRecentToken(recycledToken)
        }
      })
    })

    cron.schedule('*/5 * * * *', () => {
      if (Object.values(this._pracman._tracker).find(tracker => RoomIdentifiers.exclusive.includes(tracker.token)) == null) {
        // if there's a monkey token in the stack, surface it as quickly as possible.
        let newToken = null
        for (const exclusiveToken of RoomIdentifiers.exclusive) {
          const spliceIndex = this._deletedTokens.findIndex(t => t === exclusiveToken)
          if (spliceIndex !== -1) {
            this._deletedTokens.splice(spliceIndex)
            newToken = exclusiveToken
          }
        }

        // otherwise, 1% random chance of generating a rare or a monkey.
        if (newToken == null && Math.floor(Math.random() * 100) === 42) {
          if (this._config.get('enableExclusiveTokens') && Math.floor(Math.random() * 100) % 2 === 0) {
            newToken = util.pickRandomFromList(RoomIdentifiers.exclusive)
          } else {
            newToken = util.pickRandomFromList(RoomIdentifiers.rare)
          }
        }

        if (newToken == null) return

        // take the empty channel (not a feedback room) and turn it into the
        // desired token (either forced or randomly spawned).
        const channelId = Object.keys(this._pracman._tracker).find(channelId => {
          const channel = guild.channels.cache.get(channelId)
          return channel != null && channel.members.size === 0 && !channel.name.includes('Feedback')
        })
        if (channelId != null) {
          const tracker = this._pracman._tracker[channelId]
          this._adapter.adjustChannelName(channelId, tracker.lockedBy, tracker.isFeedback, newToken)
          if (RoomIdentifiers.exclusive.includes(newToken)) {
            tracker.exclusiveAt = Math.floor(Date.now() / 1000)
          }
          tracker.originalToken = tracker.token
          tracker.token = newToken
        }
      }
    })

    this._adapter.on('joinPracticeRoom', async (userId, channelId) => {
      const channel = guild.channels.resolve(channelId)
      const tracker = this._pracman._tracker[channelId]
      if (channel.members.size === 1 && RoomIdentifiers.exclusive.includes(tracker.token)) {
        // latch the first user into an exclusive room so that they can't gift
        // the room to another user.
        tracker.firstIntoRoom = userId
      }
    })

    this._adapter.on('switchPracticeRoom', async (userId, _, newChannelId) => {
      const channel = guild.channels.resolve(newChannelId)
      const tracker = this._pracman._tracker[newChannelId]
      if (channel.members.size === 1 && RoomIdentifiers.exclusive.includes(tracker.token)) {
        // latch the first user into an exclusive room so that they can't gift
        // the room to another user.
        tracker.firstIntoRoom = userId
      }
    })

    this._pracman.on('incrementPrackingTime', async (userRecord, delta, channelId, token) => {
      const userId = userRecord.id
      if (delta >= this._config.get('minimumSessionTimeToEarnToken') && token != null) {
        const secondsSinceHourInterval = Math.floor(Date.now() / 1000) % 3600
        if (!RoomIdentifiers.timeBased.includes(token) || secondsSinceHourInterval >= this._config.get('minimumSessionTimeToEarnToken')) {
          let claimed = false
          if (RoomIdentifiers.exclusive.includes(token)) {
            if (userId === this._pracman._tracker[channelId].firstIntoRoom) {
              // if the user claimed an exclusive token, take it away from
              // anybody else who has it. If they completed the set, give them
              // the badge, and announce it if it's the first time.
              userRepository.clearFromAllExcept('rooms_practiced', token, userRecord.id)
              const result = await userRepository.addToSet(userId, 'rooms_practiced', token)
              let completedSet = false
              if (RoomIdentifiers.exclusive.every(monkey => result.rooms_practiced.includes(monkey)) && !(userRecord.badges || []).includes('monkey_v2')) {
                userRepository.addToSet(userRecord.id, 'badges', 'monkey_v2')
                completedSet = true
              }
              this._adapter.notifyTokenTransfer(userRecord.id, token, completedSet)
              claimed = true
            } else {
              // deny monkey tokens that are held for someone else.
              util.log(`Exclusive token denied: userId=${userId} firstIntoRoom=${this._pracman._tracker[channelId].firstIntoRoom}`)
              this._adapter.notifyExclusiveTokenDenied(token)
            }
          } else {
            userRepository.addToSet(userId, 'rooms_practiced', token)
          }
          if (RoomIdentifiers.rare.includes(token) || RoomIdentifiers.exclusive.includes(token)) {
            // if the user claimed a globe or a monkey, reset the channel token
            // so that nobody else can claim it from this room. Also, award the
            // token that they originally had as well.
            this.resetExclusiveToken(channelId)
            const originalToken = this._pracman._tracker[channelId].originalToken
            if (originalToken != null) {
              userRepository.addToSet(userId, 'rooms_practiced', originalToken)
            }
          }
          // if the user was denied the token for any reason, put it back on the
          // token queue immediately.
          if (!claimed && RoomIdentifiers.exclusive.includes(token)) {
            this.setMostRecentToken(token)
          }
        }
      }
      if (this._config.get('enableCustomTokens') && userRecord.overall_session_playtime >= userRecord.egg_hatch_time) {
        // some light trolling
        const defaultOverride = (this._config.get('alwaysGetsDefault') || []).includes(userId)
        const random = Math.floor(Math.random() * 100)

        let hatched
        if (defaultOverride || random < this._config.get('defaultCustomTokenProbability')) {
          // if the user has none of the custom tokens, give them one to start.
          if (containsNoneOf(userRecord.rooms_practiced, this._config.get('rareCustomTokens')) && containsNoneOf(userRecord.rooms_practiced, this._config.get('customTokens'))) {
            hatched = util.pickRandomFromList(this._config.get('customTokens'), userRecord.rooms_practiced)
          } else {
            hatched = this._config.get('defaultCustomToken')
          }
        } else if (random < (this._config.get('defaultCustomTokenProbability') + this._config.get('rareCustomTokenProbability'))) {
          hatched = util.pickRandomFromList(this._config.get('rareCustomTokens'), userRecord.rooms_practiced)
        } else {
          // regular case
          hatched = util.pickRandomFromList(this._config.get('customTokens'), userRecord.rooms_practiced)
        }
        userRepository.hatchCustomToken(userId, hatched)
        this._adapter.notifyEggHatched(userId, hatched)
      }
    })

    this._pracman.on('incrementListeningTime', (userRecord, prackerId, delta) => {
      const userId = userRecord.id
      if (this._config.get('enableCustomTokens') && delta >= this._config.get('minimumSessionTimeToEarnToken')) {
        userRepository.addToSet(userId, 'rooms_practiced', '🥚')

        if (userRecord.egg_hatch_time == null) {
          const eggHatchTime = (userRecord.overall_session_playtime || 0) +
            this._config.get('timeToHatchCustomToken') + Math.floor(Math.random() * (this._config.get('hatchCustomTokenTimeRange') || 7200))
          userRepository.setField(userId, 'egg_hatch_time', eggHatchTime)
          this._adapter.notifyEggObtained(userId)
        }
      }
    })
  }

  resetExclusiveToken (channelId) {
    const tracker = this._pracman._tracker[channelId]
    const originalToken = tracker.originalToken || this.generateNewToken()
    this._adapter.adjustChannelName(channelId, tracker.isLocked, tracker.isFeedback, originalToken)
    tracker.token = originalToken
    tracker.originalToken = null
    tracker.exclusiveAt = null
    tracker.firstIntoRoom = null
  }

  generateNewToken () {
    // prevent users from hogging and burying exclusive tokens: if an exclusive
    // token is anywhere in the queue, surface it (unless there is already one
    // active, in very unusual circumstances).
    if (Object.values(this._pracman._tracker).find(tracker => RoomIdentifiers.exclusive.includes(tracker.token)) == null) {
      for (const exclusiveToken of RoomIdentifiers.exclusive) {
        const spliceIndex = this._deletedTokens.findIndex(t => t === exclusiveToken)
        if (spliceIndex !== -1) {
          this._deletedTokens.splice(spliceIndex)
          return exclusiveToken
        }
      }
    }

    // otherwise, recycle the next token in the stack if it's been less than
    // the regeneration interval since the last deletion.
    const current = new Date()
    const recycledToken = this._deletedTokens.pop()
    const regenerationInterval = this._config.get('regenerateNewTokenInterval') || 300
    if (recycledToken != null && (Math.floor(current.getTime() / 1000) - this._deletedAt) < regenerationInterval) {
      if (RoomIdentifiers.timeBased.includes(recycledToken)) {
        // the time-based token may have changed.
        return getCurrentTimeToken()
      }

      return recycledToken
    }

    // the deleted tokens stack is too old - clear it and we'll start again.
    this._deletedTokens = []
    if (current.getMonth() === 11 && current.getDate() >= 20) {
      return util.pickRandomFromList(RoomIdentifiers.christmas)
    } else if (current.getMonth() === 9 && current.getDate() >= 24) {
      return util.pickRandomFromList(RoomIdentifiers.halloween)
    } else if (current.getMonth() === 3 && current.getDate() >= 1 && current.getDate() <= 7) {
      return util.pickRandomFromList(RoomIdentifiers.rickroll)
    } else if (current.getMonth() === 1 && current.getDate() >= 13 && current.getDate() < 20) {
      return util.pickRandomFromList(RoomIdentifiers.valentines)
    } else {
      if (this._config.get('enableTimeBasedTokens') && Math.floor(Math.random() * 100) < 10) {
        return getCurrentTimeToken()
      }

      return util.pickRandomFromList(RoomIdentifiers.onDemand)
    }
  }

  // saves recently deleted room tokens, so that repeatedly rejoining a room to
  // get a new token is not a viable strategy.
  setMostRecentToken (token) {
    if (!RoomIdentifiers.rare.includes(token)) {
      this._deletedTokens.push(token)
      this._deletedAt = Math.floor(Date.now() / 1000)
    }
  }
}

function makeModule (moduleManager) {
  if (!moduleManager.getConfig().get('enableTokenCollecting')) return
  return new TokenCollecting(moduleManager)
}

module.exports = { name: MODULE_NAME, makeModule: makeModule }
