const cron = require('node-cron')
const EventEmitter = require('events')
const Leaderboard = require('../library/leaderboard')
const { log, logError } = require('../library/util')

const MODULE_NAME = 'Practice Manager'

class PracticeManager extends EventEmitter {
  constructor (moduleManager, timestampFn) {
    super()

    const guildId = moduleManager.getGuild().id
    this._timestampFn = timestampFn
    this._userRepository = moduleManager.getPersistence().getUserRepository(guildId)
    this._config = moduleManager.getConfig()
    this._moduleManager = moduleManager

    // validation
    if (this._config.get('enableCustomTokens')) {
      if (this._config.get('customTokens') == null || this._config.get('customTokens').length === 0) {
        throw new Error('enableCustomTokens is true, but no custom tokens were provided.')
      }

      if (this._config.get('rareCustomTokenProbability') > 0 && (this._config.get('rareCustomTokens') || []).length === 0) {
        throw new Error('rareCustomTokenProbability is non-zero, but the rare custom token list is empty.')
      }

      if (this._config.get('timeToHatchCustomToken') == null) {
        throw new Error('enableCustomTokens is true, but no hatch time was provided.')
      }
    }
  }

  resume () {
    this._adapter = this._moduleManager.getModule('Practice Adapter')
    this._tracker = this._adapter.getCurrentState()
    if (!this._config.get('enablePolicyEnforcer') || !this._config.get('enableRoomAutocreation')) {
      this._adapter.on('createPracticeRoom', (channelId, isFeedback, token) => {
        this.addPracticeRoom(channelId, isFeedback, token)
      })

      this._adapter.on('deletePracticeRoom', (channelId) => {
        this.removePracticeRoom(channelId)
      })
    }

    this._adapter.on('joinPracticeRoom', (userId, channelId, isMuted, isDeaf) => {
      log(`joinPracticeRoom ${userId} ${channelId} ${isMuted} ${isDeaf}`)
      if (!isMuted) {
        this._startPracticing(userId, channelId)
      } else if (!isDeaf) {
        this._startListening(userId, channelId)
      }
    })

    this._adapter.on('leavePracticeRoom', (userId, channelId, wasMuted, wasDeaf) => {
      log(`leavePracticeRoom ${userId} ${channelId} ${wasMuted} ${wasDeaf}`)
      if (!wasMuted) {
        this._stopPracticing(userId, channelId)
      } else if (!wasDeaf) {
        this._stopListening(userId, channelId)
      }
    })

    this._adapter.on('switchPracticeRoom', (userId, oldChannelId, newChannelId, wasMuted, wasDeaf, isMuted, isDeaf) => {
      log(`switchPracticeRoom ${userId} ${oldChannelId} ${newChannelId} ${wasMuted} ${wasDeaf} ${isMuted} ${isDeaf}`)
      if (!wasMuted) {
        this._stopPracticing(userId, oldChannelId)
      } else if (!wasDeaf) {
        this._stopListening(userId, oldChannelId)
      }

      if (!isMuted) {
        this._startPracticing(userId, newChannelId)
      } else if (!isDeaf) {
        this._startListening(userId, newChannelId)
      }
    })

    this._adapter.on('unmute', async (userId, channelId, wasDeaf) => {
      log(`unmute ${userId} ${channelId} ${wasDeaf}`)
      if (!wasDeaf) {
        this._stopListening(userId, channelId)
      }
      this._startPracticing(userId, channelId)
    })

    this._adapter.on('mute', (userId, channelId, isDeaf) => {
      log(`mute ${userId} ${channelId} ${isDeaf}`)
      this._stopPracticing(userId, channelId)
      if (!isDeaf) {
        this._startListening(userId, channelId)
      }
    })

    this._adapter.on('deafen', (userId, channelId) => {
      log(`deafen ${userId} ${channelId}`)
      this._stopListening(userId, channelId)
    })

    this._adapter.on('undeafen', async (userId, channelId) => {
      log(`undeafen ${userId} ${channelId}`)
      this._startListening(userId, channelId)
    })

    this._weeklyLeaderboard = new Leaderboard(this._userRepository, 'current_session_playtime', this._config.get('leaderboardSize') || 10, 'Weekly Leaderboard')
    this._overallLeaderboard = new Leaderboard(this._userRepository, 'overall_session_playtime', this._config.get('leaderboardSize') || 10, 'Top Prackers')
    this._topListeners = new Leaderboard(this._userRepository, 'listening_time', this._config.get('leaderboardSize') || 10, 'Top Listeners')
    if (this._config.get('enableLeaderboardDisplay')) {
      const updateCronSpec = this._config.get('updateLeaderboardCronSpec') || '*/15 * * * * *'
      cron.schedule(updateCronSpec, async () => {
        const currentTimestamp = this._timestampFn()

        const livePraccData = new Map()
        for (const channelId in this._tracker) {
          this._tracker[channelId].live.forEach(entry => {
            livePraccData.set(entry.id, currentTimestamp - entry.since)
          })
        }

        await this._weeklyLeaderboard.refresh(livePraccData)
        await this._overallLeaderboard.refresh(livePraccData)

        const liveListenData = new Map()
        for (const channelId in this._tracker) {
          const pracker = this._tracker[channelId].live[0]
          if (pracker != null) {
            this._tracker[channelId].listening.forEach(entry => {
              liveListenData.set(entry.id, currentTimestamp - Math.max(pracker.since, entry.since))
            })
          }
        }

        await this._topListeners.refresh(liveListenData)
        this._adapter.updateInformation(this._weeklyLeaderboard, this._overallLeaderboard, this._topListeners)
      })
    }

    if (this._config.get('resetCronSpec') != null) {
      cron.schedule(this._config.get('resetCronSpec'), async () => {
        await this.saveAllSessions()
        await this._weeklyLeaderboard.refresh()
        this._weeklyLeaderboard.resetPage()
        this._adapter.postLeaderboard(this._weeklyLeaderboard)
        this._userRepository.resetSessionTimes()
      })
    }

    // this provides additional defense against ghost sessions.
    if (this._config.get('enableSanityCheck')) {
      cron.schedule('* * * * *', async () => {
        this._validateTracker()
      })
    }
  }

