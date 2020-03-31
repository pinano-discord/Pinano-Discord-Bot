import { environment } from '../environment';

const settings = require('../settings/environment.json');

const hd = require('humanize-duration');

export enum Role {
  BOT_MANAGER = 'Bot Manager',
  RECITAL_MANAGER = 'Recital Manager',
  TEMP_MUTED = 'Temp Muted',
}

export function requireRole(
  member,
  roleName: Role,
  errorMessage = 'You require the bot manager role to use this command.',
) {
  if (
    !member.roles.find((r) => r.name === roleName) ||
    !environment.pinano_guilds.includes(member.guild.id)
  ) {
    throw new Error(errorMessage);
  }
}

export function requireParameterCount(args, argCount, usageStr) {
  if (args.length !== argCount) {
    throw new Error(`Usage: \`${usageStr}\``);
  }
}

export function requireParameterFormat(arg, formatFn, usageStr) {
  if (!formatFn(arg)) {
    throw new Error(`Usage: \`${usageStr}\``);
  }
}

export async function selfDestructMessage(messageFn: () => any) {
  const m = await messageFn();
  setTimeout(() => m.delete(), environment.res_destruct_time * 1000);
}

export function abbreviateTime(playtime: number) {
  return hd(playtime * 1000, { units: ['h', 'm', 's'], round: true })
    .replace('hours', 'h')
    .replace('minutes', 'm')
    .replace('seconds', 's')
    .replace('hour', 'h')
    .replace('minute', 'm')
    .replace('second', 's');
}
