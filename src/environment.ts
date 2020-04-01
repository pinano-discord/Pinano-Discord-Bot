export const environment = {
  token: process.env.BOT_TOKEN ?? '',
  command_prefix: process.env.COMMAND_PREFIX ?? 'p!',
  default_bitrate: process.env.BITRATE ?? 384,
  mongo_url: process.env.MONGO_URL ?? 'mongodb://user:password@localhost:27017',
  mong_db_name: process.env.MONGO_DB_NAME ?? 'db',
  embed_color: process.env.EMBED_COLOR ?? 16752128,
  voice_channel_category: process.env.VOICE_CHANNEL_CATEGORY ?? 'practice-rooms',
  voice_channel_name_prefix: process.env.VOICE_CHANNEL_NAME_PREFIX ?? 'practice-room',
};
