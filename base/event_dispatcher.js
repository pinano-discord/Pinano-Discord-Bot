const { log } = require('../library/util')

class EventDispatcher {
  constructor (client, moduleManagers) {
    this._commandHandlers = {}
    this._eventHandlers = {}
    this._client = client

    client.on('messageCreate', async (message) => {
      if (message.guild == null) {
        // TODO: handle DMs
        return
      }

      const guildId = message.guild.id
      if (moduleManagers.get(guildId) == null || moduleManagers.get(guildId).getConfig() == null) {
        // we don't know about this guild. Don't process anything.
        return
      }

      const config = moduleManagers.get(guildId).getConfig()
      const commandPrefix = (config.get('commandPrefix') || 'p!').toLowerCase()
      const commandDeleteTime = config.get('commandDeleteTimeInSeconds') || 3
      const resultDeleteTime = config.get('resultDeleteTimeInSeconds') || 30
      if (config.get('allowPingSyntax') && message.content.startsWith(`<@${client.user.id}> `)) {
        // convert "@Pinano Bot help" syntax to p!help syntax
        message.content = `${commandPrefix}${message.content.replace(`<@${client.user.id}> `, '').trim()}`
      }

      if (!message.content.toLowerCase().startsWith(commandPrefix)) {
        this.emit(guildId, 'message', message)
        return
      }

      try {
        const tokenized = message.content.split(' ')
        let command = tokenized.shift().substring(commandPrefix.length)
        // mobile users sometimes end up with a space between the ! and the
        // command. Try to adapt to various mistakes.
        if (command === '') command = tokenized.shift()
        if (command != null) command = command.toLowerCase()
        setTimeout(() => message.delete(), commandDeleteTime * 1000)
        if (this._commandHandlers[guildId] != null) {
          if (this._commandHandlers[guildId][command] != null) {
            const result = await this._commandHandlers[guildId][command](message.member, tokenized)
            if (result.reacts != null) {
              this.reactableMessage(message, { embeds: result.embeds }, resultDeleteTime, result.reacts)
            } else {
              this.cancellableMessage(message, result, resultDeleteTime)
            }
          } else {
            throw new Error(`Unknown command: ${command}`)
          }
        }
      } catch (err) {
        this.cancellableMessage(message, {
          embeds: [{
            title: 'Error',
            description: err.message,
            color: config.get('embedColor') || 'DEFAULT',
            timestamp: new Date()
          }]
        }, resultDeleteTime)
      }
    })
    client.on('channelCreate', channel => {
      if (channel.guild == null) {
        // DM channels aren't interesting to us.
        return
      }
      const guildId = channel.guild.id
      this.emit(guildId, 'channelCreate', channel)
    })
    client.on('channelDelete', channel => {
      if (channel.guild == null) {
        // DM channels aren't interesting to us.
        return
      }
      const guildId = channel.guild.id
      this.emit(guildId, 'channelDelete', channel)
    })
    client.on('channelUpdate', (oldChannel, newChannel) => {
      const guildId = newChannel.guild.id
      this.emit(guildId, 'channelUpdate', oldChannel, newChannel)
    })
    client.on('voiceStateUpdate', (oldState, newState) => {
      const guildId = newState.guild.id
      this.emit(guildId, 'voiceStateUpdate', oldState, newState)
    })
    client.on('channelPinsUpdate', channel => {
      const guildId = channel.guild.id
      this.emit(guildId, 'channelPinsUpdate', channel)
    })
  }

  async reactableMessage (request, response, timeout, reacts) {
    const message = await request.channel.send(response)
    let deleted = false
    let timeoutHandle
    let timeoutCleared = false
    function resetTimeoutHandle () {
      if (timeoutHandle != null) {
        clearTimeout(timeoutHandle)
      }
      if (!timeoutCleared) {
        timeoutHandle = setTimeout(() => {
          if (!deleted) {
            message.delete().catch(() => {
              log(`Could not delete message ${message.id}; the message was probably already deleted.`)
            })
          }
        }, timeout * 1000)
      }
    }
    resetTimeoutHandle()
    const collector = message.createReactionCollector({ filter: (r, u) => u !== this._client.user })
    collector.on('collect', async (reaction, reactor) => {
      const member = request.guild.members.cache.get(reactor.id)
      if (reactor !== request.author && !member.hasPermission('MANAGE_MESSAGES')) {
        reaction.users.remove(reactor)
        return
      }

      let shouldClear = true
      if (Object.keys(reacts).includes(reaction.emoji.name)) {
        reacts[reaction.emoji.name](message, {
          close: () => {
            deleted = true
            message.delete()
            shouldClear = false
          },
          done: () => {
            collector.stop()
            message.reactions.removeAll()
            shouldClear = false
          },
          lock: () => {
            clearTimeout(timeoutHandle)
            timeoutCleared = true
            shouldClear = false
          }
        })
      }
      if (shouldClear) {
        reaction.users.remove(reactor)
      }
      resetTimeoutHandle()
    })

    Object.keys(reacts).forEach(react => {
      message.react(react).catch(() => {
        log(`Could not react to message ${message.id}; the message was probably deleted.`)
      })
    })
  }

  cancellableMessage (request, response, timeout) {
    this.reactableMessage(request, response, timeout, {
      '🔒': (message, helpers) => helpers.lock(),
      '❌': (message, helpers) => helpers.close()
    })
  }

  emit (guildId, eventName, ...args) {
    if (this._eventHandlers[guildId] != null && this._eventHandlers[guildId][eventName] != null) {
      this._eventHandlers[guildId][eventName].forEach(handler => {
        handler(...args)
      })
    }
  }

  command (command, guildId, handler, ...aliases) {
    if (this._commandHandlers[guildId] == null) {
      this._commandHandlers[guildId] = {}
    }

    this._commandHandlers[guildId][command] = handler
    aliases.forEach(alias => {
      this._commandHandlers[guildId][alias] = handler
    })
  }

  on (eventName, guildId, handler) {
    if (this._eventHandlers[guildId] == null) {
      this._eventHandlers[guildId] = {}
    }

    if (this._eventHandlers[guildId][eventName] == null) {
      this._eventHandlers[guildId][eventName] = []
    }

    this._eventHandlers[guildId][eventName].push(handler)
  }
}

module.exports = EventDispatcher
