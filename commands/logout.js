import chalk from 'chalk';
import ApiClient from '../api/client.js';
import { CharacterService } from './character.js';

async function logoutCommand() {
  try {
    const apiClient = new ApiClient();
    
    // Check if logged in
    try {
      const currentUser = await apiClient.verifyToken();
      
      // Logout from server
      await apiClient.logout();
      
      console.log(chalk.green('✅ Logout successful!'));
      console.log(chalk.cyan(`👋 Goodbye, ${currentUser.github_username}!`));
      console.log(chalk.gray('You can log back in anytime with `commitquest login`.'));
      
      // Trigger extension refresh to clear the avatar
      CharacterService.touchConfigFile();
      
    } catch (error) {
      if (error.response?.status === 401) {
        console.log(chalk.yellow('ℹ️  You are not currently logged in.'));
        return;
      }
      throw error;
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Logout failed:'), error.message);
    process.exit(1);
  }
}

export default logoutCommand; 