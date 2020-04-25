import Discord from 'discord.js';
import { isAdmin, replyToMessage } from '../utils/memberUtils';
import { setChannelBitrate } from '../utils/discordUtils/channels';

export async function bitrate(message: Discord.Message, discord: Discord.Client) {
  const bitrateArg = message.content.split('bitrate ')[1];
  const channel = message.member?.voice.channel;
  if (!channel || !message.member) {
    return;
  }

  if (!isAdmin(message.member)) {
    const response = new Discord.MessageEmbed().addField(
      'You are not an admin',
      `Only an admin can change the bitrate of a room`,
    );
    await replyToMessage(message, response);
  } else {
    setBitrate(message, channel, bitrateArg);
  }
}

async function setBitrate(
  message: Discord.Message,
  channel: Discord.VoiceChannel,
  bitrateArg?: string,
) {
  const bitrate = bitrateArg !== undefined ? parseInt(bitrateArg) * 1000 : undefined;
  if (bitrate === undefined) {
    const response = new Discord.MessageEmbed().addField(
      'You must specify a bitrate',
      `Specify a bitrate in kbps after the command`,
    );
    await replyToMessage(message, response);
  } else {
    const guildManager = message.guild?.channels;
    if (!guildManager) {
      return;
    }
    try {
      await setChannelBitrate(guildManager, channel, bitrate);
      const response = new Discord.MessageEmbed().addField(
        `Bitrate sucessfully updated`,
        `Bitrate of "${channel.name}" updated to ${bitrateArg}kpbs`,
      );
      await replyToMessage(message, response);
    } catch (error) {
      const response = new Discord.MessageEmbed().addField('Failed to update bitrate', error);
      await replyToMessage(message, response);
    }
  }
}
