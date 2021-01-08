const RoomIdentifiers = require('../library/room_identifiers')

const MODULE_NAME = 'Badges'

function includesAll (list, members) {
  return members.every(m => list.includes(m))
}

class Badges {
  constructor (moduleManager) {
    this._guild = moduleManager.getGuild()
    this._config = moduleManager.getConfig()
    this._moduleManager = moduleManager

    if (this._config.get('enableLiteratureQuiz')) {
      this._litQuizString = `[Literature Quiz](https://discordapp.com/channels/${this._guild.id}/${this._config.get('literatureQuizChannelId')})`
    } else {
      this._litQuizString = 'Literature Quiz'
    }
  }

  resume () {
    const userRepository = this._moduleManager.getPersistence().getUserRepository(this._guild.id)
    const pracman = this._moduleManager.getModule('Practice Manager')
    if (pracman != null) {
      pracman.on('incrementPrackingTime', (userRecord, delta) => {
        if (delta >= this._config.get('minimumSessionTimeToEarnToken')) {
          userRepository.setField(userRecord.id, 'last_practiced_time', Math.floor(Date.now() / 1000))
        }
        if (delta > 0 && delta % 3600 === 0) {
          userRepository.addToSet(userRecord.id, 'badges', 'punctual')
        }
      })
    }

    this._listeningGraph = this._moduleManager.getModule('Listening Graph')
  }

