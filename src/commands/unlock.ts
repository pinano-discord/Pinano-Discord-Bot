import Discord from 'discord.js';
import { environment } from '../environment';
import { isLockedVoiceChannel, unlockChannel } from '../utils/channelUtils';
import { replyToMessage } from '../utils/memberUtils';

export async function unlock(message: Discord.Message, discord: Discord.Client) {
  const voiceChannel = message.member?.voice.channel;

  if (!message.member) {
    return;
  }

  if (!voiceChannel) {
    return;
  }

  if (isLockedVoiceChannel(voiceChannel) && message.member.voice.mute === true) {
    const response = new Discord.MessageEmbed().addField(
      'You are not the host',
      `Only the host can unlock a room by typing \`${environment.command_prefix} unlock\` or by leaving the room`,
    );
    await replyToMessage(message, response);
    return;
  }

  const guildManager = message.guild?.channels;
  if (!guildManager) {
    return;
  }

  await unlockChannel(guildManager, voiceChannel);
}
