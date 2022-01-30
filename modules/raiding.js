const { resolveUntaggedMember } = require('../library/util')

const MODULE_NAME = 'Channel Raiding'

class Raiding {
  constructor (moduleManager) {
    this._config = moduleManager.getConfig()
    this._moduleManager = moduleManager
  }

  resume () {
    const guild = this._moduleManager.getGuild()
    const pracman = this._moduleManager.getModule('Practice Manager')
    const dispatcher = this._moduleManager.getDispatcher()
    dispatcher.command('raid', guild.id, (authorMember, tokenized) => {
      if (authorMember.voice == null || authorMember.voice.channel == null) {
        throw new Error('You are not in a practice room.')
      }

      const sourceChannel = authorMember.voice.channel
      let tracker = pracman._tracker[sourceChannel.id]
      if (tracker == null) {
        throw new Error('You are not in a practice room.')
      }
      if (tracker.lockedBy !== authorMember.id) {
        throw new Error('You do not have this room locked.')
      }

      const fullyQualifiedName = tokenized.join(' ').trim()
      const target = resolveUntaggedMember(guild, fullyQualifiedName)
      if (target.voice == null || target.voice.channel == null) {
        throw new Error(`<@${target.id}> is not in a practice room.`)
      }

      const targetChannel = target.voice.channel
      tracker = pracman._tracker[targetChannel.id]
      if (tracker == null) {
        throw new Error(`<@${target.id}> is not in a practice room.`)
      }
      if (tracker.lockedBy !== target.id) {
        throw new Error(`<@${target.id}>'s room is not locked.`)
      }

      if (sourceChannel.members.size === 1) {
        throw new Error(`It's just you in here. Why don't you just join <@${target.id}>'s room yourself?`)
      }

      let numUsers = 0
      sourceChannel.members
        .filter(m => m !== authorMember)
        .forEach(m => {
          ++numUsers
          m.voice.setChannel(targetChannel)
        })
      // raiding member should be the last one out
      authorMember.voice.setChannel(targetChannel)

      return {
        embeds: [{
          title: MODULE_NAME,
          description: `Raiding <@${target.id}> with ${numUsers} users!`,
          color: this._config.get('embedColor') || 'DEFAULT',
          timestamp: new Date()
        }]
      }
    })
  }
}

function makeModule (moduleManager) {
  if (!moduleManager.getConfig().get('enableChannelRaiding')) return
  return new Raiding(moduleManager)
}

module.exports = { name: MODULE_NAME, makeModule: makeModule }
