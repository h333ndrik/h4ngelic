import { readFile, stat } from 'node:fs/promises';

const source = new URL('../public/fonts/LiberationSans-Bold.ttf', import.meta.url);
const runtime = new URL('../public/fonts/wordmark.typeface.json', import.meta.url);
const [sourceStat, runtimeStat, payload] = await Promise.all([stat(source), stat(runtime), readFile(runtime, 'utf8')]);
const font = JSON.parse(payload);
const glyphs = Object.keys(font.glyphs || {});
const used = [...new Set('h4ngelic? ')];
const report = {
  sourceBytes: sourceStat.size,
  runtimeBytes: runtimeStat.size,
  runtimeGlyphCount: glyphs.length,
  runtimeGlyphs: glyphs,
  usedGlyphs: used,
  unusedRuntimeGlyphs: glyphs.filter(character => !used.includes(character)),
  savedBytes: sourceStat.size - runtimeStat.size,
  action: sourceStat.size - runtimeStat.size > 50 * 1024 && glyphs.length > used.length ? 'subset' : 'no subset needed: the served font is already glyph-limited',
};
console.log(JSON.stringify(report, null, 2));
