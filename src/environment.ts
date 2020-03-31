export const environment = {
  dev_mode: process.env.DEV_MODE ?? true,
  prefix: process.env.BOT_PREFIX ?? 'p!',
  token: process.env.BOT_TOKEN ?? '',
  default_bitrate: process.env.BOT_BITRATE ?? 384,
  embed_color: 16752128,
  activity: 'type: p!help',
  bot_devs: ['174511937151827969', '187548138456743936'],
  contributors: [
    '447963949195984896',
    '256610306363490305',
    '174511937151827969',
    '187548138456743936',
    '223340518619217920',
  ],
  pinano_guilds: ['188345759408717825', '523774045439655956'],
  chat_channel: 'practice-room-chat',

  default_welcome: 'Welcome {user} to the server!',
  default_leave: 'Goodbye {user}!',

  leaderboard_size: 10,
  res_destruct_time: 30,
  req_destruct_time: 3,
  minimum_rooms: 4,
};
