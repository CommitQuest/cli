import chalk from 'chalk';
import inquirer from 'inquirer';
import { default as open } from 'open';
import ApiClient from '../api/client.js';
import { CharacterService } from './character.js';
import { ensureServerReachable, handleCommandError } from './ui.js';
import {
  banner,
  box,
  compactBanner,
  successBanner,
  warnBanner,
  errorBanner,
  rateLimitBanner,
  infoHint,
  palette,
  waitingPulse,
  sparkleLine,
  resolvePanelWidth,
} from './theme.js';

async function loginCommand() {
  try {
    const apiClient = new ApiClient();

    await ensureServerReachable(apiClient);

    try {
      const currentUser = await apiClient.verifyToken();
      console.log('');
      console.log(
        warnBanner('You are already logged in!', [
          `Current user: ${currentUser.github_username}`,
          'Use "commitquest logout" to log out first.',
        ])
      );
      console.log('');
      return;
    } catch (error) {
      // Only continue into device flow when there is no valid session.
      if (error.response?.status && error.response.status !== 401) {
        throw error;
      }
    }

    console.log('');
    console.log(banner('Authorize with GitHub to begin'));
    console.log('');
    console.log(compactBanner('Login'));
    console.log('');
    console.log(palette.mist('  This uses GitHub App device flow for authentication.'));
    console.log('');

    console.log(palette.teal('  ◐ Starting device flow...'));
    const deviceFlow = await apiClient.startDeviceFlow();

    if (!deviceFlow.success) {
      console.log(
        errorBanner('Failed to start authentication.', [
          'The server could not initiate the login flow. Please try again.',
        ])
      );
      process.exit(1);
    }

    const { user_code, verification_uri, expires_in } = deviceFlow;

    console.log(palette.teal('\n  ◈ Opening browser for verification...'));
    open(verification_uri).catch(() => {
      console.log(palette.amber('  ⚠ Could not open browser automatically. Please visit:'));
      console.log(chalk.cyan(`  ${verification_uri}`));
    });

    console.log('');
    const codeLines = [
      palette.mist('  Enter this code in your browser:'),
      '',
      palette.goldBright(`  ${formatUserCode(user_code)}`),
      '',
      palette.stone(`  Expires in ${Math.floor(expires_in / 60)} minutes`),
      palette.stone(`  ${verification_uri}`),
    ];
    console.log(
      box(codeLines, {
        title: 'Verification',
        width: resolvePanelWidth(56),
        style: 'double',
        color: 'gold',
      })
    );
    console.log('');

    const tokenResult = await pollForToken(
      apiClient,
      deviceFlow.device_code,
      deviceFlow.interval,
      expires_in
    );

    if (!tokenResult.success) {
      if (isServerPollRateLimitError(tokenResult.error, tokenResult.details)) {
        console.log(
          rateLimitBanner('Login paused — server polling limit reached.', [
            'The CommitQuest API rate-limited device login polls from this network.',
            'This is not caused by entering the wrong verification code.',
            'Wait a few minutes, then run: commitquest login',
          ])
        );
        process.exit(1);
      }

      const details = [
        ...(tokenResult.error ? [tokenResult.error] : []),
        'Make sure you have:',
        '  • Entered the verification code correctly',
        '  • Completed the authorization in your browser',
        '  • Finished within the code expiration window',
      ];
      console.log(errorBanner('Authentication failed.', details));
      process.exit(1);
    }

    try {
      const currentUser = await apiClient.verifyToken();
      console.log('');
      console.log(
        successBanner('Login successful!', [`Welcome, ${currentUser.github_username}!`])
      );

      const character = await apiClient.getCharacterOrNull();
      if (!character) {
        console.log('');
        console.log(
          warnBanner("You don't have a character yet!", ["Let's create one now!"])
        );
        console.log('');

        const speciesList = await apiClient.getSpecies();
        const classList = await apiClient.getCharacterClasses();

        if (speciesList.length === 0 || classList.length === 0) {
          console.log(
            errorBanner('No character classes or species are available right now.', [
              'You can try again later.',
            ])
          );
        } else {
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'name',
              message: 'Enter your character name:',
              validate: validateCharacterName,
            },
            {
              type: 'list',
              name: 'speciesId',
              message: 'Select a species:',
              choices: speciesList.map((species) => ({
                name: `${CharacterService.getSpeciesEmoji(species.name)} ${species.name}`,
                value: species.id,
              })),
            },
            {
              type: 'list',
              name: 'classId',
              message: 'Select a class:',
              choices: classList.map((cls) => ({
                name: `${CharacterService.getClassEmoji(cls.name)} ${cls.name}`,
                value: cls.id,
              })),
            },
          ]);

          try {
            await apiClient.createCharacter(answers.name, answers.classId, answers.speciesId);

            CharacterService.printCharacterCreated(
              answers.name,
              speciesList.find((s) => s.id === answers.speciesId).name,
              classList.find((c) => c.id === answers.classId).name
            );

            CharacterService.touchConfigFile();
          } catch (charError) {
            console.log(
              errorBanner('Failed to create character.', [charError.message])
            );
          }
        }
      }
    } catch (error) {
      console.log(errorBanner('Login failed. Please try again.', []));
      apiClient.clearStoredToken();
      process.exit(1);
    }

    console.log(sparkleLine('You can now use all CommitQuest commands'));
    console.log(infoHint('Try: commitquest dashboard'));
    console.log('');

    process.nextTick(() => process.exit(0));
  } catch (error) {
    handleCommandError(error, { label: 'Login failed.' });
  }
}

