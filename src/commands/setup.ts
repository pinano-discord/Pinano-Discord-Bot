import Discord from 'discord.js';
import { environment } from '../environment';
import { initialiseCategoryAndChannels } from '../utils/channelUtils';
import { isAdmin, replyToMessage } from '../utils/memberUtils';

export async function setup(message: Discord.Message, discord: Discord.Client) {
  if (!message.member) {
    return;
  }

  if (!isAdmin(message.member)) {
    const response = new Discord.MessageEmbed().addField(
      'Admin Required to Setup',
      'Get an admin to run this command',
    );
    await replyToMessage(message, response);
    return;
  }

  await initialiseCategoryAndChannels(message.member.guild.channels);
  const response = new Discord.MessageEmbed().addField(
    'Setup Complete',
    `Category intialised with 1 voice channel`,
  );

  await replyToMessage(message, response);
}
