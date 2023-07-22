const cron = require('node-cron')
const util = require('../library/util')

const MODULE_NAME = 'Daily Times'

class DailyTime {
  constructor (moduleManager) {
    this._config = moduleManager.getConfig()
    this._moduleManager = moduleManager
  }

  resume () {
    const guild = this._moduleManager.getGuild()
    const userRepository = this._moduleManager.getPersistence().getUserRepository(guild.id)
    const pracman = this._moduleManager.getModule('Practice Manager')
    const dispatcher = this._moduleManager.getDispatcher()

    if (pracman == null) {
      util.logError(`WARNING: ${MODULE_NAME} module is enabled for guild ${guild.id}, but there is no practice manager.`)
    } else {
      pracman.on('incrementPrackingTime', (userRecord, delta) => {
        if (delta >= this._config.get('minimumSessionTimeToEarnToken')) {
          userRepository.setField(userRecord.id, 'practiced_today', true)
        }
        if (userRecord.daily_session_playtime >= 40 * 60 * 60) {
          userRepository.addToSet(userRecord.id, 'badges', 'lingling')
        }
      })
    }

    cron.schedule('0 * * * *', () => {
      userRepository.resetDailyTimes(new Date().getUTCHours())
    })

    dispatcher.command('setdailyreset', guild.id, (message, tokenized) => {
      const authorMember = message.member
      const USAGE = `${this._config.get('commandPrefix') || 'p!'}setdailyreset [ HOUR ]`
      util.requireParameterCount(tokenized, 1, USAGE)

      if (tokenized[0] === 'off') {
        // it'd be nice to group these together. It's also not a big deal.
        userRepository.setField(authorMember.id, 'daily_streak', 0)
        userRepository.setField(authorMember.id, 'daily_reset_hour', null)
        util.log(`Turned off <@${authorMember.id}>'s daily reset hour`)
        return {
          embeds: [{
            title: MODULE_NAME,
            description: `Turned off daily time tracking for <@${authorMember.id}>`,
            color: this._config.get('embedColor') || 0,
            timestamp: new Date()
          }]
        }
      } else {
        const hour = parseInt(tokenized[0])
        if (!Number.isInteger(hour) || hour < 0 || hour >= 24) {
          throw new Error('Hour must be between 0 and 23 (or `off`)')
        }
        userRepository.setField(authorMember.id, 'daily_reset_hour', hour)
        util.log(`Set <@${authorMember.id}>'s daily reset hour to ${hour}`)
        return {
          embeds: [{
            title: MODULE_NAME,
            description: `<@${authorMember.id}>'s daily time will reset at 00:00 UTC${(hour >= 12) ? `+${24 - hour}` : ((0 - hour) || '')}`,
            color: this._config.get('embedColor') || 0,
            timestamp: new Date()
          }]
        }
      }
    })
  }
}

function makeModule (moduleManager) {
  if (!moduleManager.getConfig().get('enableDailyTime')) return
  return new DailyTime(moduleManager)
}

module.exports = { name: MODULE_NAME, makeModule: makeModule }
