import Discord from 'discord.js';
import { environment } from '../environment';

export async function help(message: Discord.Message, discord: Discord.Client) {
  const response = new Discord.MessageEmbed()
    .setTitle('Help')
    .addField(`\`${environment.command_prefix}help\``, 'Displays this help message')
    .addField(
      `\`${environment.command_prefix}stats [ USERNAME#DISCRIMINATOR ]\``,
      'Displays practice statistics for the specified user (default: calling user)',
    )
    .addField(
      `\`${environment.command_prefix}lock\``,
      'Locks the currently occupied room for exclusive use',
    )
    .addField(
      `\`${environment.command_prefix}bitrate [ BITRATE_IN_KBPS ]\``,
      'Adjusts the bitrate of the currently occupied room',
    )
    .addField(
      `\`${environment.command_prefix}unlock [ <#CHANNEL_ID> ]\``,
      'Unlocks the specified room for shared use (default: currently occupied room)',
    )
    .addField(
      `\`${environment.command_prefix}unlock\``,
      'Unlocks the currently occupied room for shared use',
    )
    .addField(
      `\`${environment.command_prefix}recital[s] [ add | del(ete) | rem(ove) ] @user RECITAL_ID\``,
      "Add or remove a recital from a user's record",
    )
    .addField(
      `\`${environment.command_prefix}addtime @user TIME_IN_SECONDS\``,
      "Adds practice time to a user's record",
    )
    .addField(
      `\`${environment.command_prefix}deltime @user TIME_IN_SECONDS\``,
      "Removes practice time from a user's record",
    )
    .addField(
      `\`${environment.command_prefix}restart, ${environment.command_prefix}reboot\``,
      'Saves all active sessions and restarts Pinano Bot',
    )
    .setColor(environment.embed_color)
    .setTimestamp();

  await message.author.send(response);
}
