import Discord from 'discord.js';
import { environment } from '../environment';
import { createIterable } from './arrayUtils';

const UNLOCKED_VC_LIMIT = 5;

// The amount of identifiers is the maximum amount of channels
const UNLOCKED_VC_IDENTIFERS = [
  '🎸',
  '🎹',
  '🎤',
  '🎧',
  '🎼',
  '🥁',
  '🎷',
  '🎺',
  '🎻',
  '🥢',
  '🎊',
  '🍆',
  '🍑',
  '👽',
];

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
  const practiceCategory = getPracticeCategory(channelManager);
  if (practiceCategory) {
    return channelManager.cache.filter((c) => c.parent === practiceCategory);
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
  const updatedVoiceChannel = voiceChannel.setName(`${member.user.username} 🔒`);
  const upadatedManager = (await updatedVoiceChannel).guild.channels;

  createUnlockedVoiceChannels(upadatedManager);
}

export async function unlockChannelAndDeleteEmptyChannels(
  guildManager: Discord.GuildChannelManager,
  channel: Discord.VoiceChannel | string,
) {
  const voiceChannel =
    typeof channel === 'string' ? await getChannelFromName(guildManager, channel) : channel;

  if (voiceChannel && isLockedVoiceChannel(voiceChannel)) {
    const practiceChannels = getPracticeCategoryVoiceChannels(guildManager);
    if (practiceChannels) {
      const identifier = getNewChannelIdentifier(practiceChannels.map((c) => c.name) ?? []);
      if (!identifier) {
        return;
      }
      await voiceChannel.setName(`${environment.voice_channel_name_prefix} ${identifier}`);
    }

    const unmuteRequest = voiceChannel.members.map(async (a) => {
      await a.voice.setMute(false);
    });
    await Promise.all(unmuteRequest);
  }

  await cleanVoiceChannels(guildManager);
}

export async function initialiseCategoryAndChannels(manager: Discord.GuildChannelManager) {
  await cleanVoiceChannels(manager);

  const existingCategory = getPracticeCategory(manager);
  if (!existingCategory) {
    const category = await manager.create(environment.voice_channel_category, { type: 'category' });
    const updatedManager = category.guild.channels;
    createUnlockedVoiceChannels(updatedManager);
  } else {
    createUnlockedVoiceChannels(manager);
  }
}

function createUnlockedVoiceChannels(manager: Discord.GuildChannelManager) {
  const existingChannels = getPracticeCategoryVoiceChannels(manager);
  const unlockedChannels = existingChannels?.filter((c) => !isLockedVoiceChannel(c));

  if (!unlockedChannels) {
    return;
  }

  // Create as many channels to reach the UNLOCKED_VC_LIMIT
  // but do not create more channels than identifers
  const idsAvailableCount = UNLOCKED_VC_IDENTIFERS.length - unlockedChannels.size;
  const amountToReachUnlockedVCLimit = UNLOCKED_VC_LIMIT - unlockedChannels.size;
  const channelsToBeCreated =
    amountToReachUnlockedVCLimit > idsAvailableCount
      ? idsAvailableCount
      : amountToReachUnlockedVCLimit;
  if (channelsToBeCreated < 0) {
    return;
  }
  const channelsToBeCreatedIter = createIterable(channelsToBeCreated);
  const practiceCategory = getPracticeCategory(manager);
  const channelNames = existingChannels?.map((c) => c.name) ?? [];
  for (const _ in channelsToBeCreatedIter) {
    const identifier = getNewChannelIdentifier(channelNames);
    if (!identifier) {
      return;
    }
    const newChannelName = `${environment.voice_channel_name_prefix} ${identifier}`;
    manager.create(newChannelName, {
      type: 'voice',
      parent: practiceCategory,
      bitrate: environment.default_bitrate * 1000,
    });
    channelNames.push(newChannelName);
  }
}

export async function setChannelBitrate(
  guildManager: Discord.GuildChannelManager,
  channel: Discord.VoiceChannel | string,
  bitrate: number,
) {
  const voiceChannel =
    typeof channel === 'string' ? await getChannelFromName(guildManager, channel) : channel;

  if (voiceChannel) {
    try {
      return await voiceChannel.edit({ bitrate: bitrate });
    } catch (error) {
      throw new Error(error.toString().split('int ')[1]);
    }
  }
}

async function getChannelFromName(manager: Discord.GuildChannelManager, channelName: string) {
  const existingChannels = getPracticeCategoryVoiceChannels(manager);
  return existingChannels?.find((c) =>
    c.name.toLocaleLowerCase().includes(channelName.toLocaleLowerCase()),
  );
}

export async function cleanVoiceChannels(
  manager: Discord.GuildChannelManager,
  lastExitedChannel?: Discord.VoiceChannel,
) {
  const unlockedChannels = getPracticeCategoryVoiceChannels(manager);
  const channelsToDelete = (unlockedChannels?.size ?? 0) - UNLOCKED_VC_LIMIT;
  if (!unlockedChannels || channelsToDelete <= 0) {
    return;
  }
  const channelsToDeletIter = createIterable(channelsToDelete);
  for (const _ in channelsToDeletIter) {
    const lastChannel = unlockedChannels?.last();
    const lastExitedChannelInMap = lastExitedChannel
      ? unlockedChannels?.get(lastExitedChannel.id)
      : undefined;
    if (lastExitedChannelInMap) {
      unlockedChannels.get(lastExitedChannelInMap.id)?.delete();
      unlockedChannels.delete(lastExitedChannelInMap.id);
    } else if (lastChannel) {
      lastChannel.delete();
      unlockedChannels.delete(lastChannel.id);
    }
  }
}

function getNewChannelIdentifier(existingChannels: string[]) {
  const leftOverIdentifiers = UNLOCKED_VC_IDENTIFERS.filter(
    (n) => !existingChannels?.find((e) => e.includes(n)),
  );
  if (leftOverIdentifiers.length === 0) {
    return;
  }
  return leftOverIdentifiers[Math.floor(Math.random() * leftOverIdentifiers.length)];
}
