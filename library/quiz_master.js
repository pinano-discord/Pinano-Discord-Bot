const HTTPS = require('https')
const File = require('fs')

function isQuizMaster (guild, user) {
  return guild.member(user).roles.some(r => r.name === 'Quiz Master')
}

class QuizMaster {
  constructor (userRepository) {
    this.activeCollectors_ = []
    this.quizQueue_ = []
    this.userRepository_ = userRepository
  }

  async enqueueRiddle (message, url, author) {
    if (this.activePost == null) {
      await this.displayRiddle(message.channel, url, author)
      await message.delete()
    } else {
      if (!File.existsSync('../quiz_queue/')) {
        File.mkdirSync('../quiz_queue/')
      }

      let extension = url.slice(url.lastIndexOf('.'))
      let filename = `../quiz_queue/${message.id}_${author.id}${extension}`
      let file = File.createWriteStream(filename)
      HTTPS.get(url, response => {
        response.pipe(file)
        file.on('finish', () => { file.close() })
      })

      this.quizQueue_.push({
        channel: message.channel,
        filename: filename,
        author: author
      })

      await message.delete()
      await message.channel.send(`Added a riddle by <@${author.id}> onto the queue.`)
    }
  }

  async skipReactionCollector (reaction, channel) {
    const clientUser = channel.client.user
    let reactor = reaction.users.find(user => user !== clientUser)
    if (reaction.emoji.name === '⏩' && isQuizMaster(channel.guild, reactor)) {
      await this.endRiddle()
      await Promise.all(reaction.users.map(user => reaction.remove(user)))
    } else {
      await reaction.remove(reactor)
    }
  }

  async displayRiddle (channel, filename, author) {
    let post = await channel.send(`New riddle by <@${author.id}>:`, { files: [filename] })
    await post.pin()

    if (filename.startsWith('../quiz_queue/')) {
      File.unlinkSync(filename)
    }

    let reactionCollector = post.createReactionCollector((r, u) => u !== channel.client.user)
    reactionCollector.on('collect', async reaction => {
      return this.skipReactionCollector(reaction, channel)
    })

    this.activePost = post
    this.activePost.quizzer = author
    this.activePost.reactionCollector = reactionCollector
    await post.react('⏩')
  }

  async endRiddle () {
    this.activePost.reactionCollector.stop()
    // the active post shouldn't ever be deleted, but just in case...
    if (!this.activePost.deleted) {
      await this.activePost.clearReactions()
    }
    await this.activePost.unpin()

    await Promise.all(this.activeCollectors_.map(async collector => {
      collector.stop()
      if (collector.message != null && !collector.message.deleted) {
        return collector.message.clearReactions()
      }
    }))
    this.activeCollectors_ = []

    if (this.quizQueue_.length !== 0) {
      let riddle = this.quizQueue_.shift()
      await this.displayRiddle(riddle.channel, riddle.filename, riddle.author)
    } else {
      await this.activePost.channel.send('There are no more riddles in the queue.')
      this.activePost = null
    }
  }

  async resume (channel) {
    let pinnedMsgs = await channel.fetchPinnedMessages()
    let currentRiddle = pinnedMsgs.find(msg => msg.author === channel.client.user)
    if (currentRiddle != null) {
      let content = currentRiddle.content
      let userId = content.slice(content.indexOf('<@') + 2, content.indexOf('>'))
      let quizzer = channel.guild.members.get(userId).user
      let reactionCollector =
        currentRiddle.createReactionCollector((r, u) => u !== channel.client.user)
      reactionCollector.on('collect', async reaction => {
        this.skipReactionCollector(reaction, channel)
      })

      currentRiddle.quizzer = quizzer
      currentRiddle.reactionCollector = reactionCollector
      this.activePost = currentRiddle

      if (!File.existsSync('../quiz_queue/')) {
        // nothing to do here
        return
      }

      let files = File.readdirSync('../quiz_queue/')
      files.forEach(filename => {
        let authorId = filename.slice(filename.indexOf('_') + 1, filename.lastIndexOf('.'))
        let author = channel.guild.members.get(authorId).user
        this.quizQueue_.push({
          channel: channel,
          filename: `../quiz_queue/${filename}`,
          author: author
        })
      })
    }
  }

  async handleIncomingMessage (message) {
    const clientUser = message.client.user
    if (message.author === clientUser) {
      return
    }

    if (message.attachments.size !== 0) {
      let url = message.attachments.first().url
      await this.enqueueRiddle(message, url, message.author)
    } else if (this.activePost != null && message.author !== this.activePost.quizzer &&
      message.content.startsWith('||') && message.content.endsWith('||')) {
      let reactionCollector = message.createReactionCollector((r, u) => u !== clientUser)
      reactionCollector.on('collect', async reaction => {
        let reactor = reaction.users.find(user => user !== clientUser)
        if (isQuizMaster(message.guild, reactor) || reactor === this.activePost.quizzer) {
          if (reaction.emoji.name === '✅') {
            // stop the reaction collector just in case two reactions collide
            reactionCollector.stop()

            let guess = reaction.message.content
            let guesserId = reaction.message.author.id
            let userInfo = await this.userRepository_.load(guesserId)
            if (userInfo == null) {
              userInfo = {
                'id': guesserId,
                'current_session_playtime': 0,
                'overall_session_playtime': 0,
                'quiz_score': 0
              }

              await this.userRepository_.save(userInfo)
            }

            let prevScore = userInfo.quiz_score || 0
            await this.userRepository_.incrementField(guesserId, 'quiz_score')
            await message.channel.send(
              `The guess ${guess} was marked as correct by <@${reactor.id}>!\n\n` +
              `<@${guesserId}> now has ${prevScore + 1} point${prevScore === 0 ? '.' : 's.'}`)
            await this.endRiddle()
          } else if (reaction.emoji.name === '❎') {
            reactionCollector.stop()
            await message.clearReactions()
          }
        } else {
          await reaction.remove(reactor)
        }
      })

      this.activeCollectors_.push(reactionCollector)
      await message.react('✅')
      await message.react('❎')
    }
  }
}

module.exports = QuizMaster
