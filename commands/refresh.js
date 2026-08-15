import { CharacterService } from './character.js';
import { handleCommandError } from './ui.js';
import { compactBanner, successBanner, infoHint, sparkleLine } from './theme.js';

async function refreshCommand() {
  try {
    console.log('');
    console.log(compactBanner('Refresh'));
    console.log('');

    CharacterService.touchConfigFile();

    console.log(
      successBanner('Extension refresh triggered!', [
        'The VS Code extension should update automatically.',
      ])
    );
    console.log('');
    console.log(sparkleLine('Syncing your quest to the realm'));
    console.log(infoHint("If it doesn't update, try manually refreshing the extension."));
    console.log('');
  } catch (error) {
    handleCommandError(error, { label: 'Failed to refresh extension.' });
  }
}

export default refreshCommand;
