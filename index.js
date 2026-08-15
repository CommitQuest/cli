#!/usr/bin/env node

import 'dotenv/config';
import { createRequire } from 'module';
import { Command } from 'commander';

const require = createRequire(import.meta.url);
const pkg = require('./package.json');

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
  .version(pkg.version);

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
            const { handleCommandError } = await import('./commands/ui.js');
            handleCommandError(error, { label: 'Character editing failed.' });
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
            const { handleCommandError } = await import('./commands/ui.js');
            handleCommandError(error, { label: 'Failed to list character classes.' });
          }
        })
    );

program
  .command('dashboard')
  .alias('d')
  .description('Show your RPG-style commit dashboard')
  .action(dashboardCommand);

program
  .command('stats')
  .alias('s')
  .description('Show detailed commit statistics')
  .action(statsCommand);

program
  .command('refresh')
  .alias('r')
  .description('Refresh the VS Code extension')
  .action(refreshCommand);

// Show welcome message if no arguments are provided
if (process.argv.length <= 2) {
  const { banner, box, commandHint, divider, sparkleLine, infoHint, palette } = await import(
    './commands/theme.js'
  );
  console.log('');
  console.log(banner('Your Git commits become an epic adventure'));
  console.log('');
  console.log(sparkleLine('Choose your next quest'));
  console.log('');
  const cmds = [
    commandHint('commitquest login', 'Login with GitHub'),
    commandHint('commitquest logout', 'Logout from account'),
    commandHint('commitquest character', 'View your character'),
    commandHint('commitquest character edit', 'Edit your character'),
    commandHint('commitquest character list', 'List available classes'),
    commandHint('commitquest dashboard', 'Show your RPG dashboard'),
    commandHint('commitquest stats', 'Show detailed statistics'),
    commandHint('commitquest refresh', 'Refresh VS Code extension'),
    commandHint('commitquest --help', 'Show all options'),
  ];
  console.log(box(cmds, { title: 'Commands', width: 56, style: 'double', color: 'gold' }));
  console.log('');
  console.log(divider(56, 'ornate'));
  console.log(infoHint(palette.mist('Begin with: commitquest login')));
  console.log('');
  process.exit(0);
}

program.parse();
