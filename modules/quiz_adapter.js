const HTTPS = require('https')
const log = require('../library/util').log

const MODULE_NAME = 'Quiz Adapter'

class QuizAdapter {
  constructor (moduleManager) {
    this._activeRiddles = []
    this._client = moduleManager.getClient()
    this._guild = moduleManager.getGuild()
    this._config = moduleManager.getConfig()
    this._moduleManager = moduleManager

    if (this._config.get('literatureQuizChannelId') == null) {
      throw new Error('enableLiteratureQuiz is true, but no channel ID was specified.')
    }

    this._channel = this._guild.channels.resolve(this._config.get('literatureQuizChannelId'))
    if (this._channel == null) {
      throw new Error('literatureQuizChannelId does not refer to a valid channel.')
    }

    if (this._config.get('quizMasterRoleId') == null) {
      throw new Error('enableLiteratureQuiz is true, but no Quiz Master role was specified.')
    }

    this._role = this._guild.roles.resolve(this._config.get('quizMasterRoleId'))
    if (this._role == null) {
      throw new Error('quiz_master_role_id does not refer to a valid role.')
    }
  }

  resume () {
    this._quizModule = this._moduleManager.getModule('Literature Quiz')
    const dispatcher = this._moduleManager.getDispatcher()
    dispatcher.on('message', this._guild.id, message => {
      if (message.author === this._client.user) {
        return
      }

      if (message.channel !== this._channel) {
        return
      }

      if (message.attachments.size !== 0) {
        if (message.content.toLowerCase().includes('continuation') || message.content.toLowerCase().includes('noriddle') || message.content.toLowerCase().includes('correction')) {
          return
        }
        log(`Enqueueing ${message.attachments.size} riddle(s) by ${message.author}`)
        message.attachments.forEach(attachment => {
          log(`Attachment URL: ${attachment.url}`)
        })

        this._quizModule.enqueue(message.id, message.author.id, message.attachments.first().url)
      } else {
        const guesses = message.content.match(/\|\|(.*?)\|\|/g)
        if (guesses == null) {
          return
        }

        const quizzer = message.mentions.users.first()
        this._handleGuess(message, message.author.id, guesses[0], quizzer)
      }
    })
  }

  onContentDownloaded (riddleId) {
    this._channel.messages.delete(riddleId)
  }

  async postRiddle (quizzerId, content, filename) {
    // content can be a Buffer or a Binary. In the latter case, we need to
    // extract the bytes from the encapsulating object.
    let bytes = content
    if (content._bsontype === 'Binary') {
      bytes = content.buffer
    }
    const post = await this._channel.send(`New riddle by <@${quizzerId}>:`, { files: [{ attachment: bytes, name: filename }] })
    post.pin()
    post.react('⏩')
    const collector = post.createReactionCollector((r, u) => u !== this._client.user)
    const riddle = {
      message: post,
      quizzerId: quizzerId,
      collector: collector,
      guessCollectors: []
    }

    this._activeRiddles.push(riddle)
    collector.on('collect', reaction => this._skipReaction(riddle, reaction))
  }

  async notifyRiddleQueued (authorId, riddleId) {
    const message = await this._channel.send(`Added a riddle by <@${authorId}> onto the queue.`)
    message.react('🚫')

    const deleter = message.createReactionCollector((r, u) => u !== this._client.user)
    deleter.on('collect', reaction => {
      const reactor = reaction.users.cache.find(user => user !== this._client.user)
      if (reactor == null) {
        return
      }

      if (reaction.emoji.name === '🚫' && (reactor.id === authorId || this._isQuizMaster(reactor))) {
        deleter.stop()
        this._quizModule.deleteRiddle(riddleId)
        message.delete()
      } else {
        reaction.users.remove(reactor)
      }
    })
  }

  notifyRiddleRejected () {
    this._channel.send('Submissions to the queue are currently restricted.').then(message => {
      setTimeout(() => message.delete(), (this._config.get('resultDeleteTimeInSeconds') || 30) * 1000)
    })
  }

  notifyCorrectAnswer (guesserId, guess, reactorId, newScore) {
    this._channel.send(
      `The guess ${guess} was marked as correct by <@${reactorId}>!\n\n` +
      `<@${guesserId}> now has ${newScore} point${newScore === 1 ? '.' : 's.'}`)
  }

  nagQuizzer (quizzerId) {
    this._channel.send(`<@${quizzerId}>: your riddle has been active for a while.\n\n` +
      'Please mark guesses as correct or incorrect, or consider skipping the riddle if no progress is made.')
  }

  notifySkip (quizzerId) {
    this._channel.send(`<@${quizzerId}>: the time limit for your riddle has been reached. Advancing...`)
  }

