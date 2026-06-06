import chalk from 'chalk';
import cliProgress from 'cli-progress';
import { classifyError, isAuthError } from '../api/errors.js';

export function printAuthRequired() {
  console.log(chalk.red('❌ Authentication required!'));
  console.log(chalk.yellow('Please log in first with:'));
  console.log(chalk.cyan('  commitquest login'));
  console.log(chalk.gray('\nThis will open your browser to authorize with GitHub.'));
}

export function printServerUnreachable() {
  console.log(chalk.red('❌ Cannot connect to the CommitQuest server!'));
  console.log(chalk.gray('Please check:'));
  console.log(chalk.gray('  • Your internet connection'));
  console.log(chalk.gray('  • That the server is running and accessible'));
  if (process.env.COMMITQUEST_DEV === '1' || process.env.NODE_ENV === 'development') {
    console.log(chalk.gray('  • If using a local server: cd server && npm install && npm start'));
  }
}

export function printNetworkError() {
  console.log(chalk.red('❌ Network error!'));
  console.log(chalk.gray('CommitQuest could not reach the server. Please check:'));
  console.log(chalk.gray('  • Your internet or Wi-Fi connection'));
  console.log(chalk.gray('  • Any VPN or firewall settings'));
  console.log(chalk.gray('  • That the server is online'));
}

export function printTimeoutError() {
  console.log(chalk.red('❌ Request timed out!'));
  console.log(chalk.gray('The server took too long to respond.'));
  console.log(chalk.gray('Please try again in a moment.'));
}

export function printServerError() {
  console.log(chalk.red('❌ Server error!'));
  console.log(chalk.gray('The CommitQuest server ran into a problem.'));
  console.log(chalk.gray('Please try again later. If this persists, check the project status page.'));
}

export function printForbiddenError() {
  console.log(chalk.red('❌ Permission denied!'));
  console.log(chalk.gray('Your account does not have access to this resource.'));
  console.log(chalk.gray('You may need to re-authorize the GitHub App:'));
  console.log(chalk.cyan('  commitquest logout'));
  console.log(chalk.cyan('  commitquest login'));
}

export function printRateLimited() {
  console.log(chalk.yellow('⚠️  Rate limited!'));
  console.log(chalk.gray('Too many requests. Please wait a moment and try again.'));
}

export function printGenericError(label, detail) {
  console.log(chalk.red(`❌ ${label}`));
  if (detail) {
    console.log(chalk.gray(`  ${detail}`));
  }
}

function clampProgress(progress) {
  if (!Number.isFinite(progress)) {
    return 0;
  }

  return Math.min(100, Math.max(0, progress));
}

function formatPercent(progress) {
  return Number(progress.toFixed(2)).toString();
}

export function formatLevelProgressBar(levelProgress, { width = 20 } = {}) {
  if (!levelProgress || !Number.isFinite(levelProgress.currentLevel)) {
    return null;
  }

  const currentLevel = levelProgress.currentLevel;
  const expInCurrentLevel = Number.isFinite(levelProgress.expInCurrentLevel)
    ? levelProgress.expInCurrentLevel
    : 0;
  const expNeededForNextLevel = Number.isFinite(levelProgress.expNeededForNextLevel)
    ? levelProgress.expNeededForNextLevel
    : 0;
  const progress = clampProgress(
    Number.isFinite(levelProgress.progress)
      ? levelProgress.progress
      : (expNeededForNextLevel > 0 ? (expInCurrentLevel / expNeededForNextLevel) * 100 : 0)
  );

  const safeWidth = Math.max(1, width);
  const progressBar = new cliProgress.SingleBar({
    barsize: safeWidth,
    format: 'Lv {currentLevel} [{bar}] Lv {nextLevel}',
  }, cliProgress.Presets.shades_classic);
  const bar = cliProgress.Format.Formatter(
    progressBar.options,
    {
      progress: progress / 100,
      eta: 0,
      startTime: Date.now(),
      stopTime: Date.now(),
      total: expNeededForNextLevel,
      value: expInCurrentLevel,
      maxWidth: 1000
    },
    {
      currentLevel,
      nextLevel: currentLevel + 1
    }
  );
  const totalExp = Number.isFinite(levelProgress.totalExp) ? levelProgress.totalExp : 0;

  return [
    bar,
    `${expInCurrentLevel}/${expNeededForNextLevel} XP (${formatPercent(progress)}%)`,
    `Total XP: ${totalExp}`
  ].join('\n');
}

/**
 * Central handler for command-level catch blocks.
 * Prints a polished message based on error type and exits.
 */
export function handleCommandError(error, { label = 'Something went wrong.', exitCode = 1 } = {}) {
  const classified = classifyError(error);

  switch (classified.kind) {
    case 'auth':
      printAuthRequired();
      break;
    case 'network':
      printNetworkError();
      break;
    case 'timeout':
      printTimeoutError();
      break;
    case 'server':
      printServerError();
      break;
    case 'forbidden':
      printForbiddenError();
      break;
    case 'rateLimited':
      printRateLimited();
      break;
    case 'notFound':
      printGenericError(label, 'The requested resource could not be found.');
      break;
    case 'validation':
      printGenericError(label, classified.message);
      break;
    default:
      printGenericError(label, classified.message);
      break;
  }

  process.exit(exitCode);
}

/**
 * Guards: call at the top of commands that require a live server + auth.
 * Returns the verified user object on success.
 */
export async function requireAuth(apiClient) {
  const isServerRunning = await apiClient.healthCheck();
  if (!isServerRunning) {
    printServerUnreachable();
    process.exit(1);
  }

  try {
    return await apiClient.verifyToken();
  } catch (error) {
    if (isAuthError(error)) {
      printAuthRequired();
    } else {
      handleCommandError(error, { label: 'Failed to verify authentication.' });
    }
    process.exit(1);
  }
}

/**
 * Guard: call at the top of commands that require a live server but not auth.
 */
export async function ensureServerReachable(apiClient) {
  const isServerRunning = await apiClient.healthCheck();
  if (!isServerRunning) {
    printServerUnreachable();
    process.exit(1);
  }
}
