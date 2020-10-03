const cron = require('node-cron')
const log = require('../library/util').log

const MODULE_NAME = 'Pinonavirus'

async function spreadVirus (userRepository, userId, perGuildConfig) {
  const visibleIn = (perGuildConfig.get('virusIncubationTimeInDays') || 5) * 86400 +
    Math.floor(Math.random() * (perGuildConfig.get('virusIncubationTimeRangeInSeconds') || 172800))
  const visibleTime = Math.floor(Date.now() / 1000) + visibleIn
  if (await userRepository.setFieldIfNotExists(userId, 'virus_visible_at', visibleTime, false) != null) {
    return visibleTime
  }
}

class Pinonavirus {
  constructor (moduleManager) {
    this._config = moduleManager.getConfig()
    this._moduleManager = moduleManager

    if (this._config.get('virusRefreshCronSpec') == null) {
      throw new Error('enableVirus is true, but no refresh cron spec was specified.')
    }
  }

  async resume () {
    const guildId = this._moduleManager.getGuild().id
    const userRepository = this._moduleManager.getPersistence().getUserRepository(guildId)
    const pracman = this._moduleManager.getModule('Practice Manager')
    let pandemicStarted = await userRepository.pandemicStarted()
    const spreadProbability = this._config.get('virusSpreadProbability') || 5
    cron.schedule(this._config.get('virusRefreshCronSpec'), async () => {
      if (pandemicStarted) {
        Object.values(pracman._tracker)
          .filter(channelInfo => channelInfo.live.length > 0)
          .forEach(async channelInfo => {
            const prackerRecord = await userRepository.get(channelInfo.live[0].id)
            if (prackerRecord != null && prackerRecord.virus_visible_at != null) {
              channelInfo.listening.forEach(async entry => {
                if (Math.floor(Math.random() * 100) < spreadProbability) {
                  const visibleTime = await spreadVirus(userRepository, entry.id, this._config)
                  if (visibleTime != null) {
                    // if visibleTime is null, then the db update had no effect
                    // because the target user is already infected.
                    log(`User ${prackerRecord.id} spread the pinonavirus to ${entry.id}, visible at ${visibleTime}`)
                  }
                }
              })
            }
          })
      } else {
        const activePrackers = Object.values(pracman._tracker)
          .filter(channelInfo => channelInfo.live.length > 0)
          .map(channelInfo => channelInfo.live[0].id)
        if (activePrackers.length > 0 && Math.floor(Math.random() * 100) < spreadProbability) {
          const patientZero = activePrackers[Math.floor(Math.random() * activePrackers.length)]
          const visibleTime = await spreadVirus(userRepository, patientZero, this._config)
          log(`Started the pandemic with user ${patientZero}, visible at ${visibleTime}`)
          pandemicStarted = true
        }
      }
    })
  }
}

function makeModule (moduleManager) {
  if (!moduleManager.getConfig().get('enableVirus')) return
  return new Pinonavirus(moduleManager)
}

module.exports = { name: MODULE_NAME, makeModule: makeModule }
