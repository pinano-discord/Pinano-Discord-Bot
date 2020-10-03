const util = require('../library/util')

const MODULE_NAME = 'User Management'

class UserManagement {
  constructor (moduleManager) {
    this._guild = moduleManager.getGuild()
    this._config = moduleManager.getConfig()
    this._moduleManager = moduleManager

    if (this._config.get('managementRoleId') == null) {
      throw new Error('User management commands require a management role ID.')
    }

    this._managementRole = this._guild.roles.resolve(this._config.get('managementRoleId'))
    if (this._managementRole == null) {
      throw new Error('managementRoleId does not refer to a valid role.')
    }
  }

  resume () {
    const userRepository = this._moduleManager.getPersistence().getUserRepository(this._guild.id)
    const dispatcher = this._moduleManager.getDispatcher()
    dispatcher.command('addtime', this._guild.id, (authorMember, tokenized) => {
      util.requireRole(authorMember, this._managementRole)

      const USAGE = `${this._config.get('commandPrefix') || 'p!'}addtime @user TIME_IN_SECONDS`
      util.requireParameterCount(tokenized, 2, USAGE)
      util.requireParameterFormat(tokenized[0], arg => arg.startsWith('<@') && arg.endsWith('>'), USAGE)
      util.requireParameterFormat(tokenized[1], arg => Number.isInteger(parseInt(arg)), USAGE)

      const delta = parseInt(tokenized[1])
      const targetId = tokenized[0].replace(/[<@!>]/g, '')
      if (targetId === authorMember.id) {
        throw new Error('Cannot modify own record')
      }

      const result = userRepository.incrementSessionPlaytimes(targetId, delta, false)
      if (result == null) {
        throw new Error(`No existing record for user ${targetId}`)
      }

      util.log(`addtime ${targetId} ${delta} by ${authorMember.id}`)
      return {
        embed: {
          title: MODULE_NAME,
          description: `Added ${delta} second(s) to <@${targetId}>.`,
          color: this._config.get('embedColor') || 'DEFAULT',
          timestamp: new Date()
        }
      }
    })

    dispatcher.command('deltime', this._guild.id, (authorMember, tokenized) => {
      util.requireRole(authorMember, this._managementRole)

      const USAGE = `${this._config.get('commandPrefix') || 'p!'}deltime @user TIME_IN_SECONDS`
      util.requireParameterCount(tokenized, 2, USAGE)
      util.requireParameterFormat(tokenized[0], arg => arg.startsWith('<@') && arg.endsWith('>'), USAGE)
      util.requireParameterFormat(tokenized[1], arg => Number.isInteger(parseInt(arg)), USAGE)

      const delta = parseInt(tokenized[1])
      const userId = tokenized[0].replace(/[<@!>]/g, '')
      if (userId === authorMember.id) {
        throw new Error('Cannot modify own record')
      }

      const result = userRepository.decrementSessionPlaytimes(userId, delta, false)
      if (result == null) {
        throw new Error(`No existing record for user ${userId}`)
      }

      util.log(`deltime ${userId} ${delta} by ${authorMember.id}`)
      return {
        embed: {
          title: MODULE_NAME,
          description: `Removed ${delta} second(s) from <@${userId}>.`,
          color: this._config.get('embedColor') || 'DEFAULT',
          timestamp: new Date()
        }
      }
    })
  }
}

function makeModule (moduleManager) {
  if (!moduleManager.getConfig().get('enableUserManagement')) return
  return new UserManagement(moduleManager)
}

module.exports = { name: MODULE_NAME, makeModule: makeModule }
