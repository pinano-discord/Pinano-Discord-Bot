import { ICommand } from '../listeners/commandListener';
import { help } from './help';
import { stats } from './stats';

// Add commands here
export const commands: { [key: string]: ICommand } = {
  help,
  stats,
};
