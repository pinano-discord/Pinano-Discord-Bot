import Discord from 'discord.js';
import { UserRepository } from '../database/userRepository';
import {
  isPracticeVoiceChannel,
  isLockedVoiceChannel,
  unlockChannel,
  getPracticeCategoryVoiceChannels,
} from '../utils/channelUtils';

export function listenForUsers(discord: Discord.Client, userRepo: UserRepository) {
  // eslint-disable-next-line sonarjs/cognitive-complexity
  discord.on('voiceStateUpdate', async (prevMember, newMember) => {
    // User repo management
    decideToAddUserToUserRepo(newMember, userRepo);

    if (prevMember.channelID === newMember.channelID) {
      return;
    }

    // Clean up empty voice channels
    if (prevMember.channel && isPracticeVoiceChannel(prevMember.channel)) {
      await cleanVoiceChannel(prevMember.channel);
    }

    // Unlock if host leaves
    if (
      prevMember.channel &&
      isLockedVoiceChannel(prevMember.channel) &&
      prevMember.mute === false
    ) {
      await unlockChannel(newMember.guild.channels, prevMember.channel);
    }

    // Unmute if in unlocked server
    if (newMember.channel && !isLockedVoiceChannel(newMember.channel)) {
      await newMember.setMute(false);
    }

    // Mmute if in locked server
    if (newMember.channel && isLockedVoiceChannel(newMember.channel)) {
      await newMember.setMute(true);
    }
  });
}

async function cleanVoiceChannel(channel: Discord.VoiceChannel) {
  const existingUnlockedChannels = getPracticeCategoryVoiceChannels(channel.guild.channels)?.filter(
    (c) => !isLockedVoiceChannel(c),
  );
  if (!existingUnlockedChannels) {
    return;
  }
  if (existingUnlockedChannels.size > 1 && channel.members.size === 0) {
    await channel.delete();
  }
}

async function decideToAddUserToUserRepo(member: Discord.VoiceState, userRepo: UserRepository) {
  if (!(await userRepo.findByField('id', member.id))) {
    userRepo.create({
      id: member.id,
      current_session_playtime: 0,
      overall_session_playtime: 0,
    });
  }
}
