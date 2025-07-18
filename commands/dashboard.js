const chalk = require('chalk');
const ApiClient = require('../api/client');
const { CharacterService } = require('./character');

async function dashboardCommand(options) {
  try {
    const apiClient = new ApiClient();
    
    // Check if server is running
    const isServerRunning = await apiClient.healthCheck();
    if (!isServerRunning) {
      console.log(chalk.red('❌ CommitQuest server is not running!'));
      console.log(chalk.gray('Please start the server first:'));
      console.log(chalk.cyan('  cd server && npm install && npm start'));
      process.exit(1);
    }

    // Verify authentication
    let user;
    try {
      user = await apiClient.verifyToken();
    } catch (error) {
      console.log(chalk.red('❌ Authentication required!'));
      console.log(chalk.yellow('Please log in first with:'));
      console.log(chalk.cyan('  commitquest login'));
      console.log(chalk.gray('\nThis will open your browser to authorize with GitHub.'));
      process.exit(1);
    }
    
    console.log(chalk.blue.bold('🏰 Loading your CommitQuest Dashboard...\n'));
    console.log(chalk.gray(`👤 Logged in as: ${user.github_username}\n`));
    
    // Display character info
    const character = await CharacterService.displayCharacter(user.id);
    if (character) {
      console.log(chalk.gray('─'.repeat(50) + '\n'));
    }
    
    // Get user stats from server
    const serverStats = await apiClient.getUserStats();
    
    // Check for achievements
    const achievementResult = await apiClient.getUserAchievements();
    
    // Show notification for newly unlocked achievements
    if (achievementResult.totalNewlyUnlocked > 0) {
      console.log(chalk.green(`\n🎉 Congratulations! You've unlocked ${achievementResult.totalNewlyUnlocked} new achievement(s)!`));
      achievementResult.newlyUnlocked.forEach(achievement => {
        const icon = achievement.metadata?.icon || '🏆';
        console.log(chalk.yellow(`  ${icon} ${achievement.achievement_name} - ${achievement.description}`));
      });
      console.log('');
    }
    
    // Display the dashboard
    displayDashboard(serverStats, achievementResult.recentAchievements || []);
    
  } catch (error) {
    console.error(chalk.red('❌ Error loading dashboard:'), error.message);
    process.exit(1);
  }
}

function displayDashboard(serverStats, achievements) {
  console.log(chalk.blue.bold('🏰 CommitQuest Dashboard\n'));
  
  // Player stats section
  console.log(chalk.yellow.bold('⚔️  Player Stats:'));
  console.log(chalk.cyan('  Level:'), chalk.white(serverStats.level));
  console.log(chalk.cyan('  Experience:'), chalk.white(serverStats.experienceGained + ' XP'));
  console.log(chalk.cyan('  Commits:'), chalk.white(serverStats.totalCommits));
  console.log(chalk.cyan('  Streak:'), chalk.white(serverStats.streakCount + ' days'));
  
  // Character info if available
  if (serverStats.character) {
    console.log(chalk.yellow.bold('\n👤 Character:'));
    console.log(chalk.cyan('  Name:'), chalk.white(serverStats.character.name));
    if (serverStats.character.character_combinations?.classes?.name) {
      console.log(chalk.cyan('  Class:'), chalk.white(serverStats.character.character_combinations.classes.name));
    }
  }
  
  // Achievements section
  if (achievements.length > 0) {
    console.log(chalk.yellow.bold('\n🏆 Recent Achievements:'));
    achievements.forEach(achievement => {
      const icon = achievement.metadata?.icon || '🏆';
      console.log(chalk.green(`  ${icon} ${achievement.achievement_name}`));
    });
  }
  
  console.log(chalk.gray('\nUse "commitquest stats" for detailed statistics'));
}

module.exports = dashboardCommand; 