export const environment = {
  token: process.env.BOT_TOKEN ?? '',
  command_prefix: process.env.COMMAND_PREFIX ?? 'p!',
  default_bitrate: process.env.BITRATE !== undefined ? parseInt(process.env.BITRATE) : 96,
  embed_color: process.env.EMBED_COLOR ?? 16752128,
  voice_channel_category: process.env.VOICE_CHANNEL_CATEGORY ?? 'Practice Rooms test',
  voice_channel_name_prefix: process.env.VOICE_CHANNEL_NAME_PREFIX ?? 'Practice Room test',
};