  badgesForUser (userRecord, member, liveDelta) {
    const badges = []
    if (userRecord.rooms_practiced != null) {
      if (includesAll(userRecord.rooms_practiced, RoomIdentifiers.original)) {
        if (this._config.get('collectionBadgeAll') != null && includesAll(userRecord.rooms_practiced, RoomIdentifiers.firstGen)) {
          badges.push(this._config.get('collectionBadgeAll'))
        } else if (this._config.get('collectionBadgeOriginal') != null) {
          badges.push(this._config.get('collectionBadgeOriginal'))
        }
      }

      if (this._config.get('collectionBadgeAnimals') != null && includesAll(userRecord.rooms_practiced, RoomIdentifiers.animals)) {
        badges.push(this._config.get('collectionBadgeAnimals'))
      }

      if (this._config.get('collectionBadgeRare') != null && includesAll(userRecord.rooms_practiced, RoomIdentifiers.rare)) {
        badges.push(this._config.get('collectionBadgeRare'))
      }

      if (this._config.get('collectionBadgeChristmas') != null && includesAll(userRecord.rooms_practiced, RoomIdentifiers.christmas)) {
        badges.push(this._config.get('collectionBadgeChristmas'))
      }

      if (this._config.get('collectionBadgeValentines') != null && includesAll(userRecord.rooms_practiced, RoomIdentifiers.valentines)) {
        badges.push(this._config.get('collectionBadgeValentines'))
      }

      if (this._config.get('collectionBadgeHalloween') != null && includesAll(userRecord.rooms_practiced, RoomIdentifiers.halloween)) {
        badges.push(this._config.get('collectionBadgeHalloween'))
      }

      if (this._config.get('collectionBadgeRickroll') != null && includesAll(userRecord.rooms_practiced, RoomIdentifiers.rickroll)) {
        badges.push(this._config.get('collectionBadgeRickroll'))
      }

      if (this._config.get('collectionBadgeTimeBased') != null && includesAll(userRecord.rooms_practiced, RoomIdentifiers.timeBased)) {
        badges.push(this._config.get('collectionBadgeTimeBased'))
      }

      if (this._config.get('enableCustomTokens')) {
        if (this._config.get('collectionBadgeEggs') != null && includesAll(userRecord.rooms_practiced, this._config.get('customTokens')) && includesAll(userRecord.rooms_practiced, this._config.get('rareCustomTokens'))) {
          badges.push(this._config.get('collectionBadgeEggs'))
        }
      }
    }

    if (this._config.get('litQuizSolvedBadgeIcon') != null && userRecord.quiz_score >= 10) {
      badges.push(`${this._config.get('litQuizSolvedBadgeIcon')} I've correctly answered ${userRecord.quiz_score} riddles on ${this._litQuizString}`)
    }

    if (this._config.get('litQuizGivenBadgeIcon') != null && userRecord.riddles_solved >= 10) {
      badges.push(`${this._config.get('litQuizGivenBadgeIcon')} My riddles have been solved ${userRecord.riddles_solved} times on ${this._litQuizString}`)
    }

    if (this._config.get('nitroBadge') != null && member.roles.cache.has(this._config.get('nitroRoleId'))) {
      badges.push(this._config.get('nitroBadge'))
    }

    const nowMs = Date.now()
    const now = Math.floor(nowMs / 1000)
    if (this._config.get('recencyWeekBadge') != null) {
      if (liveDelta >= this._config.get('minimumSessionTimeToEarnToken') || now - userRecord.last_practiced_time < 7 * 86400) {
        badges.push(this._config.get('recencyWeekBadge'))
      } else if (now - userRecord.last_practiced_time < 30 * 86400) {
        badges.push(this._config.get('recencyMonthBadge'))
      }
    }

    const currentStreak = (userRecord.daily_streak || 0) + ((liveDelta >= this._config.get('minimumSessionTimeToEarnToken') || userRecord.practiced_today) ? 1 : 0)
    if (this._config.get('streakBadgeIcon') != null && (currentStreak >= 5 || userRecord.max_daily_streak >= 5)) {
      badges.push(`${this._config.get('streakBadgeIcon')} I practiced for ${Math.max(currentStreak, userRecord.max_daily_streak)} days in a row`)
    }

    if (this._config.get('virusBadge') != null && now >= userRecord.virus_visible_at && !userRecord.rooms_practiced.includes('💉')) {
      badges.push(this._config.get('virusBadge'))
    }

    if (userRecord.badges != null) {
      if (this._config.get('monkeyBadge') != null && userRecord.badges.includes('monkey')) {
        badges.push(this._config.get('monkeyBadge'))
      }

      if (this._config.get('developerBadge') != null && userRecord.badges.includes('developer')) {
        badges.push(this._config.get('developerBadge'))
      }

      if (this._config.get('punctualBadge') != null && userRecord.badges.includes('punctual')) {
        badges.push(this._config.get('punctualBadge'))
      }

      if (this._config.get('linglingBadge') != null && userRecord.badges.includes('lingling')) {
        badges.push(this._config.get('linglingBadge'))
      }
    }

    if (this._listeningGraph != null) {
      const possibleTwin = this._listeningGraph._listenerChoiceMap.get(userRecord.id)
      if (possibleTwin != null) {
        // coming up with names is hard.
        const possibleTwinTwin = this._listeningGraph._listenerChoiceMap.get(possibleTwin)
        if (possibleTwinTwin != null && possibleTwinTwin === userRecord.id && this._config.get('listeningTwinBadge') != null) {
          badges.push(`${this._config.get('listeningTwinBadge')} <@${possibleTwin}>, I choose you!`)
        }
      }

      const listenedToCount = this._listeningGraph._distinctListenerMap.get(userRecord.id)
      if (listenedToCount >= 10 && this._config.get('listenedToBadgeIcon') != null) {
        badges.push(`${this._config.get('listenedToBadgeIcon')} I've listened to ${listenedToCount} different users practice`)
      }

      const topListener = this._listeningGraph._topListenerMap.get(userRecord.id)
      let topListenerExchange = false
      if (topListener != null) {
        const topListenerOfTopListener = this._listeningGraph._topListenerMap.get(topListener)
        if (topListenerOfTopListener != null && topListenerOfTopListener === userRecord.id && this._config.get('topListenerExchangeBadge') != null) {
          badges.push(this._config.get('topListenerExchangeBadge'))
          topListenerExchange = true
        }
      }

      if (!topListenerExchange && this._listeningGraph._uniqueTopListeners.includes(userRecord.id) && this._config.get('topListenerBadge') != null) {
        badges.push(this._config.get('topListenerBadge'))
      }

      if (this._config.get('ultimateTopListenerBadge') && userRecord.id === this._listeningGraph._ultimateTopListener) {
        badges.push(this._config.get('ultimateTopListenerBadge'))
      }
    }

    if (this._config.get('cumulative500Badge') != null && userRecord.overall_session_playtime + liveDelta >= 500 * 60 * 60) {
      badges.push(this._config.get('cumulative500Badge'))
    } else if (this._config.get('cumulative250Badge') != null && userRecord.overall_session_playtime + liveDelta >= 250 * 60 * 60) {
      badges.push(this._config.get('cumulative250Badge'))
    } else if (this._config.get('cumulative100Badge') != null && userRecord.overall_session_playtime + liveDelta >= 100 * 60 * 60) {
      badges.push(this._config.get('cumulative100Badge'))
    } else if (this._config.get('cumulative40Badge') != null && userRecord.overall_session_playtime + liveDelta >= 40 * 60 * 60) {
      badges.push(this._config.get('cumulative40Badge'))
    }

    if (badges.length === 0) {
      badges.push(this._config.get('noBadgesBadge') || 'no badges yet!')
    }

    return badges
  }
}

function makeModule (moduleManager) {
  if (!moduleManager.getConfig().get('enableBadges')) return
  return new Badges(moduleManager)
}

module.exports = { name: MODULE_NAME, makeModule: makeModule }
