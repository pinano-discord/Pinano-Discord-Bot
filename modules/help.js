const Discord = require('discord.js')
const { log } = require('../library/util')

const MODULE_NAME = 'Help'

class Help {
  constructor (moduleManager) {
    this._guild = moduleManager.getGuild()
    this._config = moduleManager.getConfig()
    this._moduleManager = moduleManager

    if (this._config.get('managementRoleId') != null) {
      this._managementRole = this._guild.roles.resolve(this._config.get('managementRoleId'))
      if (this._managementRole == null) {
        throw new Error('managementRoleId does not refer to a valid role.')
      }
    }
  }

  resume () {
    const client = this._moduleManager.getClient()
    const dispatcher = this._moduleManager.getDispatcher()
    dispatcher.command('help', this._guild.id, (authorMember, tokenized) => {
      let isPrivileged = false
      if (this._managementRole != null) {
        isPrivileged = authorMember.roles.cache.has(this._managementRole.id)
      }

      const response = new Discord.MessageEmbed()
      const prefix = this._config.get('commandPrefix') || 'p!'
      response.setTitle(MODULE_NAME)
      response.addField(`\`${prefix}help\``, 'Displays this help message')
      if (this._config.get('enableDailyTime')) {
        response.addField(`\`${prefix}setdailyreset [ HOUR | off ]\``, `Daily time tracking will reset at the specified hour in UTC (current hour is ${(new Date()).getUTCHours()}); \`HOUR\` must be between 0 and 23`)
      }
      if (this._config.get('enablePStats')) {
        response.addField(`\`${prefix}stats [ USERNAME#DISCRIMINATOR ]\``, 'Display statistics for @user (default: calling user)')
      }
      if (this._config.get('enableListeningGraph')) {
        response.addField(`\`${prefix}top [ USERNAME#DISCRIMINATOR ]\``, 'Display top listeners and top listened to for @user (default: calling user)')
      }
      if (this._config.get('enablePolicyManager')) {
        if (isPrivileged) {
          response.addField(`\`${prefix}lock\` [ <#CHANNEL_ID> USERNAME#DISCRIMINATOR ]`, 'Lock the specified room for exclusive use by @user (default: currently occupied room)')
          response.addField(`\`${prefix}unlock [ <#CHANNEL_ID> ]\``, 'Unlock the specified room for shared use (default: currently occupied room)')
        } else {
          response.addField(`\`${prefix}lock\``, 'Lock the currently occupied room for exclusive use')
          response.addField(`\`${prefix}unlock\``, 'Unlocks the currently occupied room for shared use')
        }
      }
      if (this._config.get('enableChannelRaiding')) {
        response.addField(`\`${prefix}raid USERNAME#DISCRIMINATOR\``, 'Transfer all users from locked room to @user\'s locked room')
      }
      if (this._config.get('enableSubscriptions')) {
        response.addField(`\`${prefix}subscribe USERNAME#DISCRIMINATOR\``, 'Get a DM when @user starts practicing')
        response.addField(`\`${prefix}unsubscribe USERNAME#DISCRIMINATOR\``, 'Stop getting a DM when @user starts practicing')
        response.addField(`\`${prefix}subscribers [ on | off | silent ]\``, 'Enable/disable subscription to self, or disables notifications')
      }
      if (this._config.get('enableLiteratureQuiz')) {
        response.addField(`\`${prefix}queue\``, 'Display the active riddle queue in Literature Quiz')
      }
      if (this._config.get('enableFaq')) {
        response.addField(`\`${prefix}faq KEYWORD\``, 'Display the FAQ entry for `KEYWORD`')
      }
      if (this._config.get('enableRoles')) {
        response.addField(`\`${prefix}ranks\``, 'Change ranks')
      }
      if (this._config.get('enableUserManagement') && isPrivileged) {
        response.addField(`\`${prefix}addtime @user TIME_IN_SECONDS\``, 'Add practice time to @user\'s record')
        response.addField(`\`${prefix}deltime @user TIME_IN_SECONDS\``, 'Remove practice time from @user\'s record')
      }
      if (this._config.get('enableRestart') && isPrivileged) {
        response.addField(`\`${prefix}restart [ forced ]\``, `Restarts <@${client.user.id}> (if forced, live sessions will not be saved)`)
      }
      response.setColor(this._config.get('embedColor') || 'DEFAULT')
      response.setTimestamp()
      authorMember.user.send(response).catch(() => {
        log(`Failed to DM ${authorMember.id} the help file. This message is safe to ignore.`)
      })

      return {
        embeds: [{
          title: MODULE_NAME,
          description: 'Sent you a DM with the command list.',
          color: this._config.get('embedColor') || 'DEFAULT',
          timestamp: new Date()
        }]
      }
    })
  }
}

function makeModule (moduleManager) {
  if (!moduleManager.getConfig().get('enableHelp')) return
  return new Help(moduleManager)
}

module.exports = { name: MODULE_NAME, makeModule: makeModule }
