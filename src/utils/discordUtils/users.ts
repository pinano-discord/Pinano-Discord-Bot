import Discord from 'discord.js';
import { getLockedChannelName } from './channels';

export function isHost(user: Discord.GuildMember, channel: Discord.VoiceChannel) {
  const expectedChannelName = getLockedChannelName(user);
  return expectedChannelName === channel.name;
}
