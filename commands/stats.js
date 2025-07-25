import chalk from 'chalk';
import ApiClient from '../api/client.js';

async function statsCommand(options) {
  try {
    const apiClient = new ApiClient();
    
    // Check if server is accessible
    const isServerRunning = await apiClient.healthCheck();
    if (!isServerRunning) {
      console.log(chalk.red('❌ Cannot connect to CommitQuest server!'));
      console.log(chalk.gray('Please check:'));
      console.log(chalk.gray('• Your internet connection'));
      console.log(chalk.gray('• The server is running and accessible'));
      console.log(chalk.gray('• If using a local server: cd server && npm install && npm start'));
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
    
    console.log(chalk.blue.bold('📊 CommitQuest Statistics\n'));
    console.log(chalk.gray(`👤 Logged in as: ${user.github_username}\n`));
    
    // Get user stats from server
    const serverStats = await apiClient.getUserStats();
    
    // Display server statistics
    console.log(chalk.yellow.bold('🎮 Player Statistics:\n'));
    
    console.log(chalk.cyan('Level:'), chalk.white(serverStats.level));
    console.log(chalk.cyan('Experience Gained:'), chalk.white(serverStats.experienceGained));
    console.log(chalk.cyan('Total Commits:'), chalk.white(serverStats.totalCommits));
    console.log(chalk.cyan('Current Streak:'), chalk.white(serverStats.streakCount + ' days'));
    
    // Display character info if available
    if (serverStats.character) {
      console.log(chalk.yellow('\n👤 Character Info:'));
      console.log(chalk.cyan('Name:'), chalk.white(serverStats.character.name));
      if (serverStats.character.character_combinations?.classes?.name) {
        console.log(chalk.cyan('Class:'), chalk.white(serverStats.character.character_combinations.classes.name));
      }
    }
    
    // Display achievements if available
    if (serverStats.achievements && serverStats.achievements.length > 0) {
      console.log(chalk.yellow('\n🏆 Achievements:'));
      serverStats.achievements.forEach(achievement => {
        const icon = achievement.metadata?.icon || '🏅';
        console.log(`  ${icon} ${achievement.name}: ${achievement.description}`);
      });
    } else {
      console.log(chalk.yellow('\n🏆 Achievements:'), chalk.gray('No achievements yet'));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error loading statistics:'), error.message);
    process.exit(1);
  }
}

export default statsCommand; 