  _validateTracker () {
    const actual = this._adapter.getCurrentState()
    for (const channelId in this._tracker) {
      for (let i = 0; i < this._tracker[channelId].live.length; i++) {
        const entry = this._tracker[channelId].live[i]
        if (actual[channelId] == null || !actual[channelId].live.some(e => e.id === entry.id)) {
          logError(`Removing ${entry.id} from channel ${channelId} because it was not found in the authoritative list!`)
          logError('This may happen because we were temporarily disconnected.')
          this._tracker[channelId].live.splice(i, 1)
        }
      }
    }
  }

  async saveAllSessions () {
    const currentTimestamp = this._timestampFn()
    for (const channelId in this._tracker) {
      const channelTracker = this._tracker[channelId]
      if (channelTracker.live.length > 0) {
        // the oldest pracker is always first
        const maxPrackerDelta = currentTimestamp - channelTracker.live[0].since
        await Promise.all(channelTracker.listening.map(async (listener) => {
          await this._incrementListeningTime(listener.id, channelTracker.live[0].id, Math.min(currentTimestamp - listener.since, maxPrackerDelta))
        }))

        await Promise.all(channelTracker.live.map(async (pracker) => {
          const delta = currentTimestamp - pracker.since
          pracker.since = currentTimestamp
          await this._incrementPrackingTime(pracker.id, delta, channelId, channelTracker.token)
        }))
      }
    }
  }

  addPracticeRoom (channelId, isFeedback, token) {
    this._tracker[channelId] = {
      live: [],
      listening: [],
      isFeedback: isFeedback,
      token: token
    }
  }

  removePracticeRoom (channelId) {
    if (this._tracker[channelId].live.length > 0 || this._tracker[channelId].length > 0) {
      // this might happen if someone slipped into the room before we've
      // removed it. To preserve consistency, abort the removal.
      logError(`WARNING: tried to remove channel ${channelId} which we think is non-empty!`)
      return
    }
    if (this._tracker[channelId].autolockTask != null) {
      clearTimeout(this._tracker[channelId].autolockTask)
    }
    delete this._tracker[channelId]
  }

