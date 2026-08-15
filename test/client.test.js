import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import ApiClient, { parsePositiveId } from '../api/client.js';
import { CharacterService } from '../commands/character.js';

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

describe('ApiClient base URL selection', () => {
  const origUrl = process.env.COMMITQUEST_API_URL;
  const origDev = process.env.COMMITQUEST_DEV;
  const origNodeEnv = process.env.NODE_ENV;

  function restoreEnv() {
    if (origUrl === undefined) delete process.env.COMMITQUEST_API_URL;
    else process.env.COMMITQUEST_API_URL = origUrl;
    if (origDev === undefined) delete process.env.COMMITQUEST_DEV;
    else process.env.COMMITQUEST_DEV = origDev;
    if (origNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origNodeEnv;
  }

  it('does not treat NODE_ENV=development as local API', () => {
    delete process.env.COMMITQUEST_API_URL;
    delete process.env.COMMITQUEST_DEV;
    process.env.NODE_ENV = 'development';
    try {
      const client = new ApiClient();
      assert.match(client.baseURL, /herokuapp\.com/);
    } finally {
      restoreEnv();
    }
  });

  it('uses localhost when COMMITQUEST_DEV=1', () => {
    delete process.env.COMMITQUEST_API_URL;
    process.env.COMMITQUEST_DEV = '1';
    try {
      const client = new ApiClient();
      assert.equal(client.baseURL, 'http://localhost:3001/api');
    } finally {
      restoreEnv();
    }
  });
});

describe('character emoji helpers', () => {
  it('uses genderless emoji sequences', () => {
    assert.equal(CharacterService.getClassEmoji('scout'), '🏃');
    assert.equal(CharacterService.getSpeciesEmoji('elf'), '🧝');
    assert.doesNotMatch(CharacterService.getClassEmoji('scout'), /\u200d/);
    assert.doesNotMatch(CharacterService.getSpeciesEmoji('elf'), /\u200d/);
  });

  it('handles missing names without throwing', () => {
    assert.equal(CharacterService.getClassEmoji(undefined), '⚔️');
    assert.equal(CharacterService.getSpeciesEmoji(null), '👤');
  });
});
