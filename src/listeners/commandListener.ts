import Discord from 'discord.js';
import { UserRepository } from '../database/userRepository';

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
    Object.keys(commands).map((command) => {
      if (message.content.toLowerCase().startsWith(`p! ${command.toLowerCase()}`)) {
        console.log(`Executing command ${command}`);
        commands[command](message, discord, userRepo);
      }
    });
  });
}
