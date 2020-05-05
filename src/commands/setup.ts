import Discord from 'discord.js';
import { isAdmin, replyToMessage } from '../utils/memberUtils';
import { initialiseCategoryAndChannels } from '../utils/discordUtils/initialisation';

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
    `Category intialised with voice channels`,
  );

  await replyToMessage(message, response);
}
