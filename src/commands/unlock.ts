import Discord from 'discord.js';
import { unlockChannelAndDeleteEmptyChannels } from '../utils/channelUtils';
import { isAdmin, replyToMessage } from '../utils/memberUtils';

export async function unlock(message: Discord.Message, discord: Discord.Client) {
  const channelArg = message.content.split('unlock ')[1];
  const currentVC = message.member?.voice.channel;

  if (channelArg && channelArg.length > 0) {
    await unlockFromArg(message, channelArg);
    return;
  }

  if (currentVC) {
    await unlockCurrentChannel(message, currentVC);
  }
}

async function unlockFromArg(message: Discord.Message, channel: string) {
  const guildManager = message.guild?.channels;
  if (!guildManager || !message.member) {
    return;
  }

  if (!isAdmin(message.member)) {
    const response = new Discord.MessageEmbed().addField(
      'You are not an admin',
      `Only an admin can unlock a room by specifying the name`,
    );
    await replyToMessage(message, response);
  } else {
    await unlockChannelAndDeleteEmptyChannels(guildManager, channel);
  }
}

async function unlockCurrentChannel(message: Discord.Message, channel: Discord.VoiceChannel) {
  const guildManager = message.guild?.channels;
  if (!guildManager || !message.member) {
    return;
  }
  if (message.member.voice.serverMute === true && !isAdmin(message.member)) {
    const response = new Discord.MessageEmbed().addField(
      'You are not the host or an admin',
      `Only an admin or host can unlock your current room`,
    );
    await replyToMessage(message, response);
    return;
  }
  await unlockChannelAndDeleteEmptyChannels(guildManager, channel);
}
