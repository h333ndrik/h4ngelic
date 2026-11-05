import { readFile } from 'node:fs/promises';

/** The single source of truth stays cursor.css: suites read the tokens instead
 * of repeating file names, hotspots or fallback keywords. */
const css = await readFile(new URL('../../src/cursor.css', import.meta.url), 'utf8');

const parseToken = (name) => {
  const definition = css.match(new RegExp(`(?:^|[;{])\\s*${name}\\s*:\\s*([^;]+);`, 'm'));
  if (!definition) throw new Error(`cursor.css must define ${name}.`);
  const value = definition[1].trim();
  const images = [...value.matchAll(/url\('([^']+)'\)\s+(\d+)\s+(\d+)/g)]
    .map(match => ({ path: match[1], hotspot: `${match[2]} ${match[3]}` }));
  const keyword = value.split(',').pop().trim();
  if (images.length !== 2) throw new Error(`${name} needs an svg and a png fallback.`);
  return { value, svg: images[0], png: images[1], keyword };
};

export const CURSOR_TOKENS = Object.freeze({
  '--h4-cursor': parseToken('--h4-cursor'),
  '--h4-cursor-interactive': parseToken('--h4-cursor-interactive'),
  '--h4-cursor-pressed': parseToken('--h4-cursor-pressed'),
  '--h4-cursor-xray': parseToken('--h4-cursor-xray'),
  '--h4-cursor-xray-pressed': parseToken('--h4-cursor-xray-pressed'),
});

/** Chromium needs the capability query, not the viewport, to decide the cursor. */
export const CURSOR_MEDIA = '(any-hover: hover) and (any-pointer: fine)';
export const NORMAL_CURSORS = Object.freeze([CURSOR_TOKENS['--h4-cursor'], CURSOR_TOKENS['--h4-cursor-interactive'], CURSOR_TOKENS['--h4-cursor-pressed']]);
export const XRAY_CURSORS = Object.freeze([CURSOR_TOKENS['--h4-cursor-xray'], CURSOR_TOKENS['--h4-cursor-xray-pressed']]);

export const cursorSpec = Object.freeze({
  media: CURSOR_MEDIA,
  normal: NORMAL_CURSORS.map(token => ({ svg: token.svg.path, png: token.png.path, hotspot: token.svg.hotspot })),
  xray: XRAY_CURSORS.map(token => ({ svg: token.svg.path, png: token.png.path, hotspot: token.svg.hotspot })),
});

function parse(value) {
  const images = [...value.matchAll(/url\(["']?([^"')]+)["']?\)\s+(\d+)\s+(\d+)/g)]
    .map(match => ({ path: match[1], name: match[1].split('/').pop(), hotspot: `${match[2]} ${match[3]}` }));
  return { images, keyword: value.split(',').pop().trim() };
}

/** Verifies one computed cursor string against the allowed native families.
 * `system` expects no h4 artwork and rejects `none`, so a blocked stylesheet
 * cannot silently hide every pointer. */
export function matchesContract(value, { mode, spec }) {
  const parsed = parse(value);
  if (mode === 'system') return value !== 'none' && !parsed.images.some(image => /h4ngelic-cursor/.test(image.name));
  const allowed = spec[mode];
  if (!allowed) return false;
  const first = parsed.images[0];
  if (!first) return false;
  const token = allowed.find(item => item.svg.endsWith(first.name));
  if (!token) return false;
  if (first.hotspot !== token.hotspot) return false;
  const second = parsed.images[1];
  if (!second || !second.name.endsWith(token.png.split('/').pop())) return false;
  if (second.hotspot !== token.hotspot) return false;
  if (!['auto', 'pointer'].includes(parsed.keyword)) return false;
  return value !== 'none';
}

/** Enumerates every painted element. The native cursor has no runtime gate, so
 * the only legitimate "system" branch is a device without a fine pointer. */
export async function findCursorOffenders(page, { mode = 'auto' } = {}) {
  return page.evaluate(({ requestedMode, spec }) => {
    const html = document.documentElement;
    const capability = matchMedia(spec.media).matches;
    const resolved = requestedMode !== 'auto' ? requestedMode
      : !capability ? 'system' : html.dataset.mode === 'xray' ? 'xray' : 'normal';
    const offenders = [];
    const elements = [...document.querySelectorAll('body, body *')];
    for (const element of elements) {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || box.width <= 0 || box.height <= 0) continue;
      const cursor = style.cursor;
      const images = [...cursor.matchAll(/url\(["']?([^"')]+)["']?\)\s+(\d+)\s+(\d+)/g)]
        .map(match => ({ path: match[1], name: match[1].split('/').pop(), hotspot: `${match[2]} ${match[3]}` }));
      const keyword = cursor.split(',').pop().trim();
      let ok;
      if (resolved === 'system') {
        ok = cursor !== 'none' && !images.some(image => /h4ngelic-cursor/.test(image.name));
      } else {
        const allowed = spec[resolved];
        const first = images[0];
        const token = first && allowed.find(item => item.svg.endsWith(first.name));
        const second = images[1];
        ok = Boolean(token && first.hotspot === token.hotspot && second
          && second.name.endsWith(token.png.split('/').pop()) && second.hotspot === token.hotspot
          && ['auto', 'pointer'].includes(keyword));
      }
      if (!ok) {
        offenders.push({ tag: element.tagName.toLowerCase(), className: String(element.className || ''),
          id: element.id, cursor });
      }
    }
    return { mode: resolved, capability, total: elements.length, offenders };
  }, { requestedMode: mode, spec: cursorSpec });
}

export async function cursorOf(locator, { mode = 'auto' } = {}) {
  return locator.evaluate((element, { requestedMode, spec }) => {
    const html = document.documentElement;
    const capability = matchMedia(spec.media).matches;
    const resolved = requestedMode !== 'auto' ? requestedMode
      : !capability ? 'system' : html.dataset.mode === 'xray' ? 'xray' : 'normal';
    return { cursor: getComputedStyle(element).cursor, mode: resolved, capability };
  }, { requestedMode: mode, spec: cursorSpec }).then(result => {
    const images = [...result.cursor.matchAll(/url\(["']?([^"')]+)["']?\)\s+(\d+)\s+(\d+)/g)]
      .map(match => ({ name: match[1].split('/').pop(), hotspot: `${match[2]} ${match[3]}` }));
    const keyword = result.cursor.split(',').pop().trim();
    const allowed = cursorSpec[result.mode];
    const first = images[0];
    const token = allowed && first && allowed.find(item => item.svg.endsWith(first.name));
    const second = images[1];
    const ok = result.mode === 'system'
      ? result.cursor !== 'none' && !images.some(image => /h4ngelic-cursor/.test(image.name))
      : Boolean(token && first.hotspot === token.hotspot && second
        && second.name.endsWith(token.png.split('/').pop()) && second.hotspot === token.hotspot
        && ['auto', 'pointer'].includes(keyword));
    return { ...result, keyword, images, ok };
  });
}
