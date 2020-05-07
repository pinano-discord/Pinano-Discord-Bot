import Discord from 'discord.js';
import {
  getPracticeCategory,
  getPracticeCategoryVoiceChannels,
  getPracticeCategoryTextChannels,
} from './categories';
import { environment } from '../../environment';
import { createIterable } from '../arrayUtils';
import { MAX_EMPTY_UNLOCKED_ROOMS } from './constants';
import { getNewUnlockedChannelName } from './channels';

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
    const newChannelName = getNewUnlockedChannelName(usedChannelNames);
    if (!newChannelName) {
      return;
    }
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
    const newChannelName = getNewUnlockedChannelName(usedChannelNames);
    if (!newChannelName) {
      return;
    }
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