  endRiddle (quizzerId) {
    const index = this._activeRiddles.findIndex(r => r.quizzerId === quizzerId)
    const riddle = this._activeRiddles.splice(index, 1)[0]
    riddle.collector.stop()

    try {
      // the active riddle shouldn't ever be deleted, but just in case...
      if (!riddle.message.deleted) {
        riddle.message.reactions.removeAll()
        riddle.message.unpin()
      }
    } catch (error) {
      log('Failed to clear reactions from the active riddle. Did it get deleted?')
    }

    try {
      riddle.guessCollectors.forEach(collector => {
        collector.stop()
        if (collector.message != null && !collector.message.deleted) {
          log(`Clearing guess from message ${collector.message.id}`)
          collector.message.reactions.removeAll()
        }
      })
    } catch (error) {
      log('Failed to clear reactions from a guess. Did one get deleted?')
    }
  }

  notifyQueueEmpty () {
    this._channel.send('There are no more riddles in the queue.')
  }

  async continueExistingRiddles () {
    const pinned = await this._channel.messages.fetchPinned()
    const current = pinned.filter(m => m.author === this._client.user)
    const quizzers = []

    current.forEach(message => {
      message.react('⏩')
      const collector = message.createReactionCollector((r, u) => u !== this._client.user)
      const user = message.mentions.users.first()
      let quizzerId
      if (user != null) {
        quizzerId = user.id
      } else {
        // recovery mechanism if message.mentions fails
        quizzerId = message.content.slice(message.content.indexOf('<@') + 2, message.content.indexOf('>'))
      }
      quizzers.push(quizzerId)

      const riddle = {
        message: message,
        quizzerId: quizzerId,
        collector: collector,
        guessCollectors: []
      }

      this._activeRiddles.push(riddle)
      collector.on('collect', reaction => this._skipReaction(riddle, reaction))
    })

    return quizzers
  }

  getBytes (url) {
    return new Promise((resolve, reject) => {
      HTTPS.get(url, response => {
        const chunks = []
        response.on('data', chunk => {
          chunks.push(chunk)
        })

        response.on('end', () => {
          if (response.statusCode !== 200) {
            reject(Buffer.concat(chunks).toString())
          } else {
            resolve(Buffer.concat(chunks))
          }
        })

        response.on('error', (error) => {
          reject(error)
        })
      })
    })
  }

  _handleGuess (message, guesserId, guess, quizzer) {
    if (this._activeRiddles.length === 0) {
      // don't handle guesses when there are no riddles
      return
    }

    let riddle
    if (quizzer == null) {
      if (this._activeRiddles.length > 1) {
        this._channel.send('There are multiple riddles active. Please tag the user whose riddle you are guessing.').then(m => {
          setTimeout(() => m.delete(), 5000)
        })
        return
      }
      riddle = this._activeRiddles[0]
    } else {
      riddle = this._activeRiddles.find(r => r.quizzerId === quizzer.id)
      if (riddle == null) {
        this._channel.send('There is no riddle by that user currently active.')
        return
      }
    }

    if (guesserId === riddle.quizzerId) {
      // short-circuit in the case where someone guesses their own riddle. We
      // want this to happen before we potentially warn the user to tag the
      // quizzer after a tagless guess, which is pointless.
      return
    }

    if (quizzer == null) {
      if (this._config.get('warnOnTaglessGuess')) {
        this._channel.send('Please tag the user whose riddle you are guessing.').then(m => {
          setTimeout(() => m.delete(), 5000)
        })
      }

      if (this._config.get('actionOnTaglessGuess') === 'ignore') {
        return
      }
    }

    const collector = message.createReactionCollector((r, u) => u !== this._client.user)
    collector.on('collect', reaction => {
      const reactor = reaction.users.cache.find(user => user !== this._client.user)
      if (this._controlsQuestion(riddle, reactor)) {
        if (reaction.emoji.name === '✅') {
          collector.stop()
          this._quizModule.onCorrectAnswer(guesserId, guess, reactor.id, riddle.quizzerId)
        } else if (reaction.emoji.name === '❎') {
          collector.stop()
          message.reactions.removeAll()
          riddle.guessCollectors.splice(riddle.guessCollectors.indexOf(collector), 1)
        }
      } else {
        reaction.users.remove(reactor)
      }
    })

    riddle.guessCollectors.push(collector)
    message.react('✅')
    message.react('❎')
  }

  _skipReaction (riddle, reaction) {
    const reactor = reaction.users.cache.find(user => user !== this._client.user)
    if (reactor == null) {
      return
    }

    if (reaction.emoji.name === '⏩' && this._controlsQuestion(riddle, reactor)) {
      this._quizModule.endRiddle(riddle.quizzerId)
    } else {
      reaction.users.remove(reactor)
    }
  }

  _controlsQuestion (riddle, user) {
    return user.id === riddle.quizzerId || this._isQuizMaster(user)
  }

  _isQuizMaster (user) {
    return this._guild.member(user).roles.cache.has(this._role.id)
  }
}

function makeModule (moduleManager) {
  if (!moduleManager.getConfig().get('enableLiteratureQuiz')) return
  return new QuizAdapter(moduleManager)
}

module.exports = { name: MODULE_NAME, makeModule: makeModule }
