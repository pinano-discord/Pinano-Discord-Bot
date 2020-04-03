import Discord from 'discord.js';
import { lockChannelAndCreateNewChannel, isLockedVoiceChannel } from '../utils/channelUtils';

export async function lock(message: Discord.Message, discord: Discord.Client) {
  if (!message.member) {
    return;
  }

  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) {
    return;
  }

  if (isLockedVoiceChannel(voiceChannel)) {
    const response = new Discord.MessageEmbed().addField(
      'Room Already Locked',
      "You cannot lock a room that's already locked",
    );

    await message.member.lastMessage?.channel.send(response);
    return;
  }

  await lockChannelAndCreateNewChannel(message.member.guild.channels, voiceChannel, message.member);
}
