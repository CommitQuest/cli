const chalk = require('chalk');
const { CharacterService } = require('./character');

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

module.exports = refreshCommand; 