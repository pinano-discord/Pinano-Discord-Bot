import { environment } from '../environment';
import Discord from 'discord.js';

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

export function getPracticeCategoryVoiceChannels(channelManager: Discord.GuildChannelManager) {
  const practiceRoomCategory = getPracticeCategory(channelManager);
  if (practiceRoomCategory) {
    return channelManager.cache.filter((c) => c.parent === practiceRoomCategory);
  }
}

export async function createNewChannel(
  channelManager: Discord.GuildChannelManager,
  existingChannels: Discord.Collection<string, Discord.GuildChannel>,
) {
  const practiceRoomCategory = getPracticeCategory(channelManager);

  await channelManager.create(
    `${environment.voice_channel_name_prefix}-${existingChannels.size + 1}`,
    {
      type: 'voice',
      parent: practiceRoomCategory,
    },
  );
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

  voiceChannel.setName(`${member.user.username} 🔒`);
  await Promise.all(muteRequest);

  const unlockedChannels = getPracticeCategoryVoiceChannels(manager)?.filter(
    (c) => !isLockedVoiceChannel(c),
  );

  if (unlockedChannels && !unlockedChannels.find((c) => c.members.size === 0)) {
    await createNewChannel(manager, unlockedChannels);
  }
}

export async function unlockChannel(
  guildManager: Discord.GuildChannelManager,
  voiceChannel: Discord.VoiceChannel,
) {
  if (isLockedVoiceChannel(voiceChannel)) {
    const practiceChannels = getPracticeCategoryVoiceChannels(guildManager);
    if (practiceChannels) {
      return await voiceChannel.setName(
        `${environment.voice_channel_name_prefix}-${practiceChannels.size + 1}`,
      );
    }
  }
}

function getPracticeCategory(channelManager: Discord.GuildChannelManager) {
  return channelManager.cache.find((c) => c.name === environment.voice_channel_category);
}
