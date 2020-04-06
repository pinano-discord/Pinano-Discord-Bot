const devScheme = {
  voice_channel_category: 'Practice Rooms [DEV]',
  voice_channel_name_prefix: 'Practice Room [DEV]',
};
const prodScheme = {
  voice_channel_category: 'Practice Rooms',
  voice_channel_name_prefix: 'Practice Room',
};

const schemeSettings = process.env.SCHEME === 'dev' ? devScheme : prodScheme;

export const environment = {
  token: process.env.BOT_TOKEN ?? '',
  command_prefix: process.env.COMMAND_PREFIX ?? 'p!',
  default_bitrate: process.env.BITRATE !== undefined ? parseInt(process.env.BITRATE) : 96,
  embed_color: process.env.EMBED_COLOR ?? 16752128,
  ...schemeSettings,
};
