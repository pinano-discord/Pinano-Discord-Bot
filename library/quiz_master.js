const HTTPS = require('https')
const File = require('fs')

function isQuizMaster (guild, user) {
  return guild.member(user).roles.some(r => r.name === 'Quiz Master')
}

// TODO: internal state won't survive a reboot.
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
      let filename = `../quiz_queue/${message.id}${extension}`
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

  async displayRiddle (channel, filename, author) {
    let post = await channel.send(`New riddle by <@${author.id}>:`, { files: [filename] })
    await post.pin()

    const clientUser = channel.client.user
    let reactionCollector = post.createReactionCollector((r, u) => u !== clientUser)
    reactionCollector.on('collect', async reaction => {
      let reactor = reaction.users.filter(user => user !== clientUser).first()
      if (reaction.emoji.name === '⏩' && isQuizMaster(channel.guild, reactor)) {
        await this.endRiddle()
        await Promise.all(reaction.users.map(user => reaction.remove(user)))
      } else {
        await Promise.all(reaction.users
          .filter(user => user !== clientUser)
          .map(user => reaction.remove(user)))
      }
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

  async handleIncomingMessage (message) {
    const clientUser = message.client.user
    if (message.author === clientUser) {
      return
    }

    if (message.attachments.size !== 0) {
      let url = message.attachments.first().url
      await this.enqueueRiddle(message, url, message.author)
    } else if (this.activePost != null && message.author !== this.activePost.quizzer) {
      let reactionCollector = message.createReactionCollector((r, u) => u !== clientUser)
      reactionCollector.on('collect', async reaction => {
        let reactor = reaction.users.filter(user => user !== clientUser).first()
        if (isQuizMaster(message.guild, reactor) || reactor === this.activePost.quizzer) {
          if (reaction.emoji.name === '✅') {
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
              `The guess \`${guess}\` was marked as correct by <@${reactor.id}>!\n\n` +
              `<@${guesserId}> now has ${prevScore + 1} point${prevScore === 0 ? '.' : 's.'}`)
            await this.endRiddle()
          } else if (reaction.emoji.name === '❎') {
            await message.clearReactions()
            reactionCollector.stop()
          }
        } else {
          await Promise.all(reaction.users
            .filter(u => u !== clientUser)
            .map(u => reaction.remove(u)))
        }
      })

      this.activeCollectors_.push(reactionCollector)
      await message.react('✅')
      await message.react('❎')
    }
  }
}

module.exports = QuizMaster
