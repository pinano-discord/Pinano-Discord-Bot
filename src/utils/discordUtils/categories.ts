import Discord from 'discord.js';
import { environment } from '../../environment';

export function getPracticeCategory(channelManager: Discord.GuildChannelManager) {
  return channelManager.cache.find((c) => c.name === environment.channel_category);
}

export function getPracticeCategoryVoiceChannels(channelManager: Discord.GuildChannelManager) {
  const practiceCategory = getPracticeCategory(channelManager);
  if (practiceCategory) {
    return channelManager.cache.filter((c) => c.parent === practiceCategory && c.type === 'voice');
  }
}

export function getPracticeCategoryTextChannels(channelManager: Discord.GuildChannelManager) {
  const practiceCategory = getPracticeCategory(channelManager);
  if (practiceCategory) {
    return channelManager.cache.filter((c) => c.parent === practiceCategory && c.type === 'text');
  }
}
