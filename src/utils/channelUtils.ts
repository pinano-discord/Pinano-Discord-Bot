/* eslint-disable max-lines */
import Discord from 'discord.js';
import { environment } from '../environment';
import { createIterable } from './arrayUtils';

const VC_IDENTIFERS = ['🎸', '🎹', '🎤', '🎼', '🥁', '🍆', '🍑'];

const MAX_EMPTY_UNLOCKED_ROOMS = 3;

// CHANNEL HELPERS

export async function lockChannel(
  manager: Discord.GuildChannelManager,
  voiceChannel: Discord.VoiceChannel,
  member: Discord.GuildMember,
) {
  if (voiceChannel.parent?.name !== environment.channel_category) {
    return;
  }

  // Mute other users
  const otherUsers = voiceChannel.members.filter((m) => m.id !== member?.id);

  if (otherUsers) {
    const muteRequest = otherUsers.map(async (a) => {
      await a.voice.setMute(true);
    });
    await Promise.all(muteRequest);
  }

  // Update voice and text channel names
  const matchingTextChannel = getMatchingTextChannel(manager, voiceChannel.name);
  const roomName = `${member.user.username} 🔒`;
  const updatedManger = (await voiceChannel.setName(roomName)).guild.channels;

  await matchingTextChannel?.setName(roomName);

  const unlockedChannels = getPracticeCategoryVoiceChannels(updatedManger)?.filter(
    (vc) => !isLockedVoiceChannel(vc),
  );

  // Pad category with unlocked rooms
  if (unlockedChannels && unlockedChannels.size < MAX_EMPTY_UNLOCKED_ROOMS) {
    const practiceCategory = getPracticeCategory(manager);
    const identifier = getNewChannelIdentifier(unlockedChannels.map((c) => c.name));
    if (!identifier) {
      return;
    }
    const newChannelName = `${environment.channel_name_prefix}${identifier}`;
    await manager.create(newChannelName, {
      type: 'voice',
      parent: practiceCategory,
      bitrate: environment.default_bitrate * 1000,
    });
    await manager.create(newChannelName, {
      type: 'text',
      parent: practiceCategory,
      bitrate: environment.default_bitrate * 1000,
    });
  }
}

export async function unlockChannel(
  guildManager: Discord.GuildChannelManager,
  channel: Discord.VoiceChannel | string,
) {
  let updatedManager = guildManager;
  const voiceChannel =
    typeof channel === 'string' ? await getVoiceChannelFromName(updatedManager, channel) : channel;

  if (voiceChannel && isLockedVoiceChannel(voiceChannel)) {
    const matchingTextChannel = getMatchingTextChannel(updatedManager, voiceChannel.name);
    const practiceChannels = getPracticeCategoryVoiceChannels(updatedManager);
    if (practiceChannels) {
      const identifier = getNewChannelIdentifier(practiceChannels.map((c) => c.name) ?? []);
      if (!identifier) {
        return updatedManager;
      }
      const roomName = `${environment.channel_name_prefix}${identifier}`;
      const resp = await voiceChannel.setName(roomName);
      await matchingTextChannel?.setName(roomName);
      updatedManager = resp.guild.channels;
    }

    const unmuteRequest = voiceChannel.members.map(async (a) => {
      await a.voice.setMute(false);
    });
    await Promise.all(unmuteRequest);
  }
  return updatedManager;
}

