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

      const result = userRepository.incrementSessionPlaytimes(targetId, delta, false)
      if (result == null) {
        throw new Error(`No existing record for user ${targetId}`)
      }

      util.log(`addtime ${targetId} ${delta} by ${authorMember.id}`)
      return {
        embeds: [{
          title: MODULE_NAME,
          description: `Added ${delta} second(s) to <@${targetId}>.`,
          color: this._config.get('embedColor') || 'DEFAULT',
          timestamp: new Date()
        }]
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

      const result = userRepository.decrementSessionPlaytimes(userId, delta, false)
      if (result == null) {
        throw new Error(`No existing record for user ${userId}`)
      }

      util.log(`deltime ${userId} ${delta} by ${authorMember.id}`)
      return {
        embeds: [{
          title: MODULE_NAME,
          description: `Removed ${delta} second(s) from <@${userId}>.`,
          color: this._config.get('embedColor') || 'DEFAULT',
          timestamp: new Date()
        }]
      }
    })

    // Add a single literature quiz point to a user.
    dispatcher.command('addpoint', this._guild.id, async (authorMember, tokenized) => {
      util.requireRole(authorMember, this._managementRole)

      const USAGE = `${this._config.get('commandPrefix') || 'p!'}addpoint @user`
      util.requireParameterCount(tokenized, 1, USAGE)
      util.requireParameterFormat(tokenized[0], arg => arg.startsWith('<@') && arg.endsWith('>'), USAGE)

      const userId = tokenized[0].replace(/[<@!>]/g, '')

      const result = await userRepository.incrementField(userId, 'quiz_score')
      if (result == null) {
        throw new Error(`No existing record for user ${userId}`)
      }

      util.log(`addpoint to ${userId} by ${authorMember.id}`)
      
      const pts = result.quiz_score
      return {
        embeds: [{
          title: MODULE_NAME,
          description: `${tokenized[0]} now has ${pts} point${pts === 1 ? '.' : 's.'}`,
          color: this._config.get('embedColor') || 'DEFAULT',
          timestamp: new Date()
        }]
      }
    })

    // Remove a single literature quiz point from a user.
    dispatcher.command('delpoint', this._guild.id, async (authorMember, tokenized) => {
      util.requireRole(authorMember, this._managementRole)

      const USAGE = `${this._config.get('commandPrefix') || 'p!'}delpoint @user`
      util.requireParameterCount(tokenized, 1, USAGE)
      util.requireParameterFormat(tokenized[0], arg => arg.startsWith('<@') && arg.endsWith('>'), USAGE)

      const userId = tokenized[0].replace(/[<@!>]/g, '')

      const result = await userRepository.incrementField(userId, 'quiz_score', -1)
      if (result == null) {
        throw new Error(`No existing record for user ${userId}`)
      }

      util.log(`delpoint from ${userId} by ${authorMember.id}`)

      const pts = result.quiz_score
      return {
        embeds: [{
          title: MODULE_NAME,
          description: `${tokenized[0]} now has ${pts} point${pts === 1 ? '.' : 's.'}`,
          color: this._config.get('embedColor') || 'DEFAULT',
          timestamp: new Date()
        }]
      }
    })
  }
}

function makeModule (moduleManager) {
  if (!moduleManager.getConfig().get('enableUserManagement')) return
  return new UserManagement(moduleManager)
}

module.exports = { name: MODULE_NAME, makeModule: makeModule }
