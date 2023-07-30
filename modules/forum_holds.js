const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, InteractionCollector } = require('discord.js')

const MODULE_NAME = 'Forum Holds'

class ForumHolds {
  constructor (moduleManager) {
    this._moduleManager = moduleManager
    this._client = this._moduleManager.getClient()
    this._config = moduleManager.getConfig()
    if (this._config.get('forumHoldsChannelId') == null) {
      throw new Error('enableForumHolds is true, but no forum channel was specified.')
    }

    this._channel = moduleManager.getGuild().channels.resolve(this._config.get('forumHoldsChannelId'))
    if (this._channel == null || this._channel.type !== ChannelType.GuildForum) {
      throw new Error('forumHoldsChannelId does not refer to a valid forum channel.')
    }

    this._monitorTagId = this._config.get('forumHoldsMonitorTagId')
    if (this._monitorTagId == null) {
      throw new Error('enableForumHolds is true, but no monitoring tag was specified.')
    }

    this._reviewTagId = this._config.get('forumHoldsReviewTagId')
    if (this._reviewTagId == null) {
      throw new Error('enableForumHolds is true, but no review tag was specified.')
    }

    this._timeoutHandles = {}
  }

  async resume () {
    const threads = await this._channel.threads.fetchActive()
    for (const thread of threads.threads) {
      if (thread[1].appliedTags.includes(this._monitorTagId)) {
        // need to determine whether we already have marked this for deletion.
        // This looks at the most 100 recent messages only. We could keep looking
        // past the latest 100, but it's probably not that important - the worst
        // thing that will happen is the timer will reset.
        const messages = await thread[1].messages.fetch({ limit: 100 })
        let deadline = -1
        let messageToEdit
        for (const message of messages.filter(m => m.author === this._client.user)) {
          if (message[1].embeds.length > 0 && message[1].embeds[0].description != null) {
            const matches = message[1].embeds[0].description.match('<t:([0-9]+):R>')
            if (matches != null) {
              deadline = matches[1]
              messageToEdit = message[1]
              break
            }
          }
        }

        if (deadline === -1) {
          // no message - send one
          this._notifyAndHoldThread(thread[1])
        } else if (deadline < Date.now() / 1000) {
          // deadline already passed, lock it.
          this._lockThread(thread[1], messageToEdit)
        } else {
          // deadline is in the future. Collect interactions on this message
          // and set timer to expire when the deadline passes.
          this._collectInteractions(messageToEdit)
          this._timeoutHandles[thread[1].id] = setTimeout(() => {
            this._lockThread(thread[1], messageToEdit)
          }, deadline * 1000 - Date.now())
        }
      }
    }

    const dispatcher = this._moduleManager.getDispatcher()
    const guild = this._moduleManager.getGuild()
    dispatcher.on('threadUpdate', guild.id, async (oldThread, newThread) => {
      // not the forum we're monitoring
      if (newThread.parent.id !== this._config.get('forumHoldsChannelId')) return
      // it's already locked, don't bother processing changes.
      if (oldThread.closed || newThread.locked) return
      // if someone just unlocked/reopened the thread, don't do anything.
      if (oldThread.closed && !newThread.closed) return
      if (oldThread.locked && !newThread.locked) return
      if (!newThread.appliedTags.includes(this._monitorTagId) && oldThread.appliedTags.includes(this._monitorTagId)) {
        // someone just removed the monitor tag. Find our message and remove it,
        // then cancel the timer.
        const messages = await newThread.messages.fetch({ limit: 100 })
        let messageToDelete
        for (const message of messages.filter(m => m.author === this._client.user)) {
          if (message[1].embeds.length > 0 && message[1].embeds[0].description != null) {
            const matches = message[1].embeds[0].description.match('<t:([0-9]+):R>')
            if (matches != null) {
              messageToDelete = message[1]
              break
            }
          }
        }
        this._cancelTimer(newThread, messageToDelete)
      }
      // don't do anything if there's already a deadline on this thread.
      if (this._timeoutHandles[newThread.id] != null) return
      if (newThread.appliedTags.includes(this._monitorTagId)) {
        await this._notifyAndHoldThread(newThread)
      }
    })
  }

  async _notifyAndHoldThread (newThread) {
    const timeoutMs = (this._config.get('forumHoldTimeoutSeconds') || 60) * 1000
    const deadline = Date.now() + timeoutMs
    const message = await newThread.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('This thread has been marked for auto-closure.')
          .setDescription('Please take a moment to review [What makes a good quality post?]' +
            '(https://discord.com/channels/188345759408717825/1087148824117641226) and ' +
            'revise your post to meet these criteria. If these criteria are not met, this ' +
            `post will be deleted <t:${Math.floor(deadline / 1000)}:R>. Once you have revised ` +
            'your post, please click the button below to submit your post for review.\n\n' +
            'Please also keep in mind that Pinano is not and cannot replace a teacher.')
          .setColor(this._config.get('embedColor') || 0)
          .setTimestamp(Date.now())
      ],
      components: [
        new ActionRowBuilder()
          .addComponents(new ButtonBuilder().setLabel('Submit revisions for review').setCustomId('$REVIEW').setStyle(ButtonStyle.Primary))
      ]
    })

    this._collectInteractions(message)
    this._timeoutHandles[newThread.id] = setTimeout(() => {
      this._lockThread(newThread, message)
    }, timeoutMs)
  }

  _collectInteractions (message) {
    const collector = new InteractionCollector(this._client, { message: message })
    collector.on('collect', async (interaction) => {
      if (!interaction.isButton()) return
      if (!interaction.member.roles.cache.has(this._config.get('managementRoleId')) && interaction.member.id !== message.channel.ownerId) {
        interaction.deferUpdate()
        return
      }
      this._cancelTimer(message.channel, message, true)
    })
  }

  _cancelTimer (channel, message, addReviewTag = false) {
    if (this._timeoutHandles[channel.id] != null) {
      clearTimeout(this._timeoutHandles[channel.id])
    }
    this._timeoutHandles[channel.id] = null
    if (addReviewTag) {
      const newTags = channel.appliedTags.filter(tag => tag !== this._monitorTagId)
      if (!newTags.includes(this._reviewTagId)) newTags.push(this._reviewTagId)
      channel.setAppliedTags(newTags)
    }
    if (message != null) {
      message.delete()
    }
  }

  _lockThread (thread, notificationMessage) {
    thread.setLocked(true)
    thread.setArchived(true)
    notificationMessage.edit({ components: [] })
    thread.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('This thread is closed.')
          .setColor(this._config.get('embedColor') || 0)
          .setTimestamp(Date.now())
      ]
    })
    this._timeoutHandles[thread.id] = null
  }
}

function makeModule (moduleManager) {
  if (!moduleManager.getConfig().get('enableForumHolds')) return
  return new ForumHolds(moduleManager)
}

module.exports = { name: MODULE_NAME, makeModule }
