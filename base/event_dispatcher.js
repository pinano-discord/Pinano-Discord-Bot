const { InteractionCollector, MessageActionRow, MessageButton } = require('discord.js')
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
    const row = new MessageActionRow()
    Object.keys(reacts).forEach(react => {
      row.addComponents(new MessageButton().setCustomId(react).setStyle('PRIMARY').setEmoji(react))
    })
    if (response.components == null) {
      response.components = [row]
    } else {
      response.components.push(row)
    }
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
      if (interaction.member.id !== request.author.id && !interaction.member.permissions.has('MANAGE_MESSAGES')) return

      if (Object.keys(reacts).includes(interaction.customId)) {
        reacts[interaction.customId](interaction, {
          close: () => {
            deleted = true
            message.delete()
          },
          lock: () => {
            clearTimeout(timeoutHandle)
            timeoutCleared = true
            // HACK HACK HACK HACK HACK find a better way to replace the lock icon
            // This depends on the lock icon being the first button!
            row.spliceComponents(0, 1, new MessageButton().setCustomId('🔒').setDisabled(true).setStyle('PRIMARY').setEmoji('🔒'))
            interaction.update({ components: [row] })
          }
        })
      }
      resetTimeoutHandle()
    })
    return message
  }

  cancellableMessage (request, response, timeout) {
    return this.reactableMessage(request, response, timeout, {
      '🔓': (message, helpers) => helpers.lock(),
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
