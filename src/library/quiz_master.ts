/* eslint-disable sonarjs/cognitive-complexity */
import * as HTTPS from 'https';
import * as File from 'fs';

const QUIZ_QUEUE_DIR = '../quiz_queue/';

function isQuizMaster(guild, user) {
  return guild.member(user).roles.some((r) => r.name === 'Quiz Master');
}

class QuizMaster {
  activeCollectors_ = [];
  quizQueue_ = [];
  userRepository_;
  activePost;

  constructor(userRepository) {
    this.userRepository_ = userRepository;
  }

  async enqueueRiddle(message, url, author) {
    if (!this['activePost']) {
      await this.displayRiddle(message.channel, url, author);
      await message.delete();
    } else {
      if (!File.existsSync(QUIZ_QUEUE_DIR)) {
        File.mkdirSync(QUIZ_QUEUE_DIR);
      }

      const extension = url.slice(url.lastIndexOf('.'));
      const filename = `${QUIZ_QUEUE_DIR}${message.id}_${author.id}${extension}`;
      const file = File.createWriteStream(filename);
      HTTPS.get(url, (response) => {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
        });
      });

      this.quizQueue_.push({
        channel: message.channel,
        filename: filename,
        author: author,
      });

      await message.delete();
      await message.channel.send(`Added a riddle by <@${author.id}> onto the queue.`);
    }
  }

  async skipReactionCollector(reaction, channel) {
    const clientUser = channel.client.user;
    const reactor = reaction.users.find((user) => user !== clientUser);
    if (reaction.emoji.name === '⏩' && isQuizMaster(channel.guild, reactor)) {
      await this.endRiddle();
      await Promise.all(reaction.users.map((user) => reaction.remove(user)));
    } else {
      await reaction.remove(reactor);
    }
  }

  async displayRiddle(channel, filename, author) {
    const post = await channel.send(`New riddle by <@${author.id}>:`, { files: [filename] });
    await post.pin();

    if (filename.startsWith(QUIZ_QUEUE_DIR)) {
      File.unlinkSync(filename);
    }

    const reactionCollector = post.createReactionCollector((r, u) => u !== channel.client.user);
    reactionCollector.on('collect', async (reaction) => {
      return this.skipReactionCollector(reaction, channel);
    });

    this.activePost = post;
    this.activePost.quizzer = author;
    this.activePost.reactionCollector = reactionCollector;
    await post.react('⏩');
  }

  async endRiddle() {
    this.activePost.reactionCollector.stop();
    // the active post shouldn't ever be deleted, but just in case...
    if (!this.activePost.deleted) {
      await this.activePost.clearReactions();
    }
    await this.activePost.unpin();

    await Promise.all(
      this.activeCollectors_.map(async (collector) => {
        collector.stop();
        if (collector.message && !collector.message.deleted) {
          return collector.message.clearReactions();
        }
      }),
    );
    this.activeCollectors_ = [];

    if (this.quizQueue_.length !== 0) {
      const riddle = this.quizQueue_.shift();
      await this.displayRiddle(riddle.channel, riddle.filename, riddle.author);
    } else {
      await this.activePost.channel.send('There are no more riddles in the queue.');
      this.activePost = null;
    }
  }

  async resume(channel) {
    const pinnedMsgs = await channel.fetchPinnedMessages();
    const currentRiddle = pinnedMsgs.find((msg) => msg.author === channel.client.user);
    if (currentRiddle) {
      const content = currentRiddle.content;
      const userId = content.slice(content.indexOf('<@') + 2, content.indexOf('>'));
      const quizzer = channel.guild.members.get(userId).user;
      const reactionCollector = currentRiddle.createReactionCollector(
        (r, u) => u !== channel.client.user,
      );
      reactionCollector.on('collect', async (reaction) => {
        this.skipReactionCollector(reaction, channel);
      });

      currentRiddle.quizzer = quizzer;
      currentRiddle.reactionCollector = reactionCollector;
      this.activePost = currentRiddle;

      if (!File.existsSync(QUIZ_QUEUE_DIR)) {
        // nothing to do here
        return;
      }

      const files = File.readdirSync(QUIZ_QUEUE_DIR);
      files.forEach((filename) => {
        const authorId = filename.slice(filename.indexOf('_') + 1, filename.lastIndexOf('.'));
        const authorMem = channel.guild.members.get(authorId);
        if (authorMem) {
          this.quizQueue_.push({
            channel: channel,
            filename: `../quiz_queue/${filename}`,
            author: authorMem.user,
          });
        }
      });
    }
  }

  async handleIncomingMessage(message) {
    const clientUser = message.client.user;
    if (message.author === clientUser) {
      return;
    }

    if (message.attachments.size !== 0) {
      const url = message.attachments.first().url;
      await this.enqueueRiddle(message, url, message.author);
    } else if (
      this.activePost &&
      message.author !== this.activePost.quizzer &&
      message.content.startsWith('||') &&
      message.content.endsWith('||')
    ) {
      const reactionCollector = message.createReactionCollector((r, u) => u !== clientUser);
      reactionCollector.on('collect', async (reaction) => {
        const reactor = reaction.users.find((user) => user !== clientUser);
        if (isQuizMaster(message.guild, reactor) || reactor === this.activePost.quizzer) {
          if (reaction.emoji.name === '✅') {
            // stop the reaction collector just in case two reactions collide
            reactionCollector.stop();

            const guess = reaction.message.content;
            const guesserId = reaction.message.author.id;
            let userInfo = await this.userRepository_.load(guesserId);
            if (!userInfo) {
              userInfo = {
                id: guesserId,
                current_session_playtime: 0,
                overall_session_playtime: 0,
                quiz_score: 0,
              };

              await this.userRepository_.save(userInfo);
            }

            let authorInfo = await this.userRepository_.load(this.activePost.quizzer.id);
            if (!authorInfo) {
              authorInfo = {
                id: this.activePost.quizzer.id,
                current_session_playtime: 0,
                overall_session_playtime: 0,
                riddles_solved: 0,
              };

              await this.userRepository_.save(authorInfo);
            }

            const prevScore = userInfo.quiz_score || 0;
            await this.userRepository_.incrementField(guesserId, 'quiz_score');
            await this.userRepository_.incrementField(this.activePost.quizzer.id, 'riddles_solved');
            await message.channel.send(
              `The guess ${guess} was marked as correct by <@${reactor.id}>!\n\n` +
                `<@${guesserId}> now has ${prevScore + 1} point${prevScore === 0 ? '.' : 's.'}`,
            );
            await this.endRiddle();
          } else if (reaction.emoji.name === '❎') {
            reactionCollector.stop();
            await message.clearReactions();
          }
        } else {
          await reaction.remove(reactor);
        }
      });

      this.activeCollectors_.push(reactionCollector);
      await message.react('✅');
      await message.react('❎');
    }
  }
}

module.exports = QuizMaster;
