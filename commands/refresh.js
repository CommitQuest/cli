import chalk from 'chalk';
import { CharacterService } from './character.js';
import { handleCommandError } from './ui.js';

async function refreshCommand() {
  try {
    console.log(chalk.blue.bold('🔄 Refreshing CommitQuest Extension\n'));
    
    CharacterService.touchConfigFile();
    
    console.log(chalk.green('✅ Extension refresh triggered!'));
    console.log(chalk.gray('The VS Code extension should update automatically.'));
    console.log(chalk.gray('If it doesn\'t, try manually refreshing the extension.'));
    
  } catch (error) {
    handleCommandError(error, { label: 'Failed to refresh extension.' });
  }
}

export default refreshCommand;
