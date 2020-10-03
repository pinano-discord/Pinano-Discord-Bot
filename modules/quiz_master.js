const logError = require('../library/util').logError

const MODULE_NAME = 'Literature Quiz'

class QuizMaster {
  constructor (moduleManager) {
    const guildId = moduleManager.getGuild().id
    this._activeQueue = []
    this._userRepository = moduleManager.getPersistence().getUserRepository(guildId)
    this._quizRepository = moduleManager.getPersistence().getQuizRepository(guildId)
    this._config = moduleManager.getConfig()
    this._moduleManager = moduleManager
    this._priority = 0
  }

  async resume () {
    this._adapter = this._moduleManager.getModule('Quiz Adapter')

    this._activeQueue = await this._quizRepository.getActiveQueue()
    if (this._activeQueue.length > 0) {
      this._priority = this._activeQueue.map(r => r.priority).reduce((a, b) => Math.max(a, b))
    }
    const quizzers = await this._adapter.continueExistingRiddles()
    quizzers.forEach(quizzerId => {
      const { nagTimeoutHandle, skipTimeoutHandle } = this._setTimeoutHandles(quizzerId)
      const riddle = this._activeQueue.find(r => r.quizzerId === quizzerId)
      if (riddle == null) {
        // this should never happen, but if it does, insert a barebones entry
        // into the queue and try to continue.
        logError(`Adapter returned an existing riddle that did not match any quizzer in the active queue. Quizzer ID: ${quizzerId}`)
        this._activeQueue.push({
          quizzerId: quizzerId,
          nagTimeoutHandle: nagTimeoutHandle,
          skipTimeoutHandle: skipTimeoutHandle,
          active: true
        })
        return
      }
      riddle.nagTimeoutHandle = nagTimeoutHandle
      riddle.skipTimeoutHandle = skipTimeoutHandle
      riddle.active = true
    })

    if (this._config.get('automaticallyStartQueue')) {
      while (this._activeQueue.filter(r => r.active).length < (this._config.get('maxConcurrentRiddles') || 1)) {
        // send more riddles while we have room
        const newRiddle = this._activeQueue.filter(r => !r.active).sort((a, b) => a.priority - b.priority)[0]
        if (newRiddle == null) {
          return
        }

        this._adapter.postRiddle(newRiddle.quizzerId, newRiddle.content, `riddle${newRiddle.extension || '.png'}`)

        const { nagTimeoutHandle, skipTimeoutHandle } = this._setTimeoutHandles(newRiddle.quizzerId)
        newRiddle.nagTimeoutHandle = nagTimeoutHandle
        newRiddle.skipTimeoutHandle = skipTimeoutHandle
        newRiddle.active = true
      }
    }
  }

  async enqueue (riddleId, quizzerId, url) {
    // true if the riddle will be posted immediately as soon as it is queued.
    // We calculate this first because if the riddle rejection policy is to
    // ignore (i.e. silently drop) the riddle, then we continue processing
    // the riddle if there were no rejection policy.
    const willBeActive = this._activeQueue.filter(r => r.active).length < (this._config.get('maxConcurrentRiddles') || 1) &&
      !this._activeQueue.some(r => r.active && r.quizzerId === quizzerId)
    const preventedByPolicy =
      (this._config.get('riddleAcceptancePolicy') === 'blacklist' && (this._config.get('blacklist') || []).includes(quizzerId)) ||
      (this._config.get('riddleAcceptancePolicy') === 'whitelist' && !(this._config.get('whitelist') || []).includes(quizzerId))
    if (preventedByPolicy && this._config.get('rejectedRiddleAction') === 'reject') {
      this._adapter.notifyRiddleRejected()
      this._adapter.onContentDownloaded(riddleId)
      return
    }

    const overflow = this._activeQueue.some(r => r.quizzerId === quizzerId)
    const riddle = {
      id: riddleId,
      quizzerId: quizzerId,
      timeAdded: Date.now(),
      priority: overflow ? 0 : ++this._priority,
      ignore: preventedByPolicy,
      overflow: overflow,
      content: await this._adapter.getBytes(url),
      extension: url.substring(url.lastIndexOf('.'))
    }

    // this must happen after we're finished downloading the message.
    // Otherwise we might delete the message and get a 403 on download.
    this._adapter.onContentDownloaded(riddleId)

    // note: if the riddle would be active right away, then dropping the
    // riddle would not be so silent, so ignore any policies.
    if (willBeActive) {
      this._adapter.postRiddle(quizzerId, riddle.content, `riddle${riddle.extension}`)
      await this._quizRepository.addRiddle(riddle)

      // do this after pushing the riddle to the repository because timeout
      // handles don't make sense to put into the repository.
      const { nagTimeoutHandle, skipTimeoutHandle } = this._setTimeoutHandles(quizzerId)
      riddle.nagTimeoutHandle = nagTimeoutHandle
      riddle.skipTimeoutHandle = skipTimeoutHandle
      riddle.active = true
      this._activeQueue.push(riddle)
      return
    }

    // assuming we aren't silently dropping the riddle due to policy, then
    // put the riddle onto the queue, and onto the active queue if there
    // isn't already a riddle by this author on the active queue.
    await this._quizRepository.addRiddle(riddle)
    if (!preventedByPolicy && !riddle.overflow) {
      riddle.active = false
      this._activeQueue.push(riddle)
    }
    this._adapter.notifyRiddleQueued(quizzerId, riddleId)
  }

