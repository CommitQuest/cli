import chalk from 'chalk';
import inquirer from 'inquirer';
import { default as open } from 'open';
import ApiClient from '../api/client.js';
import { CharacterService } from './character.js';
import { ensureServerReachable, handleCommandError } from './ui.js';

async function loginCommand() {
  try {
    const apiClient = new ApiClient();
    
    await ensureServerReachable(apiClient);

    // Check if already logged in
    try {
      const currentUser = await apiClient.verifyToken();
      console.log(chalk.yellow('ℹ️  You are already logged in!'));
      console.log(chalk.cyan(`👤 Current user: ${currentUser.github_username}`));
      console.log(chalk.gray('Use "commitquest logout" to log out first.'));
      return;
    } catch (error) {
      // Not logged in, continue with login process
    }

    console.log(chalk.blue.bold('🔐 Login to CommitQuest\n'));
    console.log(chalk.gray('This will use GitHub App device flow for authentication.\n'));

    // Start device flow
    console.log(chalk.cyan('🔄 Starting device flow...'));
    const deviceFlow = await apiClient.startDeviceFlow();
    
    if (!deviceFlow.success) {
      console.log(chalk.red('❌ Failed to start authentication.'));
      console.log(chalk.gray('  The server could not initiate the login flow. Please try again.'));
      process.exit(1);
    }

    const { user_code, verification_uri, expires_in } = deviceFlow;

    // Open browser to verification page
    console.log(chalk.cyan('\n🌐 Opening browser for verification...'));
    open(verification_uri).catch(() => {
      console.log(chalk.yellow('⚠️  Could not open browser automatically. Please visit:'));
      console.log(chalk.cyan(`  ${verification_uri}`));
    });

    console.log(chalk.gray('\n📋 Please enter the verification code below in your browser.'));

    // Display the user code
    console.log(chalk.green('\n📱 Your verification code:'));
    console.log(chalk.cyan.bold(`  ${user_code}`));
    console.log(chalk.gray(`\n⏰ This code expires in ${Math.floor(expires_in / 60)} minutes`));

    // Poll for token until successful or expired
    const tokenResult = await pollForToken(apiClient, deviceFlow.device_code, deviceFlow.interval, expires_in);
    
    if (!tokenResult.success) {
      console.log(chalk.red('❌ Authentication failed.'));
      console.log(chalk.gray('Make sure you have:'));
      console.log(chalk.gray('  • Entered the verification code correctly'));
      console.log(chalk.gray('  • Completed the authorization in your browser'));
      process.exit(1);
    }

    // Verify the token works
    try {
      const currentUser = await apiClient.verifyToken();
      console.log(chalk.green('\n✅ Login successful!'));
      console.log(chalk.cyan(`👤 Welcome, ${currentUser.github_username}!`));
      
      // Check if user has a character, if not, prompt to create one
      let character = null;
      try {
        character = await apiClient.getCharacter();
      } catch (_) {
        // Treat fetch failures (e.g. 404 for new users) as "no character"
      }
      if (!character) {
        console.log(chalk.yellow('\n🎭 You don\'t have a character yet!'));
        console.log(chalk.gray('Let\u2019s create one now!\n'));

        const speciesList = await apiClient.getSpecies();
        const classList = await apiClient.getCharacterClasses();

        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Enter your character name:',
            validate: input => input.trim().length > 0 || 'Name cannot be empty'
          },
          {
            type: 'list',
            name: 'speciesId',
            message: 'Select a species:',
            choices: speciesList.map(species => ({
              name: species.name,
              value: species.id
            }))
          },
          {
            type: 'list',
            name: 'classId',
            message: 'Select a class:',
            choices: classList.map(cls => ({
              name: cls.name,
              value: cls.id
            }))
          }
        ]);

        try {
          await apiClient.createCharacter(answers.name, answers.classId, answers.speciesId);

          console.log(chalk.green('\n✅ Character created successfully!'));
          console.log(chalk.cyan(`🧝 Name: ${answers.name}`));
          console.log(chalk.cyan(`🧬 Species: ${speciesList.find(s => s.id === answers.speciesId).name}`));
          console.log(chalk.cyan(`🛡️ Class: ${classList.find(c => c.id === answers.classId).name}`));

          CharacterService.touchConfigFile();
        } catch (charError) {
          console.log(chalk.red('❌ Failed to create character.'));
          console.log(chalk.gray(`  ${charError.message}`));
        }
      }

      
    } catch (error) {
      console.log(chalk.red('❌ Login failed. Please try again.'));
      apiClient.clearStoredToken();
      process.exit(1);
    }

    console.log(chalk.gray('\nYou can now use all CommitQuest commands.'));
    console.log('');
    
    process.nextTick(() => process.exit(0));
    
  } catch (error) {
    handleCommandError(error, { label: 'Login failed.' });
  }
}

// Helper function to poll for token with proper delays
async function pollForToken(apiClient, deviceCode, interval, expiresIn) {
  const startTime = Date.now();
  const maxWaitTime = expiresIn * 1000;
  let currentInterval = interval * 1000;
  let pollCount = 0;
  
  console.log(chalk.gray(`⏳ Polling every ${interval} seconds until authorization...`));
  
  while (Date.now() - startTime < maxWaitTime) {
    pollCount++;
    const result = await apiClient.pollForToken(deviceCode, interval);
    
    if (result.success) {
      console.log(chalk.green('\n🎉 Authorization successful!'));
      if (result.apiToken) {
        apiClient.storeToken(result.apiToken);
      }
      return result;
    }
    
    if (result.error === 'authorization_pending') {
      if (pollCount % 3 === 0) {
        process.stdout.write(chalk.gray('.'));
      }
      await sleep(currentInterval);
      continue;
    }
    
    if (result.error === 'slow_down') {
      currentInterval += 5000;
      console.log(chalk.yellow(`\n⏳ Rate limited, increasing interval to ${currentInterval/1000}s`));
      await sleep(currentInterval);
      continue;
    }
    
    if (result.error === 'expired_token') {
      return {
        success: false,
        error: 'Verification code expired - please try again'
      };
    }
    
    if (result.error === 'access_denied') {
      return {
        success: false,
        error: 'Access was denied - please try again'
      };
    }
    
    return result;
  }
  
  return {
    success: false,
    error: 'Authentication timeout - please try again'
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default loginCommand;