export function isPracticeChannel(channel: Discord.GuildChannel) {
  if (channel?.parent?.name !== environment.channel_category) {
    return false;
  }
  if (channel?.name.startsWith(`${environment.channel_name_prefix}`)) {
    const id = channel.name.split(environment.channel_name_prefix)[1];

    if (VC_IDENTIFERS.includes(id)) {
      return true;
    }
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

async function getVoiceChannelFromName(manager: Discord.GuildChannelManager, channelName: string) {
  const existingChannels = getPracticeCategoryVoiceChannels(manager);
  return existingChannels?.find((c) =>
    c.name.toLocaleLowerCase().includes(channelName.toLocaleLowerCase()),
  );
}

function getNewChannelIdentifier(existingChannels: string[]) {
  const leftOverIdentifiers = VC_IDENTIFERS.filter(
    (n) => !existingChannels?.find((e) => e.includes(n)),
  );
  if (leftOverIdentifiers.length > 0) {
    return leftOverIdentifiers[existingChannels.length % (leftOverIdentifiers.length - 1)];
  }
}

function getMatchingTextChannel(channelManager: Discord.GuildChannelManager, roomName: string) {
  const existingTextChannels = getPracticeCategoryTextChannels(channelManager);
  return existingTextChannels?.find((tc) => tc.name === roomName.toLowerCase().replace(/\s/g, '-'));
}

// CATEGROY HELPERS
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

// INITIALISATION

export async function initialiseCategoryAndChannels(manager: Discord.GuildChannelManager) {
  let currentManager = manager;

  const existingCategory = getPracticeCategory(manager);
  if (!existingCategory) {
    const category = await manager.create(environment.channel_category, { type: 'category' });
    currentManager = category.guild.channels;
  }
  currentManager = (await setupVoiceChannels(currentManager)) ?? currentManager;
  currentManager = (await setupTextChannels(currentManager)) ?? currentManager;
}

async function setupVoiceChannels(manager: Discord.GuildChannelManager) {
  let lastManager = manager;
  const existingChannels = getPracticeCategoryVoiceChannels(lastManager);

  const deleteChannelsReq = existingChannels?.map(async (e) => await e.delete());
  if (deleteChannelsReq) {
    const responses = await Promise.all(deleteChannelsReq);
    const lastElement = responses.pop();
    if (lastElement) {
      lastManager = lastElement.guild.channels;
    }
  }

  const channelsToBeCreated = createIterable(MAX_EMPTY_UNLOCKED_ROOMS);
  const usedChannelNames = [];
  const practiceCategory = getPracticeCategory(manager);
  for (const _ in channelsToBeCreated) {
    const identifier = getNewChannelIdentifier(usedChannelNames);
    if (!identifier) {
      return;
    }
    const newChannelName = `${environment.channel_name_prefix}${identifier}`;
    lastManager = (
      await manager.create(newChannelName, {
        type: 'voice',
        parent: practiceCategory,
        bitrate: environment.default_bitrate * 1000,
      })
    ).guild.channels;
    usedChannelNames.push(newChannelName);
  }
  return lastManager;
}

async function setupTextChannels(manager: Discord.GuildChannelManager) {
  let lastManager = manager;
  const existingChannels = getPracticeCategoryTextChannels(lastManager);

  const deleteChannelsReq = existingChannels?.map(async (e) => await e.delete());
  if (deleteChannelsReq) {
    const responses = await Promise.all(deleteChannelsReq);
    const lastElement = responses.pop();
    if (lastElement) {
      lastManager = lastElement.guild.channels;
    }
  }

  const channelsToBeCreated = createIterable(MAX_EMPTY_UNLOCKED_ROOMS);
  const usedChannelNames = [];
  const practiceCategory = getPracticeCategory(manager);
  for (const _ in channelsToBeCreated) {
    const identifier = getNewChannelIdentifier(usedChannelNames);
    if (!identifier) {
      return;
    }
    const newChannelName = `${environment.channel_name_prefix}${identifier}`;
    lastManager = (
      await manager.create(newChannelName, {
        type: 'text',
        parent: practiceCategory,
        bitrate: environment.default_bitrate * 1000,
      })
    ).guild.channels;
    usedChannelNames.push(newChannelName);
  }
  return lastManager;
}

// USER HELPERS

export function isHost(user: Discord.VoiceState) {
  return user.serverMute === false;
}

// MISC

export async function setChannelBitrate(
  guildManager: Discord.GuildChannelManager,
  channel: Discord.VoiceChannel | string,
  bitrate: number,
) {
  const voiceChannel =
    typeof channel === 'string' ? await getVoiceChannelFromName(guildManager, channel) : channel;

  if (voiceChannel) {
    try {
      return await voiceChannel.edit({ bitrate: bitrate });
    } catch (error) {
      throw new Error(error.toString().split('int ')[1]);
    }
  }
}

export async function cleanChannels(manager: Discord.GuildChannelManager) {
  const existingTextChannels = getPracticeCategoryTextChannels(manager);
  const existingVoiceChannels = getPracticeCategoryVoiceChannels(manager);
  if (!existingVoiceChannels || !existingTextChannels) {
    return;
  }

  // Make sure we don't hit the limit on max empty unlocked rooms
  const emptyUnlockedChannels = existingVoiceChannels?.filter(
    (vc) => vc.members.size === 0 && !isLockedVoiceChannel(vc),
  );

  if (emptyUnlockedChannels && emptyUnlockedChannels.size >= MAX_EMPTY_UNLOCKED_ROOMS) {
    const voiceChannelsToDeletIter = createIterable(
      emptyUnlockedChannels.size - MAX_EMPTY_UNLOCKED_ROOMS,
    );
    for (const _ in voiceChannelsToDeletIter) {
      const lastVoiceChannel = emptyUnlockedChannels.last();
      if (lastVoiceChannel) {
        const matchingTextChannel = getMatchingTextChannel(manager, lastVoiceChannel.name);
        matchingTextChannel?.delete();
        lastVoiceChannel.delete();
        emptyUnlockedChannels.delete(lastVoiceChannel.id);
      }
    }
  }
}
