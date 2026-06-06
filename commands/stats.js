import chalk from 'chalk';
import ApiClient from '../api/client.js';
import { requireAuth, handleCommandError, formatLevelProgressBar } from './ui.js';

async function statsCommand(options) {
  try {
    const apiClient = new ApiClient();
    await requireAuth(apiClient);
    
    console.log(chalk.blue.bold('📊 CommitQuest Statistics\n'));
    
    // Get user stats from server
    const serverStats = await apiClient.getUserStats();

    // Display server statistics
    console.log(chalk.yellow.bold('Statistics:\n'));

    const levelProgressBar = formatLevelProgressBar(serverStats.levelProgress);
    if (levelProgressBar) {
      console.log(chalk.cyan('Level Progress:'));
      console.log(chalk.white(levelProgressBar));
    } else {
      console.log(chalk.cyan('Level:'), chalk.white(serverStats.level));
    }
    console.log(chalk.cyan('Experience Gained:'), chalk.white(serverStats.experienceGained));
    console.log(chalk.cyan('Total Commits:'), chalk.white(serverStats.totalCommits));
    console.log(chalk.cyan('Current Streak:'), chalk.white(serverStats.streakCount + ' days'));

  } catch (error) {
    handleCommandError(error, { label: 'Error loading statistics.' });
  }
}

export default statsCommand;
