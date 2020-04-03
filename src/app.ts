import Discord from 'discord.js';
import { environment } from './environment';
import { listenForUsers } from './listeners/userListener';
import { listenForCommands } from './listeners/commandListener';
import { commands } from './commands/commands';

async function init() {
  const discord = new Discord.Client({ fetchAllMembers: true });

  listenForCommands(discord, commands);
  listenForUsers(discord);

  try {
    await discord.login(environment.token);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
}

init();
