import chalk from 'chalk';
import ApiClient from '../api/client.js';
import { CharacterService } from './character.js';
import { handleCommandError } from './ui.js';

async function logoutCommand() {
  try {
    const apiClient = new ApiClient();
    
    try {
      const currentUser = await apiClient.verifyToken();
      
      await apiClient.logout();
      
      console.log(chalk.green('✅ Logout successful!'));
      console.log(chalk.cyan(`👋 Goodbye, ${currentUser.github_username}!`));
      console.log(chalk.gray('You can log back in anytime with `commitquest login`.'));
      
      CharacterService.touchConfigFile();
      
    } catch (error) {
      if (error.response?.status === 401) {
        console.log(chalk.yellow('ℹ️  You are not currently logged in.'));
        return;
      }
      throw error;
    }
    
  } catch (error) {
    handleCommandError(error, { label: 'Logout failed.' });
  }
}

export default logoutCommand;
