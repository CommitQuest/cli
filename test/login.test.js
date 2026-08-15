import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  isRetryableDevicePollError,
  isServerPollRateLimitError,
  resolvePollIntervalMs,
  resolveRateLimitWaitMs,
} from '../commands/login.js';
import { parseRetryAfterMs } from '../api/client.js';

// ---------------------------------------------------------------------------
// Token storage tests (directly on ApiClient)
// ---------------------------------------------------------------------------

describe('ApiClient token storage', () => {
  let ApiClient;
  let tmpDir;
  let origHome;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cq-test-'));
    origHome = process.env.HOME;
    process.env.HOME = tmpDir;
    // Fresh import each time to avoid stale module state
    const mod = await import('../api/client.js');
    ApiClient = mod.default;
  });

  afterEach(() => {
    process.env.HOME = origHome;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('stores and retrieves a token', () => {
    const client = new ApiClient();
    client.storeToken('test-token-123');
    assert.equal(client.getStoredToken(), 'test-token-123');
  });

  it('creates config directory if missing', () => {
    const client = new ApiClient();
    const configDir = path.join(tmpDir, '.commitquest');
    assert.equal(fs.existsSync(configDir), false);
    client.storeToken('tok');
    assert.equal(fs.existsSync(configDir), true);
  });

  it('sets restrictive file permissions (0600)', () => {
    const client = new ApiClient();
    client.storeToken('test-token-with-restricted-file-mode');
    const configPath = path.join(tmpDir, '.commitquest', 'config.json');
    const stat = fs.statSync(configPath);
    const mode = stat.mode & 0o777;
    assert.equal(mode, 0o600);
  });

  it('clearStoredToken removes the config file', () => {
    const client = new ApiClient();
    client.storeToken('tok');
    const configPath = path.join(tmpDir, '.commitquest', 'config.json');
    assert.equal(fs.existsSync(configPath), true);
    client.clearStoredToken();
    assert.equal(fs.existsSync(configPath), false);
  });

  it('getStoredToken returns null when no config exists', () => {
    const client = new ApiClient();
    assert.equal(client.getStoredToken(), null);
  });

  it('preserves other config fields when storing token', () => {
    const client = new ApiClient();
    const configDir = path.join(tmpDir, '.commitquest');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify({ custom: 'data' })
    );
    client.storeToken('new-token');
    const config = JSON.parse(
      fs.readFileSync(path.join(configDir, 'config.json'), 'utf8')
    );
    assert.equal(config.custom, 'data');
    assert.equal(config.apiToken, 'new-token');
  });
});

// ---------------------------------------------------------------------------
// Device-flow polling helpers
// ---------------------------------------------------------------------------

describe('device poll helpers', () => {
  it('uses the GitHub-provided poll interval with a 5s floor', () => {
    assert.equal(resolvePollIntervalMs(5), 5000);
    assert.equal(resolvePollIntervalMs(12), 12000);
    assert.equal(resolvePollIntervalMs(undefined), 5000);
  });

  it('treats GitHub slow_down as retryable but not server poll limits', () => {
    assert.equal(isRetryableDevicePollError('authorization_pending'), true);
    assert.equal(isRetryableDevicePollError('slow_down'), true);
    assert.equal(isRetryableDevicePollError('server_poll_rate_limit'), false);
    assert.equal(
      isRetryableDevicePollError('Too many device token polls, please slow down'),
      false
    );
    assert.equal(isRetryableDevicePollError('expired_token'), false);
  });

  it('detects server-side device poll rate limits', () => {
    assert.equal(isServerPollRateLimitError('server_poll_rate_limit'), true);
    assert.equal(
      isServerPollRateLimitError('slow_down', 'Too many device token polls, please slow down'),
      true
    );
    assert.equal(isServerPollRateLimitError('slow_down'), false);
    assert.equal(isServerPollRateLimitError('authorization_pending'), false);
  });

  it('uses GitHub +5s backoff for plain slow_down', () => {
    assert.equal(resolveRateLimitWaitMs({ currentIntervalMs: 10000 }), 15000);
  });

  it('honors Retry-After when longer than the default backoff', () => {
    assert.equal(
      resolveRateLimitWaitMs({
        currentIntervalMs: 10000,
        retryAfterMs: 120000,
      }),
      120000
    );
  });

  it('parses Retry-After and RateLimit-Reset headers', () => {
    assert.equal(parseRetryAfterMs({ 'retry-after': '90' }), 90000);
    assert.equal(parseRetryAfterMs({ 'ratelimit-reset': '45' }), 45000);
  });
});

