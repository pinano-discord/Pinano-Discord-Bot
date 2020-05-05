import Discord from 'discord.js';

export function isHost(user: Discord.VoiceState) {
  return user.serverMute === false;
}