  async onCorrectAnswer (guesserId, guess, reactorId, quizzerId) {
    const newRecord = await this._userRepository.incrementField(guesserId, 'quiz_score')
    this._userRepository.incrementField(quizzerId, 'riddles_solved')
    this._adapter.notifyCorrectAnswer(guesserId, guess, reactorId, newRecord.quiz_score)
    await this.endRiddle(quizzerId)
  }

  async endRiddle (quizzerId) {
    const index = this._activeQueue.findIndex(r => r.quizzerId === quizzerId)
    const riddle = this._activeQueue.splice(index, 1)[0]
    if (riddle.nagTimeoutHandle != null) {
      clearTimeout(riddle.nagTimeoutHandle)
    }

    if (riddle.skipTimeoutHandle != null) {
      clearTimeout(riddle.skipTimeoutHandle)
    }

    await this._quizRepository.removeRiddle(riddle.id)
    this._adapter.endRiddle(quizzerId)

    const promotedRiddle = await this._quizRepository.promoteRiddle(quizzerId, ++this._priority)
    if (promotedRiddle != null) {
      promotedRiddle.active = false
      this._activeQueue.push(promotedRiddle)
    }

    const newRiddle = this._activeQueue.filter(r => !r.active).sort((a, b) => a.priority - b.priority)[0]
    if (newRiddle != null && this._activeQueue.filter(r => r.active).length < (this._config.get('maxConcurrentRiddles') || 1)) {
      this._adapter.postRiddle(newRiddle.quizzerId, newRiddle.content, `riddle${newRiddle.extension || '.png'}`)

      const { nagTimeoutHandle, skipTimeoutHandle } = this._setTimeoutHandles(newRiddle.quizzerId)
      newRiddle.nagTimeoutHandle = nagTimeoutHandle
      newRiddle.skipTimeoutHandle = skipTimeoutHandle
      newRiddle.active = true
    } else if (this._activeQueue.length === 0) {
      this._adapter.notifyQueueEmpty()
    }
  }

  async deleteRiddle (id) {
    const index = this._activeQueue.findIndex(r => r.id === id)
    if (index !== -1 && this._activeQueue[index].active) {
      // too late to delete this riddle
      return
    }

    // this all does nothing if the riddle has already passed.
    await this._quizRepository.removeRiddle(id)
    if (index !== -1) {
      const riddle = this._activeQueue.splice(index, 1)
      const promotedRiddle = await this._quizRepository.promoteRiddle(riddle.quizzerId, ++this._priority)
      if (promotedRiddle != null) {
        this._activeQueue.push(promotedRiddle)
      }
    }
  }

  _setTimeoutHandles (quizzerId) {
    let nagTimeoutHandle, skipTimeoutHandle

    const nagTimeout = this._config.get('nagTimeoutInSeconds') || 0
    if (nagTimeout > 0) {
      nagTimeoutHandle = setTimeout(() => {
        this._adapter.nagQuizzer(quizzerId)
      }, nagTimeout * 1000)
    }

    const skipTimeout = this._config.get('skipTimeoutInSeconds') || 0
    if (skipTimeout > 0) {
      skipTimeoutHandle = setTimeout(() => {
        this._adapter.notifySkip(quizzerId)
        this.endRiddle(quizzerId)
      }, skipTimeout * 1000)
    }

    return { nagTimeoutHandle, skipTimeoutHandle }
  }
}

function makeModule (moduleManager) {
  if (!moduleManager.getConfig().get('enableLiteratureQuiz')) return
  return new QuizMaster(moduleManager)
}

module.exports = { name: MODULE_NAME, makeModule: makeModule }
