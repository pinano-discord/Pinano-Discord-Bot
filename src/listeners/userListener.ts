import Discord from 'discord.js';
import {
  isLockedVoiceChannel,
  unlockChannel,
  isPracticeChannel,
  getNewUnlockedChannelName,
} from '../utils/discordUtils/channels';
import { isHost } from '../utils/discordUtils/users';
import { cleanChannels } from '../utils/discordUtils/misc';
import { MAX_EMPTY_UNLOCKED_ROOMS } from '../utils/discordUtils/constants';
import {
  getPracticeCategoryVoiceChannels,
  getPracticeCategory,
} from '../utils/discordUtils/categories';
import { environment } from '../environment';

export function listenForUsers(discord: Discord.Client) {
  // eslint-disable-next-line sonarjs/cognitive-complexity
  discord.on('voiceStateUpdate', async (prevMember, newMember) => {
    if (prevMember.channelID === newMember.channelID) {
      return;
    }

    const manager = newMember.guild.channels;

    // Unlock if host leaves
    if (prevMember.channel && prevMember.member && isHost(prevMember.member, prevMember.channel)) {
      await unlockChannel(manager, prevMember.channel);
    }

    // Unmute if in unlocked server
    if (newMember.channel && !isLockedVoiceChannel(newMember.channel)) {
      await newMember.setMute(false);
    }

    // Mute if in locked server
    else if (
      newMember.channel &&
      prevMember.member &&
      isLockedVoiceChannel(newMember.channel) &&
      !isHost(prevMember.member, newMember.channel)
    ) {
      await newMember.setMute(true);
    }

    // Clean up empty voice channels
    if (prevMember.channel && isPracticeChannel(prevMember.channel)) {
      await cleanChannels(manager);
    }

    // Pad category with empty rooms
    const existingVoiceChannels = getPracticeCategoryVoiceChannels(manager);
    if (!existingVoiceChannels) {
      return;
    }
    const unlockedChannels = existingVoiceChannels?.filter((vc) => !isLockedVoiceChannel(vc));
    const emptyUnlockedChannels = unlockedChannels?.filter((vc) => vc.members.size === 0);

    if (emptyUnlockedChannels.size < MAX_EMPTY_UNLOCKED_ROOMS) {
      const practiceCategory = getPracticeCategory(manager);
      const newChannelName = getNewUnlockedChannelName(unlockedChannels.map((c) => c.name));
      if (!newChannelName) {
        return;
      }
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
  });
}
