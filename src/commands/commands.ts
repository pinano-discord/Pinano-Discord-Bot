import { ICommand } from '../listeners/commandListener';
import { help } from './help';
import { stats } from './stats';
import { lock } from './lock';
import { unlock } from './unlock';

// Add commands here
export const commands: { [key: string]: ICommand } = {
  help,
  stats,
  lock,
  unlock,
};
