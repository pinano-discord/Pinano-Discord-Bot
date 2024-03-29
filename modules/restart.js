// TODO: restrict usage of this module to privileged guilds only (i.e. the dev
// guild). This will need to happen once guilds can bootstrap their own config
// and enable/disable modules.
const Discord = require('discord.js')
const util = require('../library/util')

const MODULE_NAME = 'Restart'

class Restart {
  constructor (moduleManager) {
    this._guild = moduleManager.getGuild()
    this._config = moduleManager.getConfig()
    this._moduleManager = moduleManager

    if (this._config.get('managementRoleId') == null) {
      throw new Error('Bot management commands require a management role ID.')
    }

    this._managementRole = this._guild.roles.resolve(this._config.get('managementRoleId'))
    if (this._managementRole == null) {
      throw new Error('managementRoleId does not refer to a valid role.')
    }
  }

  resume () {
    const dispatcher = this._moduleManager.getDispatcher()
    const pracman = this._moduleManager.getModule('Practice Manager')
    dispatcher.command('restart', this._guild.id, (message, tokenized) => {
      const authorMember = message.member
      util.requireRole(authorMember, this._managementRole)
      if (tokenized.length > 0 && (tokenized[0] === 'force' || tokenized[0] === 'forced')) {
        // don't do anything - just quit
        util.log(`Forced restart initiated by <@${authorMember.id}>`)
        process.exit(0)
      }

      const color = this._config.get('embedColor') || 0
      return {
        embeds: [{
          title: MODULE_NAME,
          description: 'Press :electric_plug: to restart',
          color: this._config.get('embedColor') || 0,
          timestamp: new Date()
        }],
        reacts: {
          '🔌': async (helpers) => {
            await helpers.update(
              [
                new Discord.EmbedBuilder()
                  .setTitle(MODULE_NAME)
                  .setDescription('I\'ll be right Bach.')
                  .setColor(color)
                  .setTimestamp(new Date())],
              {})
            util.log(`Restart initiated by <@${authorMember.id}>`)
            if (pracman != null) {
              pracman.saveAllSessions().then(() => {
                process.exit(0)
              })
            } else {
              process.exit(0)
            }
          },
          '❌': (helpers) => helpers.close()
        }
      }
    })
  }
}

function makeModule (moduleManager) {
  if (!moduleManager.getConfig().get('enableRestart')) return
  return new Restart(moduleManager)
}

module.exports = { name: MODULE_NAME, makeModule: makeModule }
