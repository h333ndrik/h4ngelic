/** B-F25 evidence screenshots. Run against the local production preview. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const base = process.env.H4_BASE_URL || 'http://127.0.0.1:55232';
const output = new URL('./screens/', import.meta.url);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || chromium.executablePath(), headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const shots = [
  { name: 'frontpage-1440', page: '/', selector: '.category-strip', width: 1440, height: 900 },
  { name: 'frontpage-2560', page: '/', selector: '.category-strip', width: 2560, height: 1200 },
  { name: 'frontpage-390', page: '/', selector: '.category-strip', width: 390, height: 844 },
  { name: 'cross-links-tattoos-1440', page: '/creative/tattoos', selector: '.rubric-cross-links', width: 1440, height: 900 },
  { name: 'cross-links-jewellery-390', page: '/creative/jewellery', selector: '.rubric-cross-links', width: 390, height: 844 },
  { name: 'filters-1440', page: '/creative', selector: '.work-filters', width: 1440, height: 900 },
  { name: 'filters-390', page: '/creative', selector: '.work-filters', width: 390, height: 844 },
  { name: 'footer-1440', page: '/creative', selector: '.page-footer', width: 1440, height: 900 },
];
for (const shot of shots) {
  const context = await browser.newContext({ viewport: { width: shot.width, height: shot.height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(new URL(shot.page, base).href, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.dataset.h4StylesReady === 'true');
  const target = page.locator(shot.selector);
  await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await target.screenshot({ path: new URL(`${shot.name}.png`, output).pathname });
  console.log('shot', shot.name);
  await context.close();
}
await browser.close();
