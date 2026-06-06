import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyError, isNetworkError, isTimeoutError, isAuthError } from '../api/errors.js';

// ---------------------------------------------------------------------------
// Helpers to build fake axios-style error objects
// ---------------------------------------------------------------------------

function axiosError(status, data = {}, extra = {}) {
  const err = new Error(`Request failed with status code ${status}`);
  err.isAxiosError = true;
  err.response = { status, data };
  return Object.assign(err, extra);
}

function networkError(code, message = 'Network Error') {
  const err = new Error(message);
  err.isAxiosError = true;
  err.code = code;
  return err;
}

// ---------------------------------------------------------------------------
// classifyError
// ---------------------------------------------------------------------------

describe('classifyError', () => {
  it('returns "auth" for 401', () => {
    const result = classifyError(axiosError(401));
    assert.equal(result.kind, 'auth');
  });

  it('returns "forbidden" for 403', () => {
    const result = classifyError(axiosError(403));
    assert.equal(result.kind, 'forbidden');
  });

  it('returns "notFound" for 404', () => {
    const result = classifyError(axiosError(404));
    assert.equal(result.kind, 'notFound');
  });

  it('returns "rateLimited" for 429', () => {
    const result = classifyError(axiosError(429));
    assert.equal(result.kind, 'rateLimited');
  });

  it('returns "server" for 500', () => {
    const result = classifyError(axiosError(500));
    assert.equal(result.kind, 'server');
  });

  it('returns "server" for 502', () => {
    const result = classifyError(axiosError(502));
    assert.equal(result.kind, 'server');
  });

  it('returns "server" for 503', () => {
    const result = classifyError(axiosError(503));
    assert.equal(result.kind, 'server');
  });

  it('returns "network" for ECONNREFUSED', () => {
    const result = classifyError(networkError('ECONNREFUSED'));
    assert.equal(result.kind, 'network');
  });

  it('returns "network" for ENOTFOUND (no DNS / no Wi-Fi)', () => {
    const result = classifyError(networkError('ENOTFOUND'));
    assert.equal(result.kind, 'network');
  });

  it('returns "network" for ENETUNREACH', () => {
    const result = classifyError(networkError('ENETUNREACH'));
    assert.equal(result.kind, 'network');
  });

  it('returns "network" for generic "Network Error" without response', () => {
    const err = new Error('Network Error');
    err.isAxiosError = true;
    const result = classifyError(err);
    assert.equal(result.kind, 'network');
  });

  it('returns "timeout" for ECONNABORTED with timeout message', () => {
    const err = networkError('ECONNABORTED', 'timeout of 10000ms exceeded');
    const result = classifyError(err);
    assert.equal(result.kind, 'timeout');
  });

  it('returns "timeout" for ERR_CANCELED', () => {
    const err = networkError('ERR_CANCELED', 'canceled');
    const result = classifyError(err);
    assert.equal(result.kind, 'timeout');
  });

  it('returns "validation" when API body contains an error string', () => {
    const result = classifyError(axiosError(422, { error: 'Name is required' }));
    assert.equal(result.kind, 'validation');
    assert.equal(result.message, 'Name is required');
  });

  it('returns "unknown" for null / undefined', () => {
    assert.equal(classifyError(null).kind, 'unknown');
    assert.equal(classifyError(undefined).kind, 'unknown');
  });

  it('returns "unknown" for a plain Error with no axios metadata', () => {
    const result = classifyError(new Error('something broke'));
    assert.equal(result.kind, 'unknown');
    assert.match(result.message, /something broke/);
  });
});

// ---------------------------------------------------------------------------
// isNetworkError
// ---------------------------------------------------------------------------

describe('isNetworkError', () => {
  it('detects ECONNREFUSED', () => {
    assert.equal(isNetworkError(networkError('ECONNREFUSED')), true);
  });

  it('detects ECONNRESET', () => {
    assert.equal(isNetworkError(networkError('ECONNRESET')), true);
  });

  it('detects EHOSTUNREACH', () => {
    assert.equal(isNetworkError(networkError('EHOSTUNREACH')), true);
  });

  it('detects EAI_AGAIN', () => {
    assert.equal(isNetworkError(networkError('EAI_AGAIN')), true);
  });

  it('returns false for a 401 HTTP error', () => {
    assert.equal(isNetworkError(axiosError(401)), false);
  });

  it('detects axios error with no response (e.g. Wi-Fi off)', () => {
    const err = new Error('Network Error');
    err.isAxiosError = true;
    assert.equal(isNetworkError(err), true);
  });
});

// ---------------------------------------------------------------------------
// isTimeoutError
// ---------------------------------------------------------------------------

describe('isTimeoutError', () => {
  it('detects ECONNABORTED with timeout message', () => {
    assert.equal(
      isTimeoutError(networkError('ECONNABORTED', 'timeout of 10000ms exceeded')),
      true
    );
  });

  it('does not flag ECONNABORTED without timeout in message', () => {
    assert.equal(isTimeoutError(networkError('ECONNABORTED', 'aborted')), false);
  });

  it('detects ERR_CANCELED', () => {
    assert.equal(isTimeoutError(networkError('ERR_CANCELED', 'canceled')), true);
  });

  it('returns false for a normal 500', () => {
    assert.equal(isTimeoutError(axiosError(500)), false);
  });
});

// ---------------------------------------------------------------------------
// isAuthError
// ---------------------------------------------------------------------------

describe('isAuthError', () => {
  it('returns true for 401', () => {
    assert.equal(isAuthError(axiosError(401)), true);
  });

  it('returns false for 403', () => {
    assert.equal(isAuthError(axiosError(403)), false);
  });

  it('returns false for network errors', () => {
    assert.equal(isAuthError(networkError('ECONNREFUSED')), false);
  });
});
