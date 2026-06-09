import chalk from 'chalk';
import ApiClient from '../api/client.js';
import { CharacterService } from './character.js';
import { requireAuth, handleCommandError, formatLevelProgressBar } from './ui.js';

async function dashboardCommand(options) {
  try {
    const apiClient = new ApiClient();
    const user = await requireAuth(apiClient);
    
    // Display character info
    const character = await CharacterService.displayCharacter(user.id);
    if (character) {
      console.log(chalk.gray('─'.repeat(50) + '\n'));
    }
    
    // Get user stats from server
    const serverStats = await apiClient.getUserStats();

    // Check for achievements
    const achievementResult = await apiClient.getUserAchievements();
    
    // Display the dashboard
    displayDashboard(serverStats, achievementResult|| []);
    
  } catch (error) {
    handleCommandError(error, { label: 'Error loading dashboard.' });
  }
}

function displayDashboard(serverStats, achievements) {
  console.log(chalk.blue.bold('🏰 CommitQuest Dashboard\n'));
  
  // Player stats section
  console.log(chalk.yellow.bold('⚔️  Player Stats:'));
  const levelProgressBar = formatLevelProgressBar(serverStats.levelProgress);
  if (levelProgressBar) {
    console.log(chalk.cyan('  Level Progress:'));
    console.log(chalk.white(levelProgressBar.split('\n').map(line => `  ${line}`).join('\n')));
  } else {
    console.log(chalk.cyan('  Level:'), chalk.white(serverStats.level));
  }
  console.log(chalk.cyan('  Experience:'), chalk.white(serverStats.experienceGained + ' XP'));
  console.log(chalk.cyan('  Commits:'), chalk.white(serverStats.totalCommits));
  console.log(chalk.cyan('  Streak:'), chalk.white(serverStats.streakCount + ' days'));
  
  // Character info if available
  if (serverStats.character) {
    console.log(chalk.yellow.bold('\n👤 Character:'));
    console.log(chalk.cyan('  Name:'), chalk.white(serverStats.character.name));
    if (serverStats.character.classes?.name) {
      console.log(chalk.cyan('  Class:'), chalk.white(serverStats.character.classes.name));
    }
  }
  
  // Achievements section
  if (achievements.length > 0) {
    console.log(chalk.yellow.bold('\n🏆 Recent Achievements:'));
    achievements.slice(0, 3).forEach(achievement => {
      const icon = achievement.metadata?.icon || '🏆';
      console.log(chalk.green(`  ${icon} ${achievement.name}`));
    });
  }
  
  console.log(chalk.gray('\nUse "commitquest stats" for detailed statistics'));
}

export default dashboardCommand;
