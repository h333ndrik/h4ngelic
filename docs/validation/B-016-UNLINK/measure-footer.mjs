/** B-016 — footer geometry with the legal link removed.
 *
 * Records every item of both clusters (box, height, gap to its neighbour), the
 * resolved cluster gap, the NAAVI centring and the absence of any legal link in
 * the normal and the Other Side footer.
 *
 *   H4_BASE_URL=http://127.0.0.1:55241 node docs/validation/B-016-UNLINK/measure-footer.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55241';
const output = new URL('./', import.meta.url);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = { checkedAt: new Date().toISOString(), base, build: '', profiles: [] };
const round = value => Math.round(value * 100) / 100;

const read = () => {
  const box = element => { const rect = element.getBoundingClientRect();
    return { left: Math.round(rect.left * 100) / 100, right: Math.round(rect.right * 100) / 100,
      top: Math.round(rect.top * 100) / 100, bottom: Math.round(rect.bottom * 100) / 100, height: Math.round(rect.height * 100) / 100 }; };
  const describe = element => `${element.tagName.toLowerCase()}${element.className ? `.${String(element.className).trim().replace(/\s+/g, '.')}` : ''}`;
  const clusters = [...document.querySelectorAll('.footer-left, .footer-details')].map(cluster => {
    const style = getComputedStyle(cluster);
    const items = [...cluster.children].filter(child => !child.matches('[data-smash-slot]:empty')).map(child => ({ element: describe(child), ...box(child) }));
    const gaps = items.slice(1).map((item, index) => Math.round((item.left - items[index].right) * 100) / 100);
    return { element: describe(cluster), ...box(cluster), columnGap: style.columnGap,
      tokenGap: style.getPropertyValue('--cluster-gap').trim(), items, gaps };
  });
  const identity = document.querySelector('.footer-identity').getBoundingClientRect();
  const naavi = document.querySelector('[data-naavi]')?.getBoundingClientRect();
  return {
    build: document.documentElement.dataset.build || null,
    zone: { top: Math.round(identity.top * 100) / 100, bottom: Math.round(identity.bottom * 100) / 100, height: Math.round(identity.height * 100) / 100 },
    naaviCentred: naavi ? Math.round((naavi.top + naavi.height / 2 - (identity.top + identity.height / 2)) * 100) / 100 : null,
    clusters,
    legalLinks: document.querySelectorAll('.footer-impressum, [data-other-side-imprint-slot], a[href*="impressum"]').length,
    pageWidth: document.documentElement.scrollWidth,
  };
};

try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: width > 1000 ? 950 : 844 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    await page.goto(new URL('/', base).href, { waitUntil: 'networkidle' });
    await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    await page.waitForTimeout(350);
    const normal = await page.evaluate(read);
    report.build ||= normal.build;
    await page.keyboard.down('4');
    await page.waitForFunction(() => document.documentElement.dataset.mode === 'xray', null, { timeout: 60000 });
    await page.keyboard.up('4');
    await page.waitForFunction(() => !document.documentElement.hasAttribute('data-mode-snapshot') && !document.documentElement.hasAttribute('data-xray-transition'));
    const other = await page.evaluate(read);
    report.profiles.push({ width, normal, other });
    console.log(`${width}: normal legal links ${normal.legalLinks}, other side ${other.legalLinks}, zone ${normal.zone.height}px, naavi ${normal.naaviCentred}px, gaps ` +
      `${normal.clusters.map(cluster => `${cluster.element} ${cluster.columnGap} [${cluster.gaps.join(', ')}]`).join(' | ')}`);
    await context.close();
  }
} finally {
  await mkdir(output, { recursive: true });
  await writeFile(new URL('footer-geometry.json', output), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
