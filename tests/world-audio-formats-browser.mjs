import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:5173';
const output = new URL('../artifacts/world-audio-formats/', import.meta.url);
await mkdir(output, { recursive: true });
const masters = [
  { name: 'loop-333', frames: 3969000, loop: true },
  { name: 'loop-4', frames: 3969000, loop: true },
  { name: 'x-333-4', frames: 39690, loop: false },
  { name: 'x-4-333', frames: 39690, loop: false },
];
const expected = masters.map(asset => ({ ...asset, format: 'm4a', path: `/assets/audio/${asset.name}.m4a` }));
const extraDirectory = process.env.H4_WORLD_AUDIO_EXTRA_DIR;
if (extraDirectory) {
  for (const asset of masters) {
    for (const format of ['flac', 'wav']) {
      expected.push({ ...asset, format, path: `${extraDirectory.replace(/\/$/, '')}/${asset.name}.${format}` });
    }
  }
}
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, reducedMotion: 'reduce' });
  await context.addInitScript(() => {
    window.__formatProbe = { errors: [], longTasks: [] };
    try {
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) window.__formatProbe.longTasks.push(entry.duration);
      }).observe({ type: 'longtask', buffered: true });
    } catch { /* The browser can omit the optional long-task API. */ }
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(new URL('/work/tattoos?test=1', base).href, { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
  const longTaskStart = await page.evaluate(() => window.__formatProbe.longTasks.length);
  const reports = await page.evaluate(async (assets) => {
    const context = new OfflineAudioContext(2, 44100, 44100);
    const results = [];
    for (const asset of assets) {
      const response = await fetch(asset.path, { cache: 'no-store' });
      if (!response.ok) throw new Error(`${asset.path}: HTTP ${response.status}`);
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
      const boundaries = channels.map(channel => {
        let head = 0, tail = 0, step = 0;
        // The seam gate is defined over 250 ms either side of the loop point.
        const seamFrames = Math.min(11025, Math.floor(channel.length / 2));
        const tailStart = Math.max(0, channel.length - seamFrames);
        for (let index = 0; index < channel.length; index++) {
          if (index < seamFrames) head += channel[index] ** 2;
          if (index >= tailStart) tail += channel[index] ** 2;
          if (index) step += Math.abs(channel[index] - channel[index - 1]);
        }
        return {
          first: channel[0], last: channel[channel.length - 1],
          seam: Math.abs(channel[0] - channel[channel.length - 1]),
          meanStep: step / Math.max(1, channel.length - 1),
          head250msRms: Math.sqrt(head / seamFrames),
          tail250msRms: Math.sqrt(tail / Math.max(1, channel.length - tailStart)),
        };
      });
      const seamFrames = Math.min(11025, Math.floor(buffer.length / 2));
      let headEnergy = 0, tailEnergy = 0;
      for (const channel of channels) {
        for (let index = 0; index < seamFrames; index++) headEnergy += channel[index] ** 2;
        for (let index = buffer.length - seamFrames; index < buffer.length; index++) tailEnergy += channel[index] ** 2;
      }
      results.push({ path: asset.path, format: asset.format, sampleRate: buffer.sampleRate, channels: buffer.numberOfChannels,
        frames: buffer.length, duration: buffer.duration, boundaries,
        head250msRms: Math.sqrt(headEnergy / (seamFrames * channels.length)),
        tail250msRms: Math.sqrt(tailEnergy / (seamFrames * channels.length)) });
    }
    return results;
  }, expected);

  for (let index = 0; index < expected.length; index++) {
    const asset = expected[index], report = reports[index];
    assert.equal(report.sampleRate, 44100, `${asset.path} must decode at 44.1 kHz.`);
    assert.equal(report.channels, 2, `${asset.path} must remain stereo.`);
    assert.equal(report.frames, asset.frames, `${asset.path} must decode with no encoder padding.`);
    assert.ok(Math.abs(report.duration - asset.frames / 44100) < 1e-9);
    if (asset.loop) {
      for (const channel of report.boundaries) {
        assert.ok(channel.seam <= Math.max(.1, channel.meanStep * 6),
          `${asset.path} wrap step must stay within ordinary sample-to-sample movement.`);
      }
      assert.ok(report.head250msRms > 0 && report.tail250msRms > 0, `${asset.path} cannot have a zero head/tail fade.`);
      const tailRatioDb = 20 * Math.log10(report.head250msRms / report.tail250msRms);
      assert.ok(Math.abs(tailRatioDb) <= 1,
        `${asset.path} the first and last 250 ms must sit at the same level (${tailRatioDb.toFixed(2)} dB).`);
    }
  }
  const longTasksDuringDecode = await page.evaluate(start => window.__formatProbe.longTasks.slice(start), longTaskStart);
  assert.deepEqual(errors, []);
  assert.deepEqual(longTasksDuringDecode, [], 'Audio fetch/decode must add no main-thread long task.');
  const evidence = { checkedAt: new Date().toISOString(), base, expected, reports, longTasksDuringDecode, errors };
  await writeFile(new URL('results.json', output), JSON.stringify(evidence, null, 2));
  console.log(`PASS world audio formats: ${expected.length} files decode at exact master frame counts with continuous non-zero loop boundaries and no audio-path long tasks.`);
  await context.close();
} finally { await browser.close(); }
