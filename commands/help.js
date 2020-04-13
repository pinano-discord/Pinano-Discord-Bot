const settings = require('../settings/settings.json')
const Discord = require('discord.js')

const {
  selfDestructMessage
} = require('./helpers')

async function help (client, message) {
  let isBotManager = message.member.roles.find(r => r.name === 'Bot Manager')
  let isRecitalManager = message.member.roles.find(r => r.name === 'Recital Manager')

  let msg = new Discord.RichEmbed()
  msg.setTitle('Help')
  msg.addField(`\`${settings.prefix}help\``,
    'Displays this help message')
  msg.addField(`\`${settings.prefix}stats [ USERNAME#DISCRIMINATOR ]\``,
    'Displays practice statistics for the specified user (default: calling user)')
  msg.addField(`\`${settings.prefix}lock\``,
    'Locks the currently occupied room for exclusive use')
  msg.addField(`\`${settings.prefix}bitrate [ BITRATE_IN_KBPS ]\``,
    'Adjusts the bitrate of the currently occupied room')
  msg.addField(`\`${settings.prefix}subscribe @user\``,
    'Get a DM when @user starts practicing')
  msg.addField(`\`${settings.prefix}unsubscribe @user\``,
    'Stop getting a DM when @user starts practicing')

  if (isBotManager) {
    msg.addField(`\`${settings.prefix}unlock [ <#CHANNEL_ID> ]\``,
      'Unlocks the specified room for shared use (default: currently occupied room)')
  } else {
    msg.addField(`\`${settings.prefix}unlock\``,
      'Unlocks the currently occupied room for shared use')
  }

  if (isRecitalManager) {
    msg.addField(`\`${settings.prefix}recital[s] [ add | del(ete) | rem(ove) ] @user RECITAL_ID\``,
      'Add or remove a recital from a user\'s record')
  }

  if (isBotManager) {
    msg.addField(`\`${settings.prefix}addtime @user TIME_IN_SECONDS\``,
      'Adds practice time to a user\'s record')
    msg.addField(`\`${settings.prefix}deltime @user TIME_IN_SECONDS\``,
      'Removes practice time from a user\'s record')
    msg.addField(`\`${settings.prefix}restart, ${settings.prefix}reboot\``,
      'Saves all active sessions and restarts Pinano Bot')
  }

  msg.setColor(settings.embed_color)
  msg.setTimestamp()
  message.author.send(msg)

  selfDestructMessage(() => message.reply('sent you the command list.'))
}

module.exports = { help }
