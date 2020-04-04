import { environment } from '../environment';
import Discord from 'discord.js';
import crypto from 'crypto';

export function isPracticeVoiceChannel(channel: Discord.VoiceChannel) {
  if (channel?.parent?.name !== environment.voice_channel_category) {
    return false;
  }
  if (channel?.name.startsWith(environment.voice_channel_name_prefix)) {
    return true;
  }
  if (channel?.name.endsWith(' 🔒')) {
    return true;
  }
  return false;
}

export function isLockedVoiceChannel(channel: Discord.VoiceChannel | Discord.GuildChannel) {
  if (channel.name.endsWith(' 🔒')) {
    return true;
  }
  return false;
}

export function getPracticeCategory(channelManager: Discord.GuildChannelManager) {
  return channelManager.cache.find((c) => c.name === environment.voice_channel_category);
}

export function getPracticeCategoryVoiceChannels(channelManager: Discord.GuildChannelManager) {
  const practiceRoomCategory = getPracticeCategory(channelManager);
  if (practiceRoomCategory) {
    return channelManager.cache.filter((c) => c.parent === practiceRoomCategory);
  }
}

export async function lockChannelAndCreateNewChannel(
  manager: Discord.GuildChannelManager,
  voiceChannel: Discord.VoiceChannel,
  member: Discord.GuildMember,
) {
  const otherUsers = voiceChannel.members.filter((m) => m.id !== member?.id);

  if (!otherUsers) {
    return;
  }

  const muteRequest = otherUsers.map(async (a) => {
    await a.voice.setMute(true);
  });
  await Promise.all(muteRequest);
  voiceChannel.setName(`${member.user.username} 🔒`);

  await createNewChannel(manager);
}

export async function unlockChannel(
  guildManager: Discord.GuildChannelManager,
  voiceChannel: Discord.VoiceChannel,
) {
  if (isLockedVoiceChannel(voiceChannel)) {
    const practiceChannels = getPracticeCategoryVoiceChannels(guildManager);
    if (practiceChannels) {
      const identifier = getNewChannelIdentifier(practiceChannels);
      await voiceChannel.setName(`${environment.voice_channel_name_prefix}-${identifier}`);
    }

    const unmuteRequest = voiceChannel.members.map(async (a) => {
      await a.voice.setMute(false);
    });
    await Promise.all(unmuteRequest);
  }
}

export async function initialiseCategoryAndChannels(manager: Discord.GuildChannelManager) {
  const existingCategory = getPracticeCategory(manager);
  if (!existingCategory) {
    await manager.create(environment.voice_channel_category, { type: 'category' });
  }

  const existingVoiceChannels = getPracticeCategoryVoiceChannels(manager);
  if (!existingVoiceChannels || existingVoiceChannels.size === 0) {
    createNewChannel(manager);
  }
}

async function createNewChannel(manager: Discord.GuildChannelManager) {
  const existingChannels = getPracticeCategoryVoiceChannels(manager);
  const unlockedChannels = existingChannels?.filter((c) => !isLockedVoiceChannel(c));

  const practiceRoomCategory = getPracticeCategory(manager);
  if (unlockedChannels && !unlockedChannels.find((c) => c.members.size === 0)) {
    const identifier = getNewChannelIdentifier(existingChannels);
    await manager.create(`${environment.voice_channel_name_prefix}-${identifier}`, {
      type: 'voice',
      parent: practiceRoomCategory,
    });
  }
}

function getNewChannelIdentifier(
  existingChannels?: Discord.Collection<string, Discord.GuildChannel>,
) {
  const salt = existingChannels ? JSON.stringify(existingChannels) : Math.random().toString();
  const hash = crypto.createHash('sha256').update(salt);
  return hash.digest('hex').substring(0, 7);
}
