import Discord from 'discord.js';
import { replyToMessage } from '../utils/memberUtils';
import { isLockedVoiceChannel, lockChannel } from '../utils/discordUtils/channels';

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

    await replyToMessage(message, response);
    return;
  }

  await lockChannel(message.member.guild.channels, voiceChannel, message.member);
}
