import Discord from 'discord.js';
import { UserRepository } from '../database/userRepository';
import { environment } from '../environment';

export type ICommand = (
  message: Discord.Message,
  discord: Discord.Client,
  userRepo: UserRepository,
) => void;

export function listenForCommands(
  discord: Discord.Client,
  userRepo: UserRepository,
  commands: { [key: string]: ICommand },
) {
  discord.on('message', (message) => {
    if (!message.content.toLowerCase().startsWith(environment.command_prefix)) {
      return;
    }
    Object.keys(commands).map((command) => {
      if (
        message.content
          .toLowerCase()
          .startsWith(`${environment.command_prefix} ${command.toLowerCase()}`)
      ) {
        console.log(`Executing command ${command}`);
        commands[command](message, discord, userRepo);
      }
    });
  });
}
