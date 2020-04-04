import { ICommand } from '../listeners/commandListener';
import { help } from './help';
import { lock } from './lock';
import { unlock } from './unlock';
import { setup } from './setup';
import { bitrate } from './bitrate';

// Add commands here
export const commands: { [key: string]: ICommand } = {
  help,
  lock,
  unlock,
  setup,
  bitrate,
};
