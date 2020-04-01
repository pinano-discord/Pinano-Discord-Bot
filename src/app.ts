import Discord from 'discord.js';
import { connect } from './database/repository';
import { UserRepository } from './database/userRepository';
import { environment } from './environment';
import { listenForUsers } from './listeners/userListener';
import { listenForCommands } from './listeners/commandListener';
import { commands } from './commands/commands';

async function init() {
  const discord = new Discord.Client({ fetchAllMembers: true });
  const database = await connect(environment.mongo_url, environment.mong_db_name);
  const userRepo = new UserRepository(database);

  listenForCommands(discord, userRepo, commands);
  listenForUsers(discord, userRepo);

  try {
    await discord.login(environment.token);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
}

init();
