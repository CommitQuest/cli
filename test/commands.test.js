import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// We test command-level behaviour by stubbing ApiClient and intercepting
// console output + process.exit so tests stay isolated from the network.
// ---------------------------------------------------------------------------

let captured = [];
let origLog, origError, origExit;
let exitCode = null;

beforeEach(() => {
  captured = [];
  exitCode = null;
  origLog = console.log;
  origError = console.error;
  origExit = process.exit;

  console.log = (...args) => captured.push(args.join(' '));
  console.error = (...args) => captured.push(args.join(' '));
  process.exit = (code) => {
    exitCode = code;
    throw new Error(`__EXIT_${code}__`);
  };
});

afterEach(() => {
  console.log = origLog;
  console.error = origError;
  process.exit = origExit;
});

function output() {
  return captured.join('\n');
}

// ---------------------------------------------------------------------------
// Helpers: build mock axios-style errors
// ---------------------------------------------------------------------------

function axiosError(status) {
  const err = new Error(`Request failed with status code ${status}`);
  err.isAxiosError = true;
  err.response = { status, data: {} };
  return err;
}

function networkError(code) {
  const err = new Error('Network Error');
  err.isAxiosError = true;
  err.code = code;
  return err;
}

// ---------------------------------------------------------------------------
// handleCommandError (the central catch-all used by every command)
// ---------------------------------------------------------------------------

describe('handleCommandError integration', () => {
  it('prints login prompt and exits 1 on 401', async () => {
    const { handleCommandError } = await import('../commands/ui.js');
    try {
      handleCommandError(axiosError(401), { label: 'Test' });
    } catch (e) { /* swallow exit */ }
    assert.equal(exitCode, 1);
    const text = output();
    assert.match(text, /Authentication required/i);
    assert.match(text, /commitquest login/);
    assert.doesNotMatch(text, /Request failed with status code 401/);
  });

  it('prints network message on ECONNREFUSED', async () => {
    const { handleCommandError } = await import('../commands/ui.js');
    try {
      handleCommandError(networkError('ECONNREFUSED'), { label: 'Test' });
    } catch (e) { /* swallow exit */ }
    assert.equal(exitCode, 1);
    const text = output();
    assert.match(text, /Network error/i);
    assert.match(text, /Wi-Fi/i);
  });

  it('prints network message on ENOTFOUND (no DNS)', async () => {
    const { handleCommandError } = await import('../commands/ui.js');
    try {
      handleCommandError(networkError('ENOTFOUND'), { label: 'Test' });
    } catch (e) { /* swallow exit */ }
    const text = output();
    assert.match(text, /Network error/i);
  });

  it('prints timeout message on ECONNABORTED timeout', async () => {
    const { handleCommandError } = await import('../commands/ui.js');
    const err = new Error('timeout of 10000ms exceeded');
    err.isAxiosError = true;
    err.code = 'ECONNABORTED';
    try {
      handleCommandError(err, { label: 'Test' });
    } catch (e) { /* swallow exit */ }
    const text = output();
    assert.match(text, /timed out/i);
  });

  it('prints server error on 500', async () => {
    const { handleCommandError } = await import('../commands/ui.js');
    try {
      handleCommandError(axiosError(500), { label: 'Test' });
    } catch (e) { /* swallow exit */ }
    const text = output();
    assert.match(text, /Server error/i);
  });

  it('prints forbidden on 403', async () => {
    const { handleCommandError } = await import('../commands/ui.js');
    try {
      handleCommandError(axiosError(403), { label: 'Test' });
    } catch (e) { /* swallow exit */ }
    const text = output();
    assert.match(text, /Permission denied/i);
  });

  it('prints rate-limited on 429', async () => {
    const { handleCommandError } = await import('../commands/ui.js');
    try {
      handleCommandError(axiosError(429), { label: 'Test' });
    } catch (e) { /* swallow exit */ }
    const text = output();
    assert.match(text, /Rate limited/i);
  });

  it('prints a generic message for unknown errors', async () => {
    const { handleCommandError } = await import('../commands/ui.js');
    try {
      handleCommandError(new Error('something broke'), { label: 'Oops.' });
    } catch (e) { /* swallow exit */ }
    assert.equal(exitCode, 1);
    const text = output();
    assert.match(text, /Oops\./);
    assert.match(text, /something broke/);
  });

  it('never shows raw "Request failed with status code" in output', async () => {
    const { handleCommandError } = await import('../commands/ui.js');
    for (const status of [401, 403, 404, 429, 500, 502, 503]) {
      captured = [];
      exitCode = null;
      try {
        handleCommandError(axiosError(status), { label: 'Test' });
      } catch (e) { /* swallow exit */ }
      const text = output();
      assert.doesNotMatch(
        text,
        /Request failed with status code/,
        `Status ${status} should not show raw axios message`
      );
    }
  });
});

// ---------------------------------------------------------------------------
// classifyError -> handleCommandError round-trip for edge cases
// ---------------------------------------------------------------------------

describe('edge-case error rendering', () => {
  it('handles API validation body with error field', async () => {
    const { handleCommandError } = await import('../commands/ui.js');
    const err = axiosError(422);
    err.response.data = { error: 'Character name already taken' };
    try {
      handleCommandError(err, { label: 'Validation' });
    } catch (e) { /* swallow exit */ }
    const text = output();
    assert.match(text, /Character name already taken/);
  });

  it('handles API validation body with details field', async () => {
    const { handleCommandError } = await import('../commands/ui.js');
    const err = axiosError(400);
    err.response.data = { details: 'Missing required field: name' };
    try {
      handleCommandError(err, { label: 'Validation' });
    } catch (e) { /* swallow exit */ }
    const text = output();
    assert.match(text, /Missing required field/);
  });
});
