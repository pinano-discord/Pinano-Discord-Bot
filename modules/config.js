const util = require('../library/util')

const MODULE_NAME = 'Configuration Management'

class ConfigManagement {
  constructor (moduleManager) {
    this._guild = moduleManager.getGuild()
    this._config = moduleManager.getConfig()
    this._moduleManager = moduleManager

    // TODO: bootstrap configuration
    if (this._config.get('managementRoleId') == null) {
      throw new Error('User management commands require a management role ID.')
    }

    this._managementRole = this._guild.roles.resolve(this._config.get('managementRoleId'))
    if (this._managementRole == null) {
      throw new Error('managementRoleId does not refer to a valid role.')
    }
  }

  resume () {
    const dispatcher = this._moduleManager.getDispatcher()
    dispatcher.command('config', this._guild.id, (authorMember, tokenized) => {
      util.requireRole(authorMember, this._managementRole)

      const USAGE = `${this._config.get('commandPrefix') || 'p!'}config [ set | unset | add | remove ] KEY [ VALUE ]`
      if (tokenized.length === 0) {
        throw new Error(`Usage: \`${USAGE}\``)
      }

      const operation = tokenized.shift()
      switch (operation) {
        case 'set': {
          if (tokenized.length < 2) {
            throw new Error(`Usage: \`${this._config.get('commandPrefix') || 'p!'}config set KEY VALUE\``)
          }
          const key = tokenized.shift()
          const value = tokenized.join(' ').trim()
          util.log(`Configuration modified by ${authorMember.id}: set ${key} ${value}`)
          this._config.set(key, value)
          return {
            embed: {
              title: MODULE_NAME,
              description: `Set configuration key \`${key}\` to \`${value}\`.`,
              color: this._config.get('embedColor') || 'DEFAULT',
              timestamp: new Date()
            }
          }
        }
        case 'unset': {
          if (tokenized.length === 0) {
            throw new Error(`Usage: \`${this._config.get('commandPrefix') || 'p!'}config unset KEY\``)
          }
          const key = tokenized.shift()
          util.log(`Configuration modified by ${authorMember.id}: unset ${key}`)
          this._config.unset(key)
          return {
            embed: {
              title: MODULE_NAME,
              description: `Unset configuration key \`${key}\`.`,
              color: this._config.get('embedColor') || 'DEFAULT',
              timestamp: new Date()
            }
          }
        }
        case 'add': {
          if (tokenized.length < 2) {
            throw new Error(`Usage: \`${this._config.get('commandPrefix') || 'p!'}config add KEY VALUE\``)
          }
          const key = tokenized.shift()
          const value = tokenized.join(' ').trim()
          util.log(`Configuration modified by ${authorMember.id}: add ${key} ${value}`)
          this._config.add(key, value)
          return {
            embed: {
              title: MODULE_NAME,
              description: `Added \`${value}\` to configuration key \`${key}\`.`,
              color: this._config.get('embedColor') || 'DEFAULT',
              timestamp: new Date()
            }
          }
        }
        case 'remove': {
          if (tokenized.length < 2) {
            throw new Error(`Usage: \`${this._config.get('commandPrefix') || 'p!'}config remove KEY VALUE\``)
          }
          const key = tokenized.shift()
          const value = tokenized.join(' ').trim()
          util.log(`Configuration modified by ${authorMember.id}: remove ${key} ${value}`)
          this._config.remove(key, value)
          return {
            embed: {
              title: MODULE_NAME,
              description: `Removed \`${value}\` from configuration key \`${key}\`.`,
              color: this._config.get('embedColor') || 'DEFAULT',
              timestamp: new Date()
            }
          }
        }
        default:
          throw new Error(`Usage: \`${USAGE}\``)
      }
    })
  }
}

function makeModule (moduleManager) {
  return new ConfigManagement(moduleManager)
}

module.exports = { name: MODULE_NAME, makeModule: makeModule }
