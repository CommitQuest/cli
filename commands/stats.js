import ApiClient from '../api/client.js';
import { requireAuth, handleCommandError, formatLevelProgressBar } from './ui.js';
import {
  compactBanner,
  box,
  sectionTitle,
  divider,
  streakVisual,
  commitsVisual,
  infoHint,
  palette,
} from './theme.js';

async function statsCommand() {
  try {
    const apiClient = new ApiClient();
    await requireAuth(apiClient);

    console.log('');
    console.log(compactBanner('Statistics'));
    console.log('');
    console.log(sectionTitle('Chronicle', { width: 48, accent: 'teal' }));
    console.log('');

    const serverStats = await apiClient.getUserStats();

    const lines = [];
    const levelProgressBar = formatLevelProgressBar(serverStats.levelProgress, { width: 24 });

    if (levelProgressBar) {
      lines.push(palette.amber('  Level Progress'));
      lines.push(...levelProgressBar.split('\n').map((l) => `  ${l}`));
      lines.push('');
    } else {
      lines.push(palette.mist('  Level          ') + palette.goldBright(String(serverStats.level)));
    }

    lines.push(
      palette.mist('  Experience     ') + palette.goldBright(`${serverStats.experienceGained} XP`)
    );
    lines.push(
      palette.mist('  Total Commits  ') + palette.teal(commitsVisual(serverStats.totalCommits))
    );
    lines.push(
      palette.mist('  Current Streak ') + streakVisual(serverStats.streakCount)
    );

    console.log(box(lines, { title: '⚔ Stats', width: 50, style: 'heavy', color: 'teal' }));
    console.log('');
    console.log(divider(48, 'ornate'));
    console.log(infoHint('Tip: keep committing daily to grow your streak blaze'));
    console.log('');
  } catch (error) {
    handleCommandError(error, { label: 'Error loading statistics.' });
  }
}

export default statsCommand;
