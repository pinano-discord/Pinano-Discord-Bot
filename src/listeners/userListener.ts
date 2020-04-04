import Discord from 'discord.js';
import {
  cleanVoiceChannels,
  isLockedVoiceChannel,
  isPracticeVoiceChannel,
  unlockChannelAndDeleteEmptyChannels,
} from '../utils/channelUtils';

export function listenForUsers(discord: Discord.Client) {
  // eslint-disable-next-line sonarjs/cognitive-complexity
  discord.on('voiceStateUpdate', async (prevMember, newMember) => {
    if (prevMember.channelID === newMember.channelID) {
      return;
    }

    // Unlock if host leaves
    if (
      prevMember.channel &&
      isLockedVoiceChannel(prevMember.channel) &&
      prevMember.mute === false
    ) {
      await unlockChannelAndDeleteEmptyChannels(newMember.guild.channels, prevMember.channel);
    }

    // Unmute if in unlocked server
    if (newMember.channel && !isLockedVoiceChannel(newMember.channel)) {
      await newMember.setMute(false);
    }
    // Mute if in locked server
    else if (newMember.channel && isLockedVoiceChannel(newMember.channel)) {
      await newMember.setMute(true);
    }

    // Clean up empty voice channels
    if (prevMember.channel && isPracticeVoiceChannel(prevMember.channel)) {
      await cleanVoiceChannels(newMember.guild.channels, prevMember.channel);
    }
  });
}
