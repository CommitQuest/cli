import chalk from 'chalk';
import inquirer from 'inquirer';
import { default as open } from 'open';
import ApiClient from '../api/client.js';

// Import CharacterService from character command
import { CharacterService } from './character.js';

async function loginCommand() {
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
      console.error(chalk.red('❌ Failed to start device flow:'), deviceFlow.error);
      process.exit(1);
    }

    const { user_code, verification_uri, expires_in } = deviceFlow;

    // Display the user code
    console.log(chalk.green('\n📱 Your verification code:'));
    console.log(chalk.cyan.bold(`  ${user_code}`));
    console.log(chalk.gray(`\n⏰ This code expires in ${Math.floor(expires_in / 60)} minutes`));
    
    // Open browser to verification page
    console.log(chalk.cyan('\n🌐 Opening browser for verification...'));
    open(verification_uri).catch(err => {
      console.log(chalk.yellow('⚠️  Could not open browser automatically. Please visit:'));
      console.log(chalk.cyan(verification_uri));
    });

    console.log(chalk.gray('\n📋 Please enter the verification code above in your browser.'));
    console.log(chalk.gray('Waiting for authorization...\n'));

    // Poll for token until successful or expired
    const tokenResult = await pollForToken(apiClient, deviceFlow.device_code, deviceFlow.interval, expires_in);
    
    if (!tokenResult.success) {
      console.error(chalk.red('❌ Authentication failed:'), tokenResult.error);
      console.log(chalk.gray('\nMake sure you have:'));
      console.log(chalk.gray('• Entered the verification code correctly'));
      console.log(chalk.gray('• Completed the authorization in your browser'));
      console.log(chalk.gray('• The CommitQuest server is running'));
      process.exit(1);
    }

    // Verify the token works
    try {
      const currentUser = await apiClient.verifyToken();
      console.log(chalk.green('\n✅ Login successful!'));
      console.log(chalk.cyan(`👤 Welcome, ${currentUser.github_username}!`));
      
     // Check if user has a character, if not, prompt to create one
      const character = await apiClient.getCharacter();
      if (!character) {
        console.log(chalk.yellow('\n🎭 You don\'t have a character yet!'));
        console.log(chalk.gray('Let’s create one now!\n'));

        // Fetch species and class options
        const speciesList = await apiClient.getSpecies();
        const classList = await apiClient.getCharacterClasses();

        // Prompt user for character name, species, and class
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
          const newChar = await apiClient.createCharacter(answers.name, answers.classId, answers.speciesId);

          console.log(chalk.green('\n✅ Character created successfully!'));
          console.log(chalk.cyan(`🧝 Name: ${answers.name}`));
          console.log(chalk.cyan(`🧬 Species: ${speciesList.find(s => s.id === answers.speciesId).name}`));
          console.log(chalk.cyan(`🛡️ Class: ${classList.find(c => c.id === answers.classId).name}`));

          CharacterService.touchConfigFile();
        } catch (charError) {
          console.log(chalk.red('❌ Failed to create character:'), charError.message);
        }
      }

      
    } catch (error) {
      console.error(chalk.red('❌ Login failed. Please try again.'));
      apiClient.clearStoredToken();
      process.exit(1);
    }

    console.log(chalk.gray('\nYou can now use all CommitQuest commands.'));
    console.log(''); // Force a new line
    
    // Exit after current event loop iteration
    process.nextTick(() => process.exit(0));
    
  } catch (error) {
    console.error(chalk.red('❌ Login failed:'), error.message);
    console.log(chalk.gray('\nMake sure you have:'));
    console.log(chalk.gray('• The CommitQuest server running'));
    console.log(chalk.gray('• A valid GitHub account'));
    console.log(chalk.gray('• Proper internet connection'));
    
    process.exit(1);
  }
}

// Helper function to poll for token with proper delays
async function pollForToken(apiClient, deviceCode, interval, expiresIn) {
  const startTime = Date.now();
  const maxWaitTime = expiresIn * 1000; // Convert to milliseconds
  let currentInterval = interval * 1000; // Convert to milliseconds
  let pollCount = 0;
  
  console.log(chalk.gray(`⏳ Polling every ${interval} seconds until authorization...`));
  
  while (Date.now() - startTime < maxWaitTime) {
    pollCount++;
    const result = await apiClient.pollForToken(deviceCode, interval);
    
    if (result.success) {
      console.log(chalk.green('\n🎉 Authorization successful!'));
      // Store the token when successful
      if (result.apiToken) {
        apiClient.storeToken(result.apiToken);
      }
      return result;
    }
    
    // Handle different error types according to GitHub's specification
    if (result.error === 'authorization_pending') {
      // Show progress indicator
      if (pollCount % 3 === 0) {
        process.stdout.write(chalk.gray('.'));
      }
      await sleep(currentInterval);
      continue;
    }
    
    if (result.error === 'slow_down') {
      // Increase interval by 5 seconds as per GitHub spec
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
    
    // For other errors, return the error
    return result;
  }
  
  // Timeout
  return {
    success: false,
    error: 'Authentication timeout - please try again'
  };
}

// Helper function to sleep
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default loginCommand; 