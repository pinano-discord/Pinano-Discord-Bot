const cron = require('node-cron')
const resolveUntaggedMember = require('../library/util').resolveUntaggedMember

const MODULE_NAME = 'Listening Graph'

function abbreviateTime (time) {
  let seconds = time
  let minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  seconds %= 60
  minutes %= 60
  seconds = ('00' + seconds).slice(-2)
  minutes = ('00' + minutes).slice(-2)

  return `${hours}:${minutes}:${seconds}`
}

class ListeningGraph {
  constructor (moduleManager) {
    this._config = moduleManager.getConfig()
    this._moduleManager = moduleManager
  }

  resume () {
    const guild = this._moduleManager.getGuild()
    this._repository = this._moduleManager.getPersistence().getGraphRepository(guild.id)
    const pracman = this._moduleManager.getModule('Practice Manager')
    if (pracman == null) {
      throw new Error('enableTokenCollecting is true, but there is no practice manager to attach to.')
    }

    pracman.on('incrementListeningTime', (userRecord, prackerId, delta) => {
      this._repository.updateDirectListeningStat(userRecord.id, prackerId, delta)
    })

    const dispatcher = this._moduleManager.getDispatcher()
    dispatcher.command('top', guild.id, async (message, tokenized) => {
      authorMember = message.member
      let targetId = authorMember.id
      if (tokenized.length > 0) {
        const fullyQualifiedName = tokenized.join(' ').trim()
        targetId = resolveUntaggedMember(guild, fullyQualifiedName).id
      }

      const listeners = await this._repository.getTopListeners(targetId)
      const prackers = await this._repository.getTopListenedTo(targetId)
      let listenersField = '`no data`'
      let prackersField = '`no data`'
      if (listeners.length > 0) {
        listenersField = listeners
          .map(record => { return { id: record.listenerId, time: record.time } })
          .reduce((acc, rec, idx) => `${acc}\n**${idx + 1}. <@${rec.id}>**\n \`${abbreviateTime(rec.time)}\``, '')
      }

      if (prackers.length > 0) {
        prackersField = prackers
          .map(record => { return { id: record.prackerId, time: record.time } })
          .reduce((acc, rec, idx) => `${acc}\n**${idx + 1}. <@${rec.id}>**\n \`${abbreviateTime(rec.time)}\``, '')
      }

      return {
        embeds: [{
          title: MODULE_NAME,
          description: `Statistics for <@${targetId}>:`,
          color: this._config.get('embedColor') || 'DEFAULT',
          timestamp: new Date(),
          fields: [
            { name: 'Top Listeners', value: listenersField, inline: true },
            { name: 'Top Listened To', value: prackersField, inline: true }
          ]
        }]
      }
    })

    // do an initial update, then update every hour, by default.
    this.update()
    const updateCronSpec = this._config.get('listeningGraphUpdateSpec') || '0 * * * *'
    cron.schedule(updateCronSpec, this.update.bind(this))
  }

  async update () {
    this._listenerChoiceMap = await this._repository.getListenerChoiceMap()
    this._distinctListenerMap = await this._repository.getDistinctListenerMap()
    this._topListenerMap = await this._repository.getTopListenerMap()
    this._ultimateTopListener = await this._repository.getUltimateTopListener()

    this._uniqueTopListeners = []
    this._topListenerMap.forEach((v, k) => {
      if (!this._uniqueTopListeners.includes(v)) {
        this._uniqueTopListeners.push(v)
      }
    })
  }
}

function makeModule (moduleManager) {
  if (!moduleManager.getConfig().get('enableListeningGraph')) return
  return new ListeningGraph(moduleManager)
}

module.exports = { name: MODULE_NAME, makeModule: makeModule }
