#!/usr/bin/env node

import 'dotenv/config';
import { Command } from 'commander';
import chalk from 'chalk';

// Import commands
import loginCommand from './commands/login.js';
import logoutCommand from './commands/logout.js';
import characterCommand from './commands/character.js';
import dashboardCommand from './commands/dashboard.js';
import statsCommand from './commands/stats.js';
import refreshCommand from './commands/refresh.js';

const program = new Command();

// Set up the CLI
program
  .name('commitquest')
  .description('A fun CLI tool that turns Git commits into an RPG-style dashboard')
  .version('1.0.0');

// Add commands
program
  .command('login')
  .description('Login with your GitHub account')
  .action(loginCommand);

program
  .command('logout')
  .description('Logout from your account')
  .action(logoutCommand);

  // Character commands
  program
    .command('character')
    .description('Manage your character')
    .action(characterCommand)
    .addCommand(
      new Command('edit')
        .description('Edit your character')
        .action(async () => {
          try {
            const { CharacterService } = await import('./commands/character.js');
            await CharacterService.editCharacter();
          } catch (error) {
            console.error(chalk.red('❌ Character editing failed:'), error.message);
            process.exit(1);
          }
        })
    )
    .addCommand(
      new Command('list')
        .description('List available character classes')
        .action(async () => {
          try {
            const { CharacterService } = await import('./commands/character.js');
            await CharacterService.listAvailableCombinations();
          } catch (error) {
            console.error(chalk.red('❌ Failed to list character classes:'), error.message);
            process.exit(1);
          }
        })
    );

program
  .command('dashboard')
  .alias('d')
  .description('Show your RPG-style commit dashboard')
  .option('-d, --days <number>', 'Number of days to look back', '30')
  .action(dashboardCommand);

program
  .command('stats')
  .alias('s')
  .description('Show detailed commit statistics')
  .option('-d, --days <number>', 'Number of days to look back', '30')
  .action(statsCommand);

program
  .command('refresh')
  .alias('r')
  .description('Refresh the VS Code extension')
  .action(refreshCommand);

// Show welcome message if no arguments are provided
if (process.argv.length <= 2) {
  console.log(chalk.blue.bold('🏰 Welcome to CommitQuest! 🏰'));
  console.log(chalk.gray('Your Git commits become an epic adventure!\n'));
  console.log(chalk.yellow('Available commands:'));
  console.log(chalk.cyan('  commitquest login') + chalk.gray(' - Login with GitHub'));
  console.log(chalk.cyan('  commitquest logout') + chalk.gray(' - Logout from account'));
  console.log(chalk.cyan('  commitquest character') + chalk.gray(' - View your character'));
  console.log(chalk.cyan('  commitquest character edit') + chalk.gray(' - Edit your character'));
  console.log(chalk.cyan('  commitquest character list') + chalk.gray(' - List available classes'));
  console.log(chalk.cyan('  commitquest dashboard') + chalk.gray(' - Show your RPG dashboard'));
  console.log(chalk.cyan('  commitquest stats') + chalk.gray(' - Show detailed statistics'));
  console.log(chalk.cyan('  commitquest refresh') + chalk.gray(' - Refresh VS Code extension'));
  console.log(chalk.cyan('  commitquest --help') + chalk.gray(' - Show all options'));
  process.exit(0);
}

program.parse(); 