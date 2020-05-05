import Discord from 'discord.js';
import { getPracticeCategoryVoiceChannels } from './categories';
import { getMatchingTextChannel, isLockedVoiceChannel } from './channels';
import { MAX_EMPTY_UNLOCKED_ROOMS } from './constants';
import { createIterable } from '../arrayUtils';

// eslint-disable-next-line sonarjs/cognitive-complexity
export async function cleanChannels(manager: Discord.GuildChannelManager) {
  const existingVoiceChannels = getPracticeCategoryVoiceChannels(manager);
  if (!existingVoiceChannels) {
    return;
  }

  // Make sure we don't hit the limit on max empty unlocked rooms
  const emptyUnlockedChannels = existingVoiceChannels?.filter(
    (vc) => vc.members.size === 0 && !isLockedVoiceChannel(vc),
  );

  if (emptyUnlockedChannels.size >= MAX_EMPTY_UNLOCKED_ROOMS) {
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
