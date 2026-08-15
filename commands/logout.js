import ApiClient from '../api/client.js';
import { CharacterService } from './character.js';
import { handleCommandError } from './ui.js';
import { successBanner, warnBanner, infoHint, sparkleLine } from './theme.js';

async function logoutCommand() {
  try {
    const apiClient = new ApiClient();

    try {
      const currentUser = await apiClient.verifyToken();

      await apiClient.logout();

      console.log('');
      console.log(
        successBanner('Logout successful!', [
          `Goodbye, ${currentUser.github_username}!`,
          'Your quest pauses… until next commit.',
        ])
      );
      console.log('');
      console.log(sparkleLine('Farewell, brave committer'));
      console.log(infoHint('You can log back in anytime with `commitquest login`.'));
      console.log('');

      CharacterService.touchConfigFile();
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('');
        console.log(warnBanner('You are not currently logged in.', []));
        console.log('');
        return;
      }
      throw error;
    }
  } catch (error) {
    handleCommandError(error, { label: 'Logout failed.' });
  }
}

export default logoutCommand;
