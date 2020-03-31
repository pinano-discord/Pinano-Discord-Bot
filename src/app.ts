import { environment } from './environment';

import * as Discord from 'discord.js';
const cron = require('node-cron');
const { connect, makeUser } = require('./library/persistence');

const discordClient = new Discord.Client({ fetchAllMembers: true });

require('./library/client_functions.js')(discordClient);
discordClient.log('Loaded client functions');

require('./library/client_events.js')(discordClient);
discordClient.log('Loaded client events');

discordClient.commands = require('./commands');
discordClient.log('Successfully loaded commands');

// weekly wipe at midnight on Monday (local time zone)
cron.schedule('0 0 * * mon', async () => {
  await discordClient.submitWeek();
  await discordClient.userRepository.resetSessionTimes();
  discordClient.log('Cleared weekly results');
});

connect('mongodb://localhost:27017/', 'user').then((mongoManager) => {
  discordClient.log('Connected to database');

  discordClient.userRepository = mongoManager.newUserRepository();
  discordClient.makeUser = makeUser;
  discordClient.login(environment.token).catch((error) => {
    discordClient.log(error);
    process.exit(1);
  });
});
