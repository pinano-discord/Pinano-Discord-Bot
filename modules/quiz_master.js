const fs = require('fs')
const Leaderboard = require('../library/leaderboard')
const util = require('../library/util')

const MODULE_NAME = 'Literature Quiz'

class QuizMaster {
  constructor (moduleManager) {
    this._guildId = moduleManager.getGuild().id
    this._activeQueue = []
    this._userRepository = moduleManager.getPersistence().getUserRepository(this._guildId)
    this._quizRepository = moduleManager.getPersistence().getQuizRepository(this._guildId)
    this._config = moduleManager.getConfig()
    this._moduleManager = moduleManager
    this._priority = 0

    if (this._config.get('enableAutoquiz')) {
      const hintKeyFile = this._config.get('hintKeyFile')
      if (hintKeyFile != null) {
        try {
          this._hintKey = require(`../data/${hintKeyFile}`)
        } catch (ex) {
          util.logError(`Could not open hint key file ${hintKeyFile}: ${ex}`)
        }
      }
    }
  }

  async resume () {
    this._adapter = this._moduleManager.getModule('Quiz Adapter')
    this._clientId = this._moduleManager.getClient().user.id

    this._leaderboard = new Leaderboard(this._userRepository, 'quiz_score', this._config.get('leaderboardSize') || 10, 'Literature Quiz', false)
    this._activeQueue = await this._quizRepository.getActiveQueue()
    if (this._activeQueue.length > 0) {
      this._priority = this._activeQueue.map(r => r.priority).reduce((a, b) => Math.max(a, b))
    }
    const quizzers = await this._adapter.continueExistingRiddles()
    quizzers.forEach(quizzerId => {
      const { nagTimeoutHandle, skipTimeoutHandle } = this._setTimeoutHandles(quizzerId)
      const riddle = this._activeQueue.find(r => r.quizzerId === quizzerId)
      if (riddle == null) {
        // this should only ever happen when continuing house riddles, which
        // aren't stored in the db. Insert a barebones entry into the queue and
        // try to continue.
        if (quizzerId !== this._clientId) {
          util.logError(`Adapter returned an existing riddle that did not match any quizzer in the active queue. Quizzer ID: ${quizzerId}`)
        }
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
      while (this._activeRiddleCount() < (this._config.get('maxConcurrentRiddles') || 1)) {
        // send more riddles while we have room. Exclude house riddles from the
        // count if alwaysAutoquiz is enabled - the house has its own slot.
        const newRiddle = this._activeQueue.filter(r => !r.active).sort((a, b) => a.priority - b.priority)[0]
        if (newRiddle == null) {
          break
        }

        this._adapter.postRiddle(newRiddle.quizzerId, newRiddle.content, `riddle${newRiddle.extension || '.png'}`)

        const { nagTimeoutHandle, skipTimeoutHandle } = this._setTimeoutHandles(newRiddle.quizzerId)
        newRiddle.nagTimeoutHandle = nagTimeoutHandle
        newRiddle.skipTimeoutHandle = skipTimeoutHandle
        newRiddle.active = true
      }

      this._postAutoquizIfConfigured()
    }
  }

  async enqueue (riddleId, quizzerId, url) {
    // true if the riddle will be posted immediately as soon as it is queued.
    // We calculate this first because if the riddle rejection policy is to
    // ignore (i.e. silently drop) the riddle, then we continue processing
    // the riddle if there were no rejection policy.
    const willBeActive = this._activeRiddleCount() < (this._config.get('maxConcurrentRiddles') || 1) &&
      !this._activeQueue.some(r => r.active && r.quizzerId === quizzerId)
    const preventedByPolicy =
      (this._config.get('riddleAcceptancePolicy') === 'blocklist' && (this._config.get('blocklist') || []).includes(quizzerId)) ||
      (this._config.get('riddleAcceptancePolicy') === 'allowlist' && !(this._config.get('allowlist') || []).includes(quizzerId))
    if (preventedByPolicy && this._config.get('rejectedRiddleAction') === 'reject') {
      this._adapter.notifyRiddleRejected()
      this._adapter.onContentDownloaded(riddleId)
      return
    }

    const overflow = this._activeQueue.some(r => r.quizzerId === quizzerId)
    const extension = url.substring(url.lastIndexOf('.'))
    if (!fs.existsSync('./quiz_queue/')) {
      fs.mkdirSync('./quiz_queue')
    }
    const filename = `./quiz_queue/${this._guildId}_${riddleId}${extension}`
    await this._adapter.getBytes(url, filename)
    const riddle = {
      id: riddleId,
      quizzerId: quizzerId,
      timeAdded: Date.now(),
      priority: overflow ? 0 : ++this._priority,
      ignore: preventedByPolicy,
      overflow: overflow,
      content: filename,
      extension: extension
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
    this._leaderboard.refresh(new Map(), this._adapter.memberExists.bind(this._adapter))
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

    if (riddle.quizzerId !== this._clientId) {
      // house riddles aren't stored in the db.
      await this._quizRepository.removeRiddle(riddle.id)
      try {
        fs.unlinkSync(riddle.content)
      } catch (e) {
        util.log(`Failed to delete file ${riddle.content}`)
      }
    }
    this._adapter.endRiddle(quizzerId)

    const promotedRiddle = await this._quizRepository.promoteRiddle(quizzerId, ++this._priority)
    if (promotedRiddle != null) {
      promotedRiddle.active = false
      this._activeQueue.push(promotedRiddle)
    }

    const newRiddle = this._activeQueue.filter(r => !r.active).sort((a, b) => a.priority - b.priority)[0]
    if (newRiddle != null && this._activeRiddleCount() < (this._config.get('maxConcurrentRiddles') || 1)) {
      this._adapter.postRiddle(newRiddle.quizzerId, newRiddle.content, `riddle${newRiddle.extension || '.png'}`)

      const { nagTimeoutHandle, skipTimeoutHandle } = this._setTimeoutHandles(newRiddle.quizzerId)
      newRiddle.nagTimeoutHandle = nagTimeoutHandle
      newRiddle.skipTimeoutHandle = skipTimeoutHandle
      newRiddle.active = true
    }

    this._postAutoquizIfConfigured()

    if (this._activeQueue.length === 0) {
      this._adapter.notifyQueueEmpty()
    }
  }

  // returns the effective number of active riddles, accounting for the state
  // of the alwaysAutoquiz flag (if enabled, then the house always has its own
  // slot for riddles, so we don't count it as part of the limit).
  _activeRiddleCount () {
    return this._activeQueue.filter(r => r.active && !(this._config.get('alwaysAutoquiz') && r.quizzerId === this._clientId)).length
  }

  // if autoquiz is turned on and the house doesn't have a riddle posted, and
  // there are at most two fewer than maximum riddles posted, have the house
  // post a riddle. Two fewer than maximum ensures that the first user who
  // subsequently uploads a riddle will have it immediately appear. If
  // alwaysAutoquiz is enabled, the house will post a riddle if it doesn't have
  // one posted, regardless of how many riddles are active.
  _shouldPostAutoquiz () {
    return this._config.get('enableAutoquiz') &&
      this._activeQueue.find(r => r.quizzerId === this._clientId) == null &&
      (this._config.get('alwaysAutoquiz') || this._activeQueue.filter(r => r.active).length <= ((this._config.get('maxConcurrentRiddles') || 1) - 2))
  }

  _postAutoquizIfConfigured () {
    if (this._shouldPostAutoquiz()) {
      try {
        const filename = util.pickRandomFromList(fs.readdirSync('../autoquiz/'))
        if (filename != null) {
          const { nagTimeoutHandle, skipTimeoutHandle } = this._setTimeoutHandles(this._clientId, filename)
          const houseRiddle = {
            id: 'HOUSE_RIDDLE',
            quizzerId: this._clientId,
            timeAdded: Date.now(),
            content: `../autoquiz/${filename}`,
            extension: filename.substring(filename.lastIndexOf('.')),
            nagTimeoutHandle: nagTimeoutHandle,
            skipTimeoutHandle: skipTimeoutHandle,
            active: true
          }
          this._activeQueue.push(houseRiddle)
          this._adapter.postRiddle(this._clientId, houseRiddle.content, `riddle${houseRiddle.extension}`)
          util.log(`Posted ${filename} as a house riddle`)
        }
      } catch (ex) {
        util.logError('Failed to post a house riddle.')
      }
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
      try {
        fs.unlinkSync(riddle.content)
      } catch (e) {
        util.log(`Failed to delete file ${riddle.content}`)
      }
      const promotedRiddle = await this._quizRepository.promoteRiddle(riddle.quizzerId, ++this._priority)
      if (promotedRiddle != null) {
        this._activeQueue.push(promotedRiddle)
      }
    }
  }

  getActiveQueue () {
    return this._activeQueue
  }

  _setTimeoutHandles (quizzerId, filename) {
    let nagTimeoutHandle, skipTimeoutHandle

    if (quizzerId === this._clientId) {
      const autoquizHintTimeout = this._config.get('autoquizHintTimeout') || 0
      // we won't be able to give hints for resumed house riddles because we don't have a filename.
      if (autoquizHintTimeout > 0 && this._hintKey != null && filename != null) {
        const hint = this._hintKey.getHintForFilename(filename)
        nagTimeoutHandle = setTimeout(() => {
          this._adapter.giveHint(hint)
        }, autoquizHintTimeout * 1000)
      }
    } else {
      const nagTimeout = this._config.get('nagTimeoutInSeconds') || 0
      if (nagTimeout > 0) {
        nagTimeoutHandle = setTimeout(() => {
          // don't notify the house about timeout
          this._adapter.nagQuizzer(quizzerId)
        }, nagTimeout * 1000)
      }
    }

    const skipTimeoutForHouseRiddles = this._config.get('autoquizSkipTimeout') || 0
    const skipTimeout = (quizzerId === this._clientId && skipTimeoutForHouseRiddles > 0) ? skipTimeoutForHouseRiddles : (this._config.get('skipTimeoutInSeconds') || 0)

    if (skipTimeout > 0) {
      skipTimeoutHandle = setTimeout(() => {
        if (quizzerId !== this._clientId) {
          // don't notify the house about timeout
          this._adapter.notifySkip(quizzerId)
        }
        this.endRiddle(quizzerId)
      }, skipTimeout * 1000)
    }

    return { nagTimeoutHandle, skipTimeoutHandle }
  }

  async addpoint (id, callback) {
    const newRecord = await this._userRepository.incrementField(id, 'quiz_score')
    this._leaderboard.refresh(new Map(), this._adapter.memberExists.bind(this._adapter))
    callback(newRecord.quiz_score)
  }
}

function makeModule (moduleManager) {
  if (!moduleManager.getConfig().get('enableLiteratureQuiz')) return
  return new QuizMaster(moduleManager)
}

module.exports = { name: MODULE_NAME, makeModule: makeModule }
