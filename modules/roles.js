const { MessageActionRow, MessageEmbed, MessageSelectMenu } = require('discord.js')

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
              embeds: [{
                title: MODULE_NAME,
                description: `<@${authorMember.id}> no longer has the role <@&${role.id}>.`,
                color: this._config.get('embedColor') || 'DEFAULT',
                timestamp: new Date()
              }]
            }
          } else {
            // add the role
            authorMember.roles.add(role.id)
            return {
              embeds: [{
                title: MODULE_NAME,
                description: `<@${authorMember.id}> now has the role <@&${role.id}>.`,
                color: this._config.get('embedColor') || 'DEFAULT',
                timestamp: new Date()
              }]
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

      let description = 'Please select a rank:\n'
      ranks.forEach(rank => { description += `\n**<@&${rank.id}>**` })
      const embed = new MessageEmbed()
        .setColor(this._config.get('embedColor') || 'DEFAULT')
        .setTitle(MODULE_NAME)
        .setDescription(description)
      const menu = new MessageSelectMenu()
        .setCustomId('roleSelect')
        .setPlaceholder('Select a role')
        .addOptions([{
          label: 'Rankless',
          description: 'I don\'t want a rank',
          value: 'rankless'
        }])
      ranks.forEach(rank => {
        menu.addOptions([{
          label: rank.name,
          description: rank.name,
          value: rank.id
        }])
      })
      const row = new MessageActionRow().addComponents(menu)
      return {
        embeds: [embed],
        ephemeral: true,
        components: [row],
        interactionHandler: async interaction => {
          if (!interaction.isSelectMenu()) return
          if (interaction.customId !== 'roleSelect') return
          if (interaction.member !== authorMember) return

          const selection = interaction.values[0]
          const existingRoles = interaction.member.roles.cache.filter(role => ranks.some(r => r.id === role.id && r.id !== selection))
          existingRoles.forEach(role => {
            interaction.member.roles.remove(role)
          })
          if (selection === 'rankless') {
            const embed = new MessageEmbed()
              .setColor(this._config.get('embedColor') || 'DEFAULT')
              .setTitle(MODULE_NAME)
              .setDescription('Rankless you came into this server, and rankless you shall be once more...')
            interaction.update({
              embeds: [embed],
              components: []
            })
          } else {
            interaction.member.roles.add(selection)
            const embed = new MessageEmbed()
              .setColor(this._config.get('embedColor') || 'DEFAULT')
              .setTitle(MODULE_NAME)
              .setDescription(`<@${interaction.member.id}> is now a member of <@&${selection}>.`)
            interaction.update({
              embeds: [embed],
              components: []
            })
          }
        }
      }
    })
  }
}

function makeModule (moduleManager) {
  if (!moduleManager.getConfig().get('enableRoles')) return
  return new RoleManager(moduleManager)
}

module.exports = { name: MODULE_NAME, makeModule: makeModule }
