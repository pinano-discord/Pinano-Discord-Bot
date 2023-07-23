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
    dispatcher.command('help', this._guild.id, message => {
      const authorMember = message.member
      let isPrivileged = false
      if (this._managementRole != null) {
        isPrivileged = authorMember.roles.cache.has(this._managementRole.id)
      }

      const response = new Discord.EmbedBuilder()
      const prefix = this._config.get('commandPrefix') || 'p!'
      response.setTitle(MODULE_NAME)
      response.addFields({ name: `\`${prefix}help\``, value: 'Displays this help message' })
      if (this._config.get('enableDailyTime')) {
        response.addFields({ name: `\`${prefix}setdailyreset [ HOUR | off ]\``, value: `Daily time tracking will reset at the specified hour in UTC (current hour is ${(new Date()).getUTCHours()}); \`HOUR\` must be between 0 and 23` })
      }
      if (this._config.get('enablePStats')) {
        response.addFields({ name: `\`${prefix}stats [ USERNAME ]\``, value: 'Display statistics for @user (default: calling user)' })
      }
      if (this._config.get('enableListeningGraph')) {
        response.addFields({ name: `\`${prefix}top [ USERNAME ]\``, value: 'Display top listeners and top listened to for @user (default: calling user)' })
      }
      if (this._config.get('enablePolicyManager')) {
        if (isPrivileged) {
          response.addFields({ name: `\`${prefix}lock\` [ <#CHANNEL_ID> USERNAME ]`, value: 'Lock the specified room for exclusive use by @user (default: currently occupied room)' },
            { name: `\`${prefix}unlock [ <#CHANNEL_ID> ]\``, value: 'Unlock the specified room for shared use (default: currently occupied room)' })
        } else {
          response.addFields({ name: `\`${prefix}lock\``, value: 'Lock the currently occupied room for exclusive use' },
            { name: `\`${prefix}unlock\``, value: 'Unlocks the currently occupied room for shared use' })
        }
      }
      if (this._config.get('enableChannelRaiding')) {
        response.addFields({ name: `\`${prefix}raid USERNAME\``, value: 'Transfer all users from locked room to @user\'s locked room' })
      }
      if (this._config.get('enableSubscriptions')) {
        response.addFields(
          { name: `\`${prefix}subscribe USERNAME\``, value: 'Get a DM when @user starts practicing' },
          { name: `\`${prefix}unsubscribe USERNAME\``, value: 'Stop getting a DM when @user starts practicing' },
          { name: `\`${prefix}subscribers [ on | off | silent ]\``, value: 'Enable/disable subscription to self, or disables notifications' }
        )
      }
      if (this._config.get('enableLiteratureQuiz')) {
        response.addFields({ name: `\`${prefix}queue\``, value: 'Display the active riddle queue in Literature Quiz' })
      }
      if (this._config.get('enableFaq')) {
        response.addFields({ name: `\`${prefix}faq KEYWORD\``, value: 'Display the FAQ entry for `KEYWORD`' })
      }
      if (this._config.get('enableUserManagement') && isPrivileged) {
        response.addFields(
          { name: `\`${prefix}addtime @user TIME_IN_SECONDS\``, value: 'Add practice time to @user\'s record' },
          { name: `\`${prefix}deltime @user TIME_IN_SECONDS\``, value: 'Remove practice time from @user\'s record' },
          { name: `\`${prefix}addpoint @user\``, value: 'Add one literature quiz point to @user\'s record' },
          { name: `\`${prefix}delpoint @user\``, value: 'Remove one literature quiz point from @user\'s record' },
          { name: `\`${prefix}record @role\``, value: 'Add a recital/event to the record of all participants' }
        )
      }
      if (this._config.get('enableRestart') && isPrivileged) {
        response.addFields({ name: `\`${prefix}restart [ forced ]\``, value: `Restarts <@${client.user.id}> (if forced, live sessions will not be saved)` })
      }
      response.setColor(this._config.get('embedColor') || 0)
      response.setTimestamp()
      authorMember.user.send({ embeds: [response] }).catch(() => {
        log(`Failed to DM ${authorMember.id} the help file. This message is safe to ignore.`)
      })

      return {
        embeds: [{
          title: MODULE_NAME,
          description: 'Sent you a DM with the command list.',
          color: this._config.get('embedColor') || 0,
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
