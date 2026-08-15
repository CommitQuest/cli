import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import stripAnsi from 'strip-ansi';
import {
  box,
  compactBanner,
  errorBanner,
  resolvePanelWidth,
  visibleWidth,
  wrapToWidth,
} from '../commands/theme.js';

function assertRectangular(frame) {
  const lines = stripAnsi(frame).split('\n');
  assert.ok(lines.length >= 2, 'frame should have multiple lines');
  const width = visibleWidth(lines[0]);
  for (const line of lines) {
    assert.equal(
      visibleWidth(line),
      width,
      `line width mismatch:\n${lines.join('\n')}\n---`
    );
  }
}

describe('visibleWidth', () => {
  it('counts emoji as wide characters', () => {
    assert.equal(visibleWidth('🔑'), 2);
    assert.equal(visibleWidth('OK'), 2);
  });
});

describe('box layout', () => {
  it('keeps left and right edges aligned', () => {
    const frame = box(
      ['  Enter this code in your browser:', '', '  ABCD-EFGH', '', '  https://example.com/path'],
      { title: 'Verification', width: 40, style: 'double', color: 'gold' }
    );
    assertRectangular(frame);
  });

  it('wraps long lines without breaking the frame', () => {
    const frame = errorBanner('Authentication failed.', [
      'This is a very long detail line that should wrap cleanly inside the panel instead of pushing the right border out of place.',
      '• Finished within the code expiration window',
    ]);
    assertRectangular(frame);
  });

  it('renders compactBanner as a perfect rectangle', () => {
    assertRectangular(compactBanner('Login'));
  });
});

describe('resolvePanelWidth', () => {
  it('never exceeds the terminal width budget', () => {
    const original = process.stdout.columns;
    process.stdout.columns = 40;
    try {
      assert.ok(resolvePanelWidth(80) <= 36);
      assert.ok(resolvePanelWidth(80) >= 24);
    } finally {
      process.stdout.columns = original;
    }
  });
});

describe('wrapToWidth', () => {
  it('splits oversized text into display-width safe chunks', () => {
    const lines = wrapToWidth('abcdefghijklmnopqrstuvwxyz', 10);
    assert.ok(lines.length > 1);
    for (const line of lines) {
      assert.ok(visibleWidth(line) <= 10);
    }
  });
});
