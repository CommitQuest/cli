import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import stripAnsi from 'strip-ansi';
import {
  printAuthRequired,
  printServerUnreachable,
  printNetworkError,
  printTimeoutError,
  printServerError,
  printForbiddenError,
  printRateLimited,
  printGenericError,
  formatLevelProgressBar,
} from '../commands/ui.js';

// ---------------------------------------------------------------------------
// Capture console.log output during each test
// ---------------------------------------------------------------------------

let captured = [];
let origLog;

beforeEach(() => {
  captured = [];
  origLog = console.log;
  console.log = (...args) => captured.push(args.join(' '));
});

afterEach(() => {
  console.log = origLog;
});

function output() {
  return stripAnsi(captured.join('\n'));
}

// ---------------------------------------------------------------------------
// printAuthRequired
// ---------------------------------------------------------------------------

describe('printAuthRequired', () => {
  it('tells the user to run commitquest login', () => {
    printAuthRequired();
    const text = output();
    assert.match(text, /Authentication required/i);
    assert.match(text, /commitquest login/);
  });

  it('does not leak raw axios status text', () => {
    printAuthRequired();
    const text = output();
    assert.doesNotMatch(text, /Request failed with status code/);
  });
});

// ---------------------------------------------------------------------------
// printServerUnreachable
// ---------------------------------------------------------------------------

describe('printServerUnreachable', () => {
  it('mentions internet connection', () => {
    printServerUnreachable();
    const text = output();
    assert.match(text, /Cannot connect/i);
    assert.match(text, /internet/i);
  });
});

// ---------------------------------------------------------------------------
// printNetworkError
// ---------------------------------------------------------------------------

describe('printNetworkError', () => {
  it('mentions Wi-Fi and VPN', () => {
    printNetworkError();
    const text = output();
    assert.match(text, /Network error/i);
    assert.match(text, /Wi-Fi/i);
    assert.match(text, /VPN/i);
  });
});

// ---------------------------------------------------------------------------
// printTimeoutError
// ---------------------------------------------------------------------------

describe('printTimeoutError', () => {
  it('explains the server was slow', () => {
    printTimeoutError();
    const text = output();
    assert.match(text, /timed out/i);
    assert.match(text, /try again/i);
  });
});

// ---------------------------------------------------------------------------
// printServerError
// ---------------------------------------------------------------------------

describe('printServerError', () => {
  it('explains a server-side problem', () => {
    printServerError();
    const text = output();
    assert.match(text, /Server error/i);
    assert.match(text, /try again later/i);
  });
});

// ---------------------------------------------------------------------------
// printForbiddenError
// ---------------------------------------------------------------------------

describe('printForbiddenError', () => {
  it('suggests re-authorization', () => {
    printForbiddenError();
    const text = output();
    assert.match(text, /Permission denied/i);
    assert.match(text, /commitquest logout/);
    assert.match(text, /commitquest login/);
  });
});

// ---------------------------------------------------------------------------
// printRateLimited
// ---------------------------------------------------------------------------

describe('printRateLimited', () => {
  it('tells the user to wait', () => {
    printRateLimited();
    const text = output();
    assert.match(text, /Rate limited/i);
    assert.match(text, /wait/i);
  });
});

// ---------------------------------------------------------------------------
// printGenericError
// ---------------------------------------------------------------------------

describe('printGenericError', () => {
  it('shows the provided label', () => {
    printGenericError('Oops!', 'something went wrong');
    const text = output();
    assert.match(text, /Oops!/);
    assert.match(text, /something went wrong/);
  });

  it('works without detail', () => {
    printGenericError('Oops!');
    const text = output();
    assert.match(text, /Oops!/);
  });
});

// ---------------------------------------------------------------------------
// formatLevelProgressBar
// ---------------------------------------------------------------------------

describe('formatLevelProgressBar', () => {
  it('renders level progress as a loading-style bar', () => {
    const text = stripAnsi(formatLevelProgressBar({
      currentLevel: 3,
      expInCurrentLevel: 45,
      expNeededForNextLevel: 238,
      progress: 18.91,
      totalExp: 270
    }, { width: 10 }));

    assert.match(text, /Lv 3 /);
    assert.match(text, / Lv 4/);
    assert.doesNotMatch(text, /\[/);
    assert.doesNotMatch(text, /\]/);
    assert.match(text, /45\/238 XP/);
    assert.match(text, /\(18\.91%\)/);
    assert.match(text, /Total XP: 270/);
    // ~19% of 10 cells => 2 filled
    assert.match(text, /█{2}░{8}/);
  });

  it('returns null when level progress is missing', () => {
    assert.equal(formatLevelProgressBar(null), null);
  });

  it('clamps progress to a valid bar range', () => {
    const text = stripAnsi(formatLevelProgressBar({
      currentLevel: 2,
      expInCurrentLevel: 999,
      expNeededForNextLevel: 100,
      progress: 120,
      totalExp: 999
    }, { width: 5 }));

    assert.match(text, /Lv 2 /);
    assert.match(text, / Lv 3/);
    assert.match(text, /999\/100 XP/);
    assert.match(text, /\(100%\)/);
    assert.match(text, /Total XP: 999/);
    assert.match(text, /█{5}/);
  });
});
