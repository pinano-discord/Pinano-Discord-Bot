const MODULE_NAME = 'Roles'

class RoleManager {
  constructor (moduleManager) {
    this._config = moduleManager.getConfig()
    this._moduleManager = moduleManager
  }

  resume () {
    const guild = this._moduleManager.getGuild()
    const dispatcher = this._moduleManager.getDispatcher()
    if (this._config.get('toggleableRoles') != null) {
      this._config.get('toggleableRoles').forEach(role => {
        dispatcher.command(role.command, guild.id, authorMember => {
          if (authorMember.roles.cache.get(role.id) != null) {
            // remove the role
            authorMember.roles.remove(role.id)
            return {
              embed: {
                title: MODULE_NAME,
                description: `<@${authorMember.id}> no longer has the role <@&${role.id}>.`,
                color: this._config.get('embedColor') || 'DEFAULT',
                timestamp: new Date()
              }
            }
          } else {
            // add the role
            authorMember.roles.add(role.id)
            return {
              embed: {
                title: MODULE_NAME,
                description: `<@${authorMember.id}> now has the role <@&${role.id}>.`,
                color: this._config.get('embedColor') || 'DEFAULT',
                timestamp: new Date()
              }
            }
          }
        })
      })
    }

    dispatcher.command('ranks', guild.id, async (authorMember) => {
      if (this._config.get('ranks') == null || this._config.get('ranks').length === 0) {
        throw new Error('No ranks available.')
      }

      const ranks = this._config.get('ranks')
        .filter(id => guild.roles.cache.get(id) != null)
        .map(id => {
          return {
            id: id,
            name: guild.roles.cache.get(id).name
          }
        })

      const embedColor = this._config.get('embedColor') || 'DEFAULT'
      let choice1, choice2, choice3, choice4, choice5
      let page = 1
      function refreshMenu () {
        choice1 = ranks[(page - 1) * 5 + 0]
        choice2 = ranks[(page - 1) * 5 + 1]
        choice3 = ranks[(page - 1) * 5 + 2]
        choice4 = ranks[(page - 1) * 5 + 3]
        choice5 = ranks[(page - 1) * 5 + 4]

        let description = 'React ⛔ to remove rank'
        if (choice1 != null) {
          description += `\nReact 1️⃣ for **<@&${choice1.id}>**`
        }
        if (choice2 != null) {
          description += `\nReact 2️⃣ for **<@&${choice2.id}>**`
        }
        if (choice3 != null) {
          description += `\nReact 3️⃣ for **<@&${choice3.id}>**`
        }
        if (choice4 != null) {
          description += `\nReact 4️⃣ for **<@&${choice4.id}>**`
        }
        if (choice5 != null) {
          description += `\nReact 5️⃣ for **<@&${choice5.id}>**`
        }

        return {
          embed: {
            title: MODULE_NAME,
            description: description,
            color: embedColor,
            timestamp: new Date()
          }
        }
      }
      function makeSelection (selection, message, done) {
        const existingRole = authorMember.roles.cache.find(role => ranks.some(r => r.id === role.id))
        if (existingRole != null && (selection == null || existingRole.id !== selection.id)) {
          authorMember.roles.remove(existingRole)
        }

        if (selection != null) {
          if (existingRole == null || existingRole.id !== selection.id) {
            authorMember.roles.add(selection.id)
          }
          message.edit({
            embed: {
              title: MODULE_NAME,
              description: `<@${authorMember.id}> is now a member of <@&${selection.id}>.`,
              color: embedColor,
              timestamp: new Date()
            }
          })
        } else {
          message.edit({
            embed: {
              title: MODULE_NAME,
              description: 'Rankless you came into this server, and rankless you shall be once more...',
              color: embedColor,
              timestamp: new Date()
            }
          })
        }
        done()
      }

      const embed = refreshMenu()
      const reacts = { '❌': (message, helpers) => helpers.close() }
      if (ranks.length > 5) {
        reacts['◀'] = (message) => {
          --page
          if (page < 1) {
            page = 1
          }
          message.edit(refreshMenu())
        }
        reacts['▶'] = (message) => {
          ++page
          const totalPages = Math.ceil(ranks.length / 5)
          if (page > totalPages) {
            page = totalPages
          }
          message.edit(refreshMenu())
        }
      }
      reacts['⛔'] = (message, helpers) => makeSelection(null, message, helpers.done)
      if (choice1 != null) {
        reacts['1️⃣'] = (message, helpers) => makeSelection(choice1, message, helpers.done)
      }
      if (choice2 != null) {
        reacts['2️⃣'] = (message, helpers) => makeSelection(choice2, message, helpers.done)
      }
      if (choice3 != null) {
        reacts['3️⃣'] = (message, helpers) => makeSelection(choice3, message, helpers.done)
      }
      if (choice4 != null) {
        reacts['4️⃣'] = (message, helpers) => makeSelection(choice4, message, helpers.done)
      }
      if (choice5 != null) {
        reacts['5️⃣'] = (message, helpers) => makeSelection(choice5, message, helpers.done)
      }
      return {
        embed: embed,
        reacts: reacts
      }
    })
  }
}

function makeModule (moduleManager) {
  if (!moduleManager.getConfig().get('enableRoles')) return
  return new RoleManager(moduleManager)
}

module.exports = { name: MODULE_NAME, makeModule: makeModule }