  markAsLocked (channelId, memberId) {
    this._tracker[channelId].lockedBy = memberId
  }

  markAsUnlocked (channelId) {
    this._tracker[channelId].lockedBy = null
  }

  _startPracticing (userId, channelId) {
    log(`- startPracticing ${userId} ${channelId}`)
    this._tracker[channelId].live.push({
      id: userId,
      since: this._timestampFn()
    })
  }

  _startListening (userId, channelId) {
    log(`- startListening ${userId} ${channelId}`)
    this._tracker[channelId].listening.push({
      id: userId,
      since: this._timestampFn()
    })
  }

  _stopPracticing (userId, channelId) {
    log(`- stopPracticing ${userId} ${channelId}`)
    const channelTracker = this._tracker[channelId]
    if (channelTracker == null) {
      logError(`stopPracticing failed because there is no channel tracker for channel ${channelId}.`)
      return
    }
    const currentTimestamp = this._timestampFn()
    const index = channelTracker.live.findIndex(r => r.id === userId)
    if (index === -1) {
      logError(`stopPracticing failed because user ${userId} was not found in the channel ${channelId} live list.`)
      return
    }

    const userTracker = channelTracker.live.splice(index, 1)[0]
    const prackerDelta = currentTimestamp - userTracker.since
    this._incrementPrackingTime(userId, prackerDelta, channelId, channelTracker.token)

    if (channelTracker.live.length === 0) {
      // credit the listeners for time spent listening
      channelTracker.listening.forEach(listener => {
        const listenerDelta = currentTimestamp - listener.since
        this._incrementListeningTime(listener.id, userId, Math.min(prackerDelta, listenerDelta))
      })
    } else {
      // in the corner case where there were two or more live users, find
      // the new eldest pracker, and credit everybody with the delta. The
      // eldest pracker is the first user in the live list.
      const newPrackerDelta = currentTimestamp - channelTracker.live[0].since
      if (newPrackerDelta < prackerDelta) {
        channelTracker.listening.forEach(listener => {
          const listenerDelta = Math.min(currentTimestamp - listener.since, prackerDelta)
          if (listenerDelta - newPrackerDelta > 0) {
            this._incrementListeningTime(listener.id, userId, listenerDelta - newPrackerDelta)
          }
        })
      }
    }
  }

  _stopListening (userId, channelId) {
    log(`- stopListening ${userId} ${channelId}`)
    const channelTracker = this._tracker[channelId]
    if (channelTracker == null) {
      logError(`stopListening failed because there is no channel tracker for channel ${channelId}.`)
      return
    }
    const currentTimestamp = this._timestampFn()
    const index = channelTracker.listening.findIndex(r => r.id === userId)
    if (index === -1) {
      logError(`stopListening failed because user ${userId} was not found in the channel ${channelId} listening list.`)
      return
    }

    const userTracker = channelTracker.listening.splice(index, 1)[0]
    if (channelTracker.live.length > 0) {
      const listenerDelta = currentTimestamp - userTracker.since
      const prackerDelta = currentTimestamp - channelTracker.live[0].since
      this._incrementListeningTime(userId, channelTracker.live[0].id, Math.min(prackerDelta, listenerDelta))
    }
  }

  async _incrementPrackingTime (userId, prackerDelta, channelId, token) {
    const userRecord = await this._userRepository.incrementSessionPlaytimes(userId, prackerDelta)
    this.emit('incrementPrackingTime', userRecord, prackerDelta, channelId, token)
  }

  async _incrementListeningTime (userId, prackerId, delta) {
    const userRecord = await this._userRepository.incrementListeningTime(userId, delta)
    this.emit('incrementListeningTime', userRecord, prackerId, delta)
  }
}

function defaultTimestampFn () {
  return Math.floor(Date.now() / 1000)
}

function makeModule (moduleManager, timestampFn = defaultTimestampFn) {
  if (!moduleManager.getConfig().get('enablePracticeManager')) return
  return new PracticeManager(moduleManager, timestampFn)
}

module.exports = { name: MODULE_NAME, makeModule: makeModule }
