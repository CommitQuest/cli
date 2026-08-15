#!/usr/bin/env node

import 'dotenv/config';
import { createRequire } from 'module';
import { Command } from 'commander';

const require = createRequire(import.meta.url);
const pkg = require('./package.json');

// Import commands
import loginCommand from './commands/login.js';
import logoutCommand from './commands/logout.js';
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

program
  .command('dashboard', { isDefault: true })
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

program.parse();
