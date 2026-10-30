import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { modeAudioSettings } from '../src/data/modeAudioSettings.js';

test('the published SMASH file is the exact user-supplied V11, byte-for-byte', async () => {
  const data = await readFile(new URL('../public/audio/h4ngelic_v8_full_sound_remaster_v11.mp3', import.meta.url));
  assert.equal(data.byteLength, 3210973);
  assert.equal(createHash('sha256').update(data).digest('hex'), '307f48dcb643ed1c0c8d8ef39d4ef3dcbeefa1f42286cdae5c81d965db268e1b');
  assert.equal(modeAudioSettings.smashURL, '/audio/h4ngelic_v8_full_sound_remaster_v11.mp3');
});
