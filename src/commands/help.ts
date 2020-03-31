import { environment } from '../environment';

import * as Discord from 'discord.js';

const { selfDestructMessage } = require('./helpers');

async function help(client, message) {
  const isBotManager = message.member.roles.find((r) => r.name === 'Bot Manager');
  const isRecitalManager = message.member.roles.find((r) => r.name === 'Recital Manager');

  const msg = new Discord.RichEmbed();
  msg.setTitle('Help');
  msg.addField(`\`${environment.prefix}help\``, 'Displays this help message');
  msg.addField(
    `\`${environment.prefix}stats [ USERNAME#DISCRIMINATOR ]\``,
    'Displays practice statistics for the specified user (default: calling user)',
  );
  msg.addField(
    `\`${environment.prefix}lock\``,
    'Locks the currently occupied room for exclusive use',
  );
  msg.addField(
    `\`${environment.prefix}bitrate [ BITRATE_IN_KBPS ]\``,
    'Adjusts the bitrate of the currently occupied room',
  );

  if (isBotManager) {
    msg.addField(
      `\`${environment.prefix}unlock [ <#CHANNEL_ID> ]\``,
      'Unlocks the specified room for shared use (default: currently occupied room)',
    );
  } else {
    msg.addField(
      `\`${environment.prefix}unlock\``,
      'Unlocks the currently occupied room for shared use',
    );
  }

  if (isRecitalManager) {
    msg.addField(
      `\`${environment.prefix}recital[s] [ add | del(ete) | rem(ove) ] @user RECITAL_ID\``,
      "Add or remove a recital from a user's record",
    );
  }

  if (isBotManager) {
    msg.addField(
      `\`${environment.prefix}addtime @user TIME_IN_SECONDS\``,
      "Adds practice time to a user's record",
    );
    msg.addField(
      `\`${environment.prefix}deltime @user TIME_IN_SECONDS\``,
      "Removes practice time from a user's record",
    );
    msg.addField(
      `\`${environment.prefix}restart, ${environment.prefix}reboot\``,
      'Saves all active sessions and restarts Pinano Bot',
    );
  }

  msg.setColor(environment.embed_color);
  msg.setTimestamp();
  message.author.send(msg);

  selfDestructMessage(() => message.reply('sent you the command list.'));
}

module.exports = { help };
