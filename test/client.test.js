import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parsePositiveId } from '../api/client.js';

describe('parsePositiveId', () => {
  it('accepts positive integers', () => {
    assert.equal(parsePositiveId(5, 'class_id'), 5);
    assert.equal(parsePositiveId('5', 'class_id'), 5);
  });

  it('rejects class names sent instead of ids', () => {
    assert.throws(
      () => parsePositiveId('Data Druid', 'class_id'),
      /must be a positive integer/
    );
  });

  it('rejects missing values', () => {
    assert.throws(() => parsePositiveId(undefined, 'species_id'), /required/);
    assert.throws(() => parsePositiveId(null, 'species_id'), /required/);
  });

  it('rejects zero and negative numbers', () => {
    assert.throws(() => parsePositiveId(0, 'class_id'), /must be a positive integer/);
    assert.throws(() => parsePositiveId(-1, 'class_id'), /must be a positive integer/);
  });
});
