import Discord from 'discord.js';
import {
  isLockedVoiceChannel,
  unlockChannel,
  isPracticeChannel,
} from '../utils/discordUtils/channels';
import { isHost } from '../utils/discordUtils/users';
import { cleanChannels } from '../utils/discordUtils/misc';

export function listenForUsers(discord: Discord.Client) {
  // eslint-disable-next-line sonarjs/cognitive-complexity
  discord.on('voiceStateUpdate', async (prevMember, newMember) => {
    if (prevMember.channelID === newMember.channelID) {
      return;
    }

    // Unlock if host leaves
    if (prevMember.channel && isLockedVoiceChannel(prevMember.channel) && isHost(prevMember)) {
      await unlockChannel(newMember.guild.channels, prevMember.channel);
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
    if (prevMember.channel && isPracticeChannel(prevMember.channel)) {
      await cleanChannels(newMember.guild.channels);
    }
  });
}
