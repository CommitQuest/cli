import chalk from 'chalk';
import { classifyError, isAuthError } from '../api/errors.js';
import {
  errorBanner,
  warnBanner,
  infoHint,
  xpMeter,
  palette,
} from './theme.js';

export function printAuthRequired() {
  console.log(
    errorBanner('Authentication required!', [
      'Please log in first with:',
      '',
      chalk.cyan('  commitquest login'),
      '',
      'This will open your browser to authorize with GitHub.',
    ])
  );
}

export function printServerUnreachable() {
  const hints = [
    'Please check:',
    '  • Your internet connection',
    '  • That the server is running and accessible',
  ];
  if (process.env.COMMITQUEST_DEV === '1') {
    hints.push('  • If using a local API, confirm COMMITQUEST_API_URL is correct');
  }
  console.log(errorBanner('Cannot connect to the CommitQuest server!', hints));
}

export function printNetworkError() {
  console.log(
    errorBanner('Network error!', [
      'CommitQuest could not reach the server. Please check:',
      '  • Your internet or Wi-Fi connection',
      '  • Any VPN or firewall settings',
      '  • That the server is online',
    ])
  );
}

export function printTimeoutError() {
  console.log(
    errorBanner('Request timed out!', [
      'The server took too long to respond.',
      'Please try again in a moment.',
    ])
  );
}

export function printServerError() {
  console.log(
    errorBanner('Server error!', [
      'The CommitQuest server ran into a problem.',
      'Please try again later. If this persists, check the project status page.',
    ])
  );
}

export function printForbiddenError() {
  console.log(
    errorBanner('Permission denied!', [
      'Your account does not have access to this resource.',
      'You may need to re-authorize the GitHub App:',
      '',
      chalk.cyan('  commitquest logout'),
      chalk.cyan('  commitquest login'),
    ])
  );
}

export function printRateLimited() {
  console.log(
    warnBanner('Rate limited!', [
      'Too many requests. Please wait a moment and try again.',
    ])
  );
}

export function printGenericError(label, detail) {
  const details = detail ? [detail] : [];
  console.log(errorBanner(label, details));
}

export function formatLevelProgressBar(levelProgress, { width = 20 } = {}) {
  return xpMeter(levelProgress, { width });
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

export { palette, infoHint };
