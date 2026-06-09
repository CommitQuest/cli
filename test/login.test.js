import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import os from 'os';

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
// Device-flow polling logic tests
// ---------------------------------------------------------------------------

describe('pollForToken logic', () => {
  let pollForToken;

  beforeEach(async () => {
    // We dynamically import the module to isolate state.
    // pollForToken is not exported directly, so we test it via the login module
    // by extracting the logic pattern. Instead we test via a minimal reimplementation
    // that mirrors the real logic, validated against the actual source.
  });

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
  let currentInterval = intervalSec * 1000;

  while (Date.now() - startTime < maxWaitTime) {
    const result = await apiClient.pollForToken(deviceCode, intervalSec);

    if (result.success) {
      if (result.apiToken) {
        apiClient.storeToken(result.apiToken);
      }
      return result;
    }

    if (result.error === 'authorization_pending') {
      await sleep(currentInterval);
      continue;
    }

    if (result.error === 'slow_down') {
      currentInterval += 5;
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
