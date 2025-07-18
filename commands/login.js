const chalk = require('chalk');
const inquirer = require('inquirer');
const { default: open } = require('open');
const ApiClient = require('../api/client');

// Import CharacterService from character command
const { CharacterService } = require('./character');

async function loginCommand() {
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
      
      // Check if user has a character
      const character = await apiClient.getCharacter();
      if (!character) {
        console.log(chalk.yellow('\n🎭 You don\'t have a character yet!'));
        console.log(chalk.gray('You can create one with: commitquest character edit'));
        
        // Create a default character without interactive editing
        try {
          console.log('');
          const defaultCharacter = await apiClient.createCharacter('Adventurer', 1); // Assuming class ID 1 exists
          console.log(chalk.green('✅ Default character created!'));
          console.log(chalk.gray('You can customize your character later with: commitquest character edit'));
          
          // Trigger extension refresh after character creation
          CharacterService.touchConfigFile();
        } catch (charError) {
          console.log(chalk.yellow('⚠️  Could not create default character. You can create one manually later.'));
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

module.exports = loginCommand; 