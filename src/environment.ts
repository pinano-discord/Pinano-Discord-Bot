const devScheme = {
  channel_category: 'Practice Rooms Dev',
  channel_name_prefix: 'Practice Room Dev',
};
const prodScheme = {
  channel_category: 'Practice Rooms',
  channel_name_prefix: 'Practice Room',
};

const schemeSettings = process.env.SCHEME === 'dev' ? devScheme : prodScheme;

export const environment = {
  token: process.env.BOT_TOKEN ?? '',
  command_prefix: process.env.COMMAND_PREFIX ?? 'p!',
  default_bitrate: process.env.BITRATE !== undefined ? parseInt(process.env.BITRATE) : 96,
  embed_color: process.env.EMBED_COLOR ?? 16752128,
  ...schemeSettings,
};
