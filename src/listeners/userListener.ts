import Discord from 'discord.js';
import { notEmpty } from '../utils/arrayUtils';
import { environment } from '../environment';
import { UserRepository } from '../database/userRepository';

export function listenForUsers(discord: Discord.Client, userRepo: UserRepository) {
  discord.on('voiceStateUpdate', async (prevMember, newMember) => {
    // User repo management
    decideToAddUserToUserRepo(newMember, userRepo);

    // Channel creation and deletion
    if (
      prevMember.channelID !== newMember.channelID &&
      newMember.channel?.parent?.name.toLowerCase() === environment.voice_channel_category &&
      newMember.channel?.name.toLowerCase().startsWith(environment.voice_channel_name_prefix)
    ) {
      await decideToCreateVoiceChannel(newMember);
    } else {
      await cleanVoiceChannels(newMember);
    }
  });
}

async function cleanVoiceChannels(member: Discord.VoiceState) {
  const channelsToDelete = member.guild.channels.cache
    .map((c) => {
      if (
        c.type === 'voice' &&
        c.name.toLowerCase().startsWith(environment.voice_channel_name_prefix) &&
        c.members.size === 0 &&
        !c.name.endsWith('1')
      ) {
        return c;
      }
    })
    .filter(notEmpty);

  const deleteRequests = channelsToDelete.map(async (c) => await c.delete());
  await Promise.all(deleteRequests);
}

async function decideToCreateVoiceChannel(member: Discord.VoiceState) {
  const existingChannels = member.guild.channels.cache
    .map((c) => {
      if (
        c.type === 'voice' &&
        c.name.toLowerCase().startsWith(environment.voice_channel_name_prefix)
      ) {
        return c;
      }
    })
    .filter(notEmpty);

  if (!existingChannels.find((c) => c.members.size === 0)) {
    const practiceRoomCategory = member.guild.channels.cache.find(
      (c) => c.name.toLowerCase() === environment.voice_channel_category,
    );
    await member.guild.channels.create(
      `${environment.voice_channel_name_prefix}-${existingChannels.length + 1}`,
      {
        type: 'voice',
        parent: practiceRoomCategory,
      },
    );
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