function formatUserCode(code) {
  // Space mid-code for readability when possible (e.g. ABCD-EFGH)
  return String(code);
}

function validateCharacterName(input) {
  const name = String(input || '').trim();
  if (!name) return 'Name cannot be empty';
  if (name.length > 32) return 'Name must be 32 characters or fewer';
  if (!/^[A-Za-z0-9 _'-]+$/.test(name)) {
    return 'Name may only contain letters, numbers, spaces, apostrophes, underscores, and hyphens';
  }
  return true;
}

// Match GitHub's default device-flow interval (5s).
const MIN_POLL_INTERVAL_MS = 5000;

/** Backend authPollRateLimiter (distinct from GitHub's slow_down). */
export function isServerPollRateLimitError(error, details) {
  if (error === 'server_poll_rate_limit') return true;
  const message = `${error || ''} ${details || ''}`;
  return /too many device token polls/i.test(message);
}

export function isRetryableDevicePollError(error) {
  if (!error) return false;
  if (isServerPollRateLimitError(error)) return false;
  if (error === 'authorization_pending' || error === 'slow_down') return true;
  return /rate limit|too many|slow down/i.test(String(error));
}

export function resolvePollIntervalMs(intervalSeconds) {
  const seconds = Number(intervalSeconds);
  const ms = (Number.isFinite(seconds) && seconds > 0 ? seconds : 5) * 1000;
  return Math.max(ms, MIN_POLL_INTERVAL_MS);
}

/** GitHub slow_down: increase wait by 5s per spec. */
export function resolveRateLimitWaitMs({ currentIntervalMs, retryAfterMs } = {}) {
  const githubBackoff = Math.max(Number(currentIntervalMs) || MIN_POLL_INTERVAL_MS, 0) + 5000;
  const fromHeader = Number(retryAfterMs);
  if (Number.isFinite(fromHeader) && fromHeader > 0) {
    return Math.max(githubBackoff, fromHeader);
  }
  return githubBackoff;
}

async function pollForToken(apiClient, deviceCode, interval, expiresIn) {
  const startTime = Date.now();
  const expiresSeconds = Number(expiresIn);
  const maxWaitTime = (Number.isFinite(expiresSeconds) && expiresSeconds > 0 ? expiresSeconds : 900) * 1000;
  let currentInterval = resolvePollIntervalMs(interval);
  let pollCount = 0;

  console.log(
    palette.stone(
      `  ${waitingPulse(0)} Polling every ${currentInterval / 1000}s until authorization...`
    )
  );

  while (Date.now() - startTime < maxWaitTime) {
    pollCount++;
    const result = await apiClient.pollForToken(deviceCode, Math.ceil(currentInterval / 1000));

    if (result.success) {
      console.log('');
      console.log(palette.emerald('  ★ Authorization successful!'));
      if (!result.apiToken) {
        return {
          success: false,
          error: 'Server authorized but did not return an API token',
        };
      }
      try {
        apiClient.storeToken(result.apiToken);
      } catch (error) {
        return {
          success: false,
          error: `Could not save login token (${error.message}). Check permissions for ~/.commitquest/`,
        };
      }
      return result;
    }

    if (isServerPollRateLimitError(result.error, result.details)) {
      return {
        success: false,
        error: 'server_poll_rate_limit',
        details: result.details || result.error,
      };
    }

    if (result.error === 'authorization_pending') {
      if (pollCount % 3 === 0) {
        process.stdout.write(palette.gold(waitingPulse(pollCount) + ' '));
      }
      await sleep(currentInterval);
      continue;
    }

    if (isRetryableDevicePollError(result.error) && result.error !== 'authorization_pending') {
      const waitMs = resolveRateLimitWaitMs({
        currentIntervalMs: currentInterval,
        retryAfterMs: result.retryAfterMs,
      });
      currentInterval = Math.max(currentInterval + 5000, waitMs);
      console.log(
        palette.amber(`\n  ⏳ GitHub asked us to slow down; waiting ${Math.ceil(waitMs / 1000)}s...`)
      );
      await sleep(waitMs);
      continue;
    }

    if (result.error === 'expired_token') {
      return {
        success: false,
        error: 'Verification code expired - please try again',
      };
    }

    if (result.error === 'access_denied') {
      return {
        success: false,
        error: 'Access was denied - please try again',
      };
    }

    return result;
  }

  return {
    success: false,
    error: 'Authentication timeout - please try again',
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default loginCommand;
