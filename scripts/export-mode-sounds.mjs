import { writeFile, mkdir } from 'node:fs/promises';
import { synthesizeModeSound } from '../src/mode-audio.js';
import { modeAudioSettings } from '../src/data/modeAudioSettings.js';
await mkdir(new URL('../artifacts/sound-review/', import.meta.url), { recursive: true });
for (const [mode, label] of [['xray', 'enter'], ['normal', 'leave']]) {
  const sound = synthesizeModeSound(mode);
  const count = sound.channels.length;
  const length = sound.channels[0].length;
  const bytes = length * count * 2;
  const output = Buffer.alloc(44 + bytes);
  output.write('RIFF', 0); output.writeUInt32LE(36 + bytes, 4); output.write('WAVEfmt ', 8);
  output.writeUInt32LE(16, 16); output.writeUInt16LE(1, 20); output.writeUInt16LE(count, 22);
  output.writeUInt32LE(sound.sampleRate, 24); output.writeUInt32LE(sound.sampleRate * count * 2, 28);
  output.writeUInt16LE(count * 2, 32); output.writeUInt16LE(16, 34); output.write('data', 36); output.writeUInt32LE(bytes, 40);
  let offset = 44;
  for (let index = 0; index < length; index++) for (let channel = 0; channel < count; channel++) {
    output.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sound.channels[channel][index] * modeAudioSettings.volume)) * 32767), offset);
    offset += 2;
  }
  const destination = new URL(`../artifacts/sound-review/other-side-${label}.wav`, import.meta.url);
  await writeFile(destination, output);
  console.log(`Exported ${destination.pathname}: ${sound.duration}s, ${output.length} bytes.`);
}
