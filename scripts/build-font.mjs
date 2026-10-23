import { readFile, writeFile } from 'node:fs/promises';
import opentype from 'opentype.js';

const bytes = await readFile(new URL('../public/fonts/LiberationSans-Bold.ttf', import.meta.url));
const font = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const scale = 1000 / font.unitsPerEm;
const coordinate = (value) => Math.round(value * scale);
const glyphs = {};
for (const character of new Set('h4ngelic? ')) {
  const glyph = font.charToGlyph(character);
  const outline = glyph.path.commands.map((command) => {
    const { type, x, y, x1, y1, x2, y2 } = command;
    if (type === 'Z') return '';
    if (type === 'M' || type === 'L') return `${type.toLowerCase()} ${coordinate(x)} ${coordinate(y)}`;
    if (type === 'Q') return `q ${coordinate(x)} ${coordinate(y)} ${coordinate(x1)} ${coordinate(y1)}`;
    return `b ${coordinate(x)} ${coordinate(y)} ${coordinate(x1)} ${coordinate(y1)} ${coordinate(x2)} ${coordinate(y2)}`;
  }).join(' ');
  glyphs[character] = { ha: coordinate(glyph.advanceWidth), x_min: coordinate(glyph.xMin || 0), x_max: coordinate(glyph.xMax || 0), o: outline };
}
await writeFile(new URL('../public/fonts/wordmark.typeface.json', import.meta.url), JSON.stringify({
  glyphs, familyName: 'Liberation Sans', resolution: 1000,
  ascender: coordinate(font.ascender), descender: coordinate(font.descender),
  boundingBox: { yMin: coordinate(font.tables.head.yMin), yMax: coordinate(font.tables.head.yMax) },
  underlineThickness: 50,
}));