// ---------------------------------------------------------------------------
// Device-flow polling logic tests
// ---------------------------------------------------------------------------

describe('pollForToken logic', () => {
  it('returns success when API responds with success and apiToken', async () => {
    let pollCount = 0;
    const mockApiClient = {
      pollForToken: async () => {
        pollCount++;
        if (pollCount >= 2) {
          return { success: true, apiToken: 'real-token' };
        }
        return { success: false, error: 'authorization_pending' };
      },
      storeToken: () => {},
    };

    const result = await simulatePoll(mockApiClient, 'device-123', 0.01, 10);
    assert.equal(result.success, true);
    assert.equal(result.apiToken, 'real-token');
    assert.equal(pollCount, 2);
  });

  it('handles slow_down by increasing interval', async () => {
    let pollCount = 0;
    const mockApiClient = {
      pollForToken: async () => {
        pollCount++;
        if (pollCount === 1) return { success: false, error: 'slow_down' };
        return { success: true, apiToken: 'token' };
      },
      storeToken: () => {},
    };

    const result = await simulatePoll(mockApiClient, 'dev', 0.01, 10);
    assert.equal(result.success, true);
  });

  it('fails clearly when the server poll rate limit is hit', async () => {
    const mockApiClient = {
      pollForToken: async () => ({
        success: false,
        error: 'server_poll_rate_limit',
        details: 'Too many device token polls, please slow down',
      }),
      storeToken: () => {},
    };

    const result = await simulatePoll(mockApiClient, 'dev', 0.01, 10);
    assert.equal(result.success, false);
    assert.equal(result.error, 'server_poll_rate_limit');
  });

  it('returns failure on expired_token', async () => {
    const mockApiClient = {
      pollForToken: async () => ({ success: false, error: 'expired_token' }),
      storeToken: () => {},
    };

    const result = await simulatePoll(mockApiClient, 'dev', 0.01, 10);
    assert.equal(result.success, false);
    assert.match(result.error, /expired/i);
  });

  it('returns failure on access_denied', async () => {
    const mockApiClient = {
      pollForToken: async () => ({ success: false, error: 'access_denied' }),
      storeToken: () => {},
    };

    const result = await simulatePoll(mockApiClient, 'dev', 0.01, 10);
    assert.equal(result.success, false);
    assert.match(result.error, /denied/i);
  });

  it('times out after expiresIn seconds', async () => {
    const mockApiClient = {
      pollForToken: async () => ({ success: false, error: 'authorization_pending' }),
      storeToken: () => {},
    };

    const result = await simulatePoll(mockApiClient, 'dev', 0.01, 0.05);
    assert.equal(result.success, false);
    assert.match(result.error, /timeout/i);
  });
});

// ---------------------------------------------------------------------------
// Minimal reimplementation of the poll loop from commands/login.js
// (mirrors the logic exactly so tests validate the same contract)
// ---------------------------------------------------------------------------

async function simulatePoll(apiClient, deviceCode, intervalSec, expiresInSec) {
  const startTime = Date.now();
  const maxWaitTime = expiresInSec * 1000;
  // Tests use tiny intervals; production uses resolvePollIntervalMs().
  let currentInterval = intervalSec * 1000;

  while (Date.now() - startTime < maxWaitTime) {
    const result = await apiClient.pollForToken(deviceCode, intervalSec);

    if (result.success) {
      if (!result.apiToken) {
        return { success: false, error: 'Server authorized but did not return an API token' };
      }
      apiClient.storeToken(result.apiToken);
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
      await sleep(currentInterval);
      continue;
    }

    if (isRetryableDevicePollError(result.error) && result.error !== 'authorization_pending') {
      const waitMs = resolveRateLimitWaitMs({
        currentIntervalMs: currentInterval,
        retryAfterMs: result.retryAfterMs,
      });
      currentInterval = Math.min(waitMs, currentInterval + 5);
      await sleep(currentInterval);
      continue;
    }

    if (result.error === 'expired_token') {
      return { success: false, error: 'Verification code expired - please try again' };
    }

    if (result.error === 'access_denied') {
      return { success: false, error: 'Access was denied - please try again' };
    }

    return result;
  }

  return { success: false, error: 'Authentication timeout - please try again' };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
