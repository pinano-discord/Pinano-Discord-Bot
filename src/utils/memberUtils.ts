import Discord from 'discord.js';

export function isAdmin(member: Discord.GuildMember) {
  return member.hasPermission('ADMINISTRATOR');
}

export async function replyToMessage(message: Discord.Message, reply: Discord.MessageEmbed) {
  return await message.member?.lastMessage?.channel.send(reply);
}
