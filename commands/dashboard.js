import ApiClient from '../api/client.js';
import { requireAuth, handleCommandError, formatLevelProgressBar } from './ui.js';
import {
  banner,
  box,
  divider,
  streakVisual,
  commitsVisual,
  characterPortrait,
  infoHint,
  palette,
  columns,
  appWindow,
  meterTile,
  trophyGrid,
  commandHint,
  sparkleLine,
} from './theme.js';

async function dashboardCommand() {
  try {
    const apiClient = new ApiClient();
    const user = await requireAuth(apiClient);

    const [character, serverStats] = await Promise.all([
      apiClient.getCharacterOrNull(),
      apiClient.getUserStats(),
    ]);

    let achievements = [];
    try {
      const achievementResult = await apiClient.getUserAchievements();
      achievements = Array.isArray(achievementResult) ? achievementResult : [];
    } catch (_) {
      // Achievements are optional on the dashboard
    }

    renderDashboard({
      user,
      character,
      serverStats,
      achievements,
    });
  } catch (error) {
    handleCommandError(error, { label: 'Error loading dashboard.' });
  }
}

function renderDashboard({ user, character, serverStats, achievements }) {
  const username = user?.github_username || 'adventurer';
  const level = serverStats?.level ?? serverStats?.levelProgress?.currentLevel ?? 1;
  const xp = serverStats?.experienceGained ?? 0;
  const commits = serverStats?.totalCommits ?? 0;
  const streak = serverStats?.streakCount ?? 0;
  const progress = Number(serverStats?.levelProgress?.progress);
  const xpPercent = Number.isFinite(progress) ? progress : 0;
  const wide = (process.stdout.columns || 80) >= 90;

  console.log('');
  console.log(banner(`Welcome back, ${username}`));
  console.log('');
  console.log(sparkleLine('your RPG command center'));
  console.log('');

  const heroPanel = character
    ? characterPortrait(character, { width: 30, title: '✦ Hero' })
    : box(
        [
          palette.amber('  No hero yet'),
          '',
          palette.mist('  Create one after login'),
          palette.teal('  to begin your quest.'),
        ],
        { title: '✦ Hero', width: 30, style: 'round', color: 'amber' }
      );

  const levelMeter = formatLevelProgressBar(serverStats?.levelProgress, { width: 20 });
  const statsBody = [];

  if (levelMeter) {
    statsBody.push(...levelMeter.split('\n').map((line) => `  ${line}`));
  } else {
    statsBody.push(palette.mist('  Level ') + palette.goldBright(String(level)));
  }

  statsBody.push('');
  statsBody.push(
    meterTile('Experience', `${xp} XP`, xpPercent, { width: 16, icon: '✦' })
  );
  statsBody.push('');
  statsBody.push(palette.stone('  ◈ Commits'));
  statsBody.push(palette.teal(`  ${commitsVisual(commits)}`));
  statsBody.push('');
  statsBody.push(palette.stone('  ≈ Streak'));
  statsBody.push(`  ${streakVisual(streak)}`);

  const statsPanel = box(statsBody, {
    title: '⚔ Vitals',
    width: 36,
    style: 'double',
    color: 'gold',
  });

  console.log(columns(heroPanel, statsPanel, { gap: 3, minWidth: 72 }));
  console.log('');

  const trophyLines = trophyGrid(achievements, {
    columns: wide ? 2 : 1,
    limit: 6,
  });
  if (achievements.length > 6) {
    trophyLines.push(palette.stone(`  … and ${achievements.length - 6} more`));
  }

  console.log(
    box(trophyLines, {
      title: `★ Trophies (${achievements.length})`,
      width: wide ? 70 : 56,
      style: 'round',
      color: 'emerald',
    })
  );
  console.log('');

  const actions = [
    commandHint('stats', 'detailed chronicle'),
    commandHint('refresh', 'sync VS Code extension'),
  ];

  console.log(
    appWindow({
      title: 'Quick Actions',
      subtitle: `signed in as @${username}`,
      body: actions.map((line) => `  ${line.trimStart()}`).join('\n'),
      footer: `Lv ${level}  ·  ${commits} commits  ·  ${streak}-day streak`,
      width: wide ? 70 : 56,
    })
  );

  console.log('');
  console.log(divider(wide ? 70 : 56, 'ornate'));
  console.log(infoHint('Tip: keep a daily streak to grow your blaze'));
  console.log('');
}

export default dashboardCommand;
