const { ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionCollector, PermissionFlagsBits } = require('discord.js')
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
            // TODO: all callbacks in dispatcher.command events should change to (message, tokenized) input
            const result = await this._commandHandlers[guildId][command](message, tokenized)
            let response
            if (result.reacts != null) {
              response = await this.reactableMessage(message, { embeds: result.embeds }, resultDeleteTime, result.reacts)
            } else {
              response = await this.cancellableMessage(message, result, resultDeleteTime)
            }
            if (result.interactionHandler != null) {
              const collector = new InteractionCollector(client, { message: response })
              collector.on('collect', result.interactionHandler)
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
            color: config.get('embedColor') || 0,
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
    client.on('threadUpdate', async (oldThread, newThread) => {
      const guildId = newThread.guild.id
      this.emit(guildId, 'threadUpdate', oldThread, newThread)
    })
  }

  async reactableMessage (request, response, timeout, reacts) {
    function createComponents () {
      const row = new ActionRowBuilder()
      Object.keys(reacts).forEach(react => {
        row.addComponents(new ButtonBuilder().setCustomId(react).setStyle(ButtonStyle.Primary).setEmoji(react).setDisabled(react === '🔒'))
      })
      if (row.components.length === 0) return []
      return [row]
    }
    response.components = createComponents()
    response.ephemeral = true
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

    const collector = new InteractionCollector(this._client, { message: message })
    collector.on('collect', async interaction => {
      if (!interaction.isButton()) return
      if (interaction.member.id !== request.author.id && !interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        interaction.deferUpdate()
        return
      }

      if (Object.keys(reacts).includes(interaction.customId)) {
        reacts[interaction.customId]({
          close: () => {
            deleted = true
            return message.delete()
          },
          lock: () => {
            clearTimeout(timeoutHandle)
            timeoutCleared = true
            reacts = Object.assign({}, { '🔒': reacts['🔓'] }, reacts)
            delete reacts['🔓']
            return interaction.update({ components: createComponents() })
          },
          isLocked: () => { return timeoutCleared },
          update: (embeds, r) => {
            reacts = r
            return interaction.update({ embeds: embeds, components: createComponents() })
          }
        })
      }
      resetTimeoutHandle()
    })
    return message
  }

  cancellableMessage (request, response, timeout) {
    return this.reactableMessage(request, response, timeout, {
      '🔓': helpers => { return helpers.lock() },
      '❌': helpers => { return helpers.close() }
    })
  }

  emit (guildId, eventName, ...args) {
    if (this._eventHandlers[guildId] != null && this._eventHandlers[guildId][eventName] != null) {
      this._eventHandlers[guildId][eventName].forEach(handler => {
        handler(...args)
      })
    }
  }

  // handler = (message, tokenized) => {}
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
