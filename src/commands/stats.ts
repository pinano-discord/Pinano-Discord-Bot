import Discord from 'discord.js';
import { UserRepository } from '../database/userRepository';

export async function stats(
  message: Discord.Message,
  discord: Discord.Client,
  userRepo: UserRepository,
) {
  // TODO: user arg
  if (!message.member?.id) {
    return;
  }

  const user =
    (await userRepo.findByField('id', message.member.id)) ??
    (await userRepo.create({
      id: message.member.id,
      current_session_playtime: 0,
      overall_session_playtime: 0,
    }));

  const response = new Discord.MessageEmbed()
    .setTitle('Stats')
    .addField('Current Session Playtime', user?.current_session_playtime)
    .addField('Overall Session Playtime', user?.overall_session_playtime);

  message.author.send(response);
}
