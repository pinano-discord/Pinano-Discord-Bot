import { Role } from './helpers';
import { environment } from '../environment';

const { requireRole } = require('./helpers');

async function restart(client, message) {
  requireRole(message.member, Role.BOT_MANAGER);
  await message.delete(); // we're not going to get a chance anywhere else
  await client.restart(message.guild, false);

  throw new Error('Something that should never happen has happened.');
}

async function pinanoEval(client, message) {
  if (!environment.bot_devs.includes(message.author.id)) {
    message
      .reply('You must be a developer to use this.')
      .catch((e) => client.cannon.fire('Error sending message.'));
    return;
  }
  const args = message.content.split(' ').slice(1);
  const clean = (text) => {
    if (typeof text === 'string') {
      return text
        .replace(/`/g, '`' + String.fromCharCode(8203))
        .replace(/@/g, '@' + String.fromCharCode(8203));
    } else {
      return text;
    }
  };

  try {
    const code = args.join(' ');
    let evaled = eval(code); // eslint-disable-line no-eval
    if (typeof evaled !== 'string') {
      evaled = require('util').inspect(evaled);
    }
    message.channel.send(clean(evaled), { code: 'xl' });
  } catch (err) {
    message.channel.send(`\`ERROR\` \`\`\`xl\n${clean(err)}\n\`\`\``);
  }
}

module.exports = { restart, pinanoEval };
