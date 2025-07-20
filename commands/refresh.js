import chalk from 'chalk';
import { CharacterService } from './character.js';

async function refreshCommand() {
  try {
    console.log(chalk.blue.bold('🔄 Refreshing CommitQuest Extension\n'));
    
    // Touch the config file to trigger extension refresh
    CharacterService.touchConfigFile();
    
    console.log(chalk.green('✅ Extension refresh triggered!'));
    console.log(chalk.gray('The VS Code extension should update automatically.'));
    console.log(chalk.gray('If it doesn\'t, try manually refreshing the extension.'));
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to refresh extension:'), error.message);
  }
}

export default refreshCommand; 