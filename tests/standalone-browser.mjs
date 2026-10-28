import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

const htmlPath = new URL('../artifacts/h4ngelic-preview.html', import.meta.url);
const html = await readFile(htmlPath, 'utf8');
assert.match(html, /data-preview="standalone"/, 'Check the exported standalone HTML, not a server shell.');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const reports = [];

async function waitMode(page, mode) {
  await page.waitForFunction(expected => document.documentElement.dataset.mode === expected
    && !document.documentElement.hasAttribute('data-xray-transition')
    && !document.documentElement.hasAttribute('data-mode-snapshot'), mode, { timeout: 10000 });
}

async function routeNavigate(page, name) {
  const previousVisit = await page.locator('[data-visit-number]').textContent();
  const current = await page.locator('html').getAttribute('data-page');
  if (name === 'contact' && current === 'about') {
    await page.locator('.about-copy a[href="#/#contact"]').click();
  } else if (name === 'home') {
    await page.locator('[data-floating-brand]').click();
  } else {
    await page.locator('[data-global-index] summary').click();
    await page.locator(`[data-index-page="${name}"]`).click();
  }
  await page.waitForFunction(expected => document.documentElement.dataset.page === expected, name === 'contact' ? 'home' : name);
  if (name === 'contact') await page.waitForFunction(() => location.hash === '#/#contact'
    && document.querySelector('#contact').getBoundingClientRect().top < innerHeight);
  assert.equal(await page.locator('[data-visit-number]').textContent(), previousVisit, 'Routes do not count as new visits.');
  assert.equal(await page.locator('[data-naavi]').count(), 1);
  assert.equal(await page.locator('[data-naavi]').isVisible(), true);
  assert.equal(await page.locator('[data-floating-brand]').isVisible(), true);
  assert.equal(await page.locator('[data-global-index]').evaluate(element => element.open), false, 'Choosing a destination closes INDEX.');
}

async function enterWith4(page) {
  await page.keyboard.down('4');
  try { await waitMode(page, 'xray'); }
  finally { await page.keyboard.up('4'); }
}

async function reverseWith3(page) {
  for (let index = 0; index < 3; index++) await page.keyboard.press('3');
  await waitMode(page, 'normal');
}

async function identityGeometry(page) {
  return page.locator('.footer-identity').evaluate(row => {
    const box = element => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right,
        centerX: rect.left + rect.width / 2, centerY: rect.top + rect.height / 2 };
    };
    const counter = row.querySelector('[data-visit-counter-hotspot]');
    return { row: box(row), counter: box(counter), counterInRow: counter.parentElement === row,
      brand: box(row.querySelector('.footer-brand')), location: box(row.querySelector('.footer-details')) };
  });
}

async function touchHold(context, page, mode) {
  const hint = page.locator('[data-other-side-hint][data-mode-hold]');
  await hint.scrollIntoViewIfNeeded();
  const box = await hint.boundingBox();
  assert.ok(box && box.width >= 44 && box.height >= 44);
  const session = await context.newCDPSession(page);
  try {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
    await waitMode(page, mode);
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally {
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }).catch(() => {});
    await session.detach();
  }
}

try {
  for (const width of [1440, 390, 320]) {
    const mobile = width < 600;
    const context = await browser.newContext({ viewport: { width, height: mobile ? 844 : 1000 },
      deviceScaleFactor: 1, reducedMotion: 'reduce', isMobile: mobile, hasTouch: mobile });
    try {
      const page = await context.newPage();
      const errors = [];
      const requests = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route(/^https?:/, route => { requests.push(route.request().url()); return route.abort(); });
      await page.setContent(html, { waitUntil: 'load' });
      await page.evaluate(() => {
        window.__offlineMemoryHandoffs = [];
        let preparedPixels = null;
        document.addEventListener('h4:memoryhandoff', event => {
          const canvas = document.querySelector('[data-corruption-ambient]');
          const snapshot = event.detail.snapshot;
          const pixels = canvas?.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
          if (event.detail.phase === 'prepared') preparedPixels = pixels?.slice();
          const matchesPrepared = event.detail.phase === 'released'
            ? Boolean(preparedPixels && pixels?.length === preparedPixels.length && pixels.every((value, index) => value === preparedPixels[index])) : null;
          if (event.detail.phase === 'released') preparedPixels = null;
          let hash = 2166136261, opaque = true;
          const colors = new Set();
          for (let index = 0; pixels && index < pixels.length; index += 4) {
            colors.add((pixels[index] << 16) | (pixels[index + 1] << 8) | pixels[index + 2]);
            opaque &&= pixels[index + 3] === 255;
            for (let channel = 0; channel < 4; channel++) hash = Math.imul(hash ^ pixels[index + channel], 16777619) >>> 0;
          }
          window.__offlineMemoryHandoffs.push({ phase: event.detail.phase, token: event.detail.token,
            pixelHash: hash, colors: colors.size, opaque, matchesPrepared,
            snapshot: snapshot && { buffers: snapshot.buffers, recoverySource: snapshot.recoverySource,
              cleanSourceRetained: snapshot.cleanSourceRetained, sourceInitializations: snapshot.sourceInitializations,
              transition: snapshot.transition, queued: snapshot.queued, frames: snapshot.frames } });
        });
      });
      await page.locator('#stage.is-ready').waitFor({ timeout: 60000 });
      await waitMode(page, 'normal');
      assert.equal(await page.locator('[data-end-reveal]').count(), 1);
      assert.equal(await page.locator('.end-reveal-mark').evaluate(mark => Number(getComputedStyle(mark).opacity)), 0, 'End mark must remain invisible at the hero.');
      assert.equal(await page.locator('.identity, .masthead .edition, #reveal-control, .brand-link, .hero-brand').count(), 0);
      assert.equal(await page.locator('[data-floating-brand]').count(), 1);
      assert.equal(await page.locator('[data-global-index]').count(), 1);
      assert.equal(await page.locator('[data-global-index] summary').textContent(), '+');
      await page.locator('[data-global-index] summary').click();
      assert.equal(await page.locator('[data-global-index]').evaluate(element => element.open), true);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('[data-global-index]').evaluate(element => element.open), false);
      assert.equal(await page.locator('[data-xray-hint-text]').textContent(), 'HOLD 4 TO SEE THE OTHER SIDE.');
      assert.equal(await page.locator('[data-visit-counter-hotspot]').count(), 1);
      const identity = await identityGeometry(page);
      assert.equal(identity.counterInRow, true, 'The visit counter belongs to the existing identity row.');
      assert.ok(identity.counter.left - identity.brand.right >= 18 && identity.counter.left - identity.brand.right <= 48,
        'The local visit count has generous spacing beside the copyright.');
      assert.ok(Math.abs(identity.brand.centerY - identity.counter.centerY) < .5,
        'Copyright and VISIT share one baseline.');
      assert.ok(width < 600 || identity.counter.right + 3 <= identity.location.left,
        'Desktop footer details must not overlap VISIT.');
      assert.equal(await page.locator('[data-visit-number]').evaluate(element => Number(getComputedStyle(element).opacity)), 1,
        'VISIT is visible without having to discover its hotspot.');
      assert.equal(await page.locator('.corruption-background,[data-corruption-region]').count(), 0,
        'Ordinary offline startup must not initialize corruption surfaces.');

      await page.keyboard.down('4');
      await page.waitForTimeout(800);
      await page.keyboard.up('4');
      await page.waitForTimeout(300);
      assert.equal(await page.locator('html').getAttribute('data-mode'), 'normal', 'A short hold cancels offline as well.');

      const hint = page.locator('[data-other-side-hint][data-mode-hold]');
      if (mobile) {
        await hint.scrollIntoViewIfNeeded();
        await hint.tap();
        await page.waitForTimeout(1100);
        assert.equal(await page.locator('html').getAttribute('data-mode'), 'normal', 'A short touch tap only discovers the instruction.');
        await touchHold(context, page, 'xray');
      } else await enterWith4(page);

      await page.locator('.corruption-background').waitFor({ state: 'attached', timeout: 20000 });
      const memoryHandoff = await page.evaluate(() => {
        const background = document.querySelector('.corruption-background');
        const canvas = background.querySelector('[data-corruption-ambient]');
        return { ready: document.documentElement.hasAttribute('data-memory-mosh-ready'),
          canvasCount: background.querySelectorAll('canvas').length, hidden: canvas.hidden,
          width: canvas.width, height: canvas.height, opacity: getComputedStyle(background).opacity,
          backgroundImage: getComputedStyle(background).backgroundImage,
          distressHidden: [...document.querySelectorAll('.xray-distress')].every(element => getComputedStyle(element).display === 'none'),
          events: window.__offlineMemoryHandoffs };
      });
      assert.equal(memoryHandoff.ready, true);
      assert.equal(memoryHandoff.canvasCount, 1);
      assert.equal(memoryHandoff.hidden, false);
      assert.ok(memoryHandoff.width > 1 && memoryHandoff.height > 1);
      assert.equal(memoryHandoff.opacity, '1');
      assert.equal(memoryHandoff.backgroundImage, 'none', 'No pristine CSS source may sit beneath retained memory.');
      assert.equal(memoryHandoff.distressHidden, true);
      assert.deepEqual(memoryHandoff.events.map(event => event.phase), ['prepared', 'released']);
      const [prepared, released] = memoryHandoff.events;
      assert.deepEqual(prepared.token, released.token);
      assert.equal(released.matchesPrepared, true, 'Every prepared pixel must survive the offline handoff unchanged.');
      assert.equal(prepared.pixelHash, released.pixelHash, 'Offline activation must retain the exact prepared pixels.');
      assert.ok(released.colors > 4 && released.opaque, 'Embedded material must seed a nonblank opaque damaged frame.');
      assert.equal(released.snapshot.buffers, 2);
      assert.equal(released.snapshot.recoverySource, 'history');
      assert.equal(released.snapshot.cleanSourceRetained, false);
      assert.equal(released.snapshot.sourceInitializations, 1);
      assert.equal(released.snapshot.queued, false, 'Reduced-motion offline memory stays static.');
      assert.equal(released.snapshot.transition.claimedFrame, prepared.snapshot.frames);
      assert.equal(await page.locator('[data-xray-hint-text]').textContent(), 'HOLD 4 TO REVERSE.');
      await page.waitForTimeout(1100);
      assert.equal(await page.locator('html').getAttribute('data-mode'), 'xray', 'Hold completion/release cannot toggle twice.');
      await page.keyboard.down('4');
      try { await waitMode(page, 'normal'); } finally { await page.keyboard.up('4'); }
      assert.equal(await page.locator('html').getAttribute('data-mode'), 'normal', 'V6 allows a fresh one-second 4 hold to reverse.');
      await enterWith4(page);
      await page.evaluate(() => document.activeElement?.blur());
      await page.mouse.move(2, 2);
      await page.waitForTimeout(2700);
      const reverseHint = await hint.evaluate(element => ({
        opacity: Number(getComputedStyle(element.querySelector('[data-secret-message]')).opacity),
        color: getComputedStyle(element).color, fontSize: parseFloat(getComputedStyle(element).fontSize),
      }));
      assert.ok(reverseHint.opacity < .01, 'The reverse hint fades away in both realities after discovery expires.');
      assert.equal(reverseHint.color, 'rgb(255, 255, 255)');
      assert.ok(reverseHint.fontSize >= 15 && reverseHint.fontSize <= 21);

      const mute = page.locator('[data-controls] [data-mode-mute]');
      assert.equal(await mute.count(), 1);
      assert.equal(await page.locator('[data-mode-mute]').count(), 1);
      assert.equal(await page.locator('[data-artist-footer] [data-mode-mute]').count(), 0);
      await mute.scrollIntoViewIfNeeded();
      assert.equal(await mute.isVisible(), true, 'Mute is an actual visible lower-hero control.');
      if (await mute.isEnabled()) {
        if (mobile) await mute.tap(); else await mute.click();
        assert.equal(await mute.getAttribute('aria-pressed'), 'true');
      }
      await page.locator('#selected-work a').first().click();
      await page.waitForFunction(() => document.documentElement.dataset.page === 'work');
      await page.waitForFunction(() => document.querySelector('.work-filters a[aria-current="location"]')?.textContent.trim() === 'tattoos');
      assert.equal(await page.locator('#logo-canvas').isVisible(), false);
      assert.equal(await page.locator('[data-archive-category="tattoos"] .archive-empty').textContent(), 'archive in progress.');
      assert.equal(await page.locator('html').getAttribute('data-mode'), 'xray');
      assert.equal(await page.locator('[data-mode-mute]:visible').count(), 0,
        'Work does not acquire a visible duplicate sound control.');
      if (await page.locator('[data-mode-mute]').isEnabled()) assert.equal(await page.locator('[data-mode-mute]').getAttribute('aria-pressed'), 'true');

      await page.locator('.archive-category-heading a[href="#/work#flashes"]').click();
      await page.waitForFunction(() => location.hash === '#/work#flashes' && document.querySelector('#flashes').getBoundingClientRect().top < innerHeight);
      assert.equal(await page.locator('.work-page h1').textContent(), '01 / WORKS', 'Anchor navigation keeps the connected Work document.');
      await page.locator('.work-filters a[href="#/work#more"]').click();
      await page.waitForFunction(() => location.hash === '#/work#more' && document.querySelector('#more').getBoundingClientRect().top < innerHeight);
      assert.deepEqual(await page.locator('[data-archive-category]').evaluateAll(sections => sections.map(section => section.dataset.archiveCategory)), ['tattoos', 'flashes', 'jewellery', 'digital-artworks', 'analog-photography']);
      await page.locator('.archive-category-heading a[href="#/work#digital-artworks"]').click();
      await page.waitForFunction(() => location.hash === '#/work#digital-artworks' && document.querySelector('#digital-artworks').getBoundingClientRect().top < innerHeight);
      assert.equal(await page.locator('.portfolio-archive img').count(), 1, 'The exact supplied digital original is present in the offline export.');
      const original = page.locator('[data-archive-category="digital-artworks"] .project-image img');
      await original.evaluate(image => image.decode());
      assert.match(await original.getAttribute('src'), /^data:image\//, 'Offline artwork uses an embedded image.');
      assert.equal(await original.getAttribute('width'), '1440');
      assert.equal(await original.getAttribute('height'), '1920');
      assert.ok(await original.evaluate(image => image.naturalWidth > 0
        && Math.abs(image.naturalWidth * 4 - image.naturalHeight * 3) <= 4),
      'Responsive image density rounds intrinsic CSS dimensions by at most one pixel.');
      assert.equal(await page.locator('[data-project-url="/work/digital-artworks/green-black-original"]').count(), 1);
      assert.equal(await page.locator('html').getAttribute('data-mode'), 'xray', 'New archive navigation keeps the current visual world.');

      await routeNavigate(page, 'about');
      await page.waitForFunction(() => document.documentElement.dataset.page === 'about');
      assert.match(await page.locator('main').textContent(), /independent artist based in berlin\./);
      assert.equal(await page.locator('[data-mode-mute]:visible').count(), 0);
      await routeNavigate(page, 'contact');
      await page.waitForFunction(() => document.documentElement.dataset.page === 'home');
      assert.equal(await page.locator('[data-inquiry-form]').count(), 1, 'Contact opens the only form in the Home section.');
      assert.equal(await page.locator('[data-inquiry-form]').evaluate(form => form.closest('#contact') !== null), true);
      await routeNavigate(page, 'home');
      await page.waitForFunction(() => document.documentElement.dataset.page === 'home');
      await page.locator('.hero-nav a[href="#/#contact"]').click();
      await page.waitForFunction(() => document.documentElement.dataset.page === 'home'
        && location.hash === '#/#contact' && document.querySelector('#contact').getBoundingClientRect().top < innerHeight);
      assert.ok(await page.locator('#contact').evaluate(element => element.getBoundingClientRect().top < innerHeight));
      assert.equal(await page.locator('[data-xray-hint-text]').textContent(), 'HOLD 4 TO REVERSE.');
      await reverseWith3(page);
      assert.equal(await page.locator('[data-xray-hint-text]').textContent(), 'HOLD 4 TO SEE THE OTHER SIDE.');
      const filters = await page.locator('#logo-canvas,.project-image img').evaluateAll(images => images.map(image => getComputedStyle(image).filter));
      assert.ok(filters.every(filter => filter === 'none'));
      await page.evaluate(() => { location.hash = '#/'; });
      await page.waitForFunction(() => scrollY === 0);
      assert.equal(await page.locator('#logo-canvas').isVisible(), true);
      const homeHash = await page.evaluate(() => location.hash);
      await page.locator('#contact').evaluate(element => element.scrollIntoView({ behavior: 'instant' }));
      assert.ok(await page.evaluate(() => scrollY > 0), 'Prepare a real scrolled Home document without changing its hash.');
      await page.locator('[data-floating-brand]').click();
      await page.waitForFunction(hash => location.hash === hash && scrollY === 0 && document.querySelector('[data-naavi]').dataset.chapter === '0', homeHash);
      assert.equal(await page.locator('[data-naavi]').getAttribute('data-chapter'), '0', 'Same-hash Home navigation still updates NAAVI.');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      if (mobile) await page.locator('[data-visitor-hotspot]').tap(); else await page.locator('[data-visitor-hotspot]').hover();
      assert.match(await page.locator('[data-visitor-hotspot] [data-visit-message]').textContent(), /nice to meet you\./);
      assert.deepEqual(errors, []);
      assert.deepEqual(requests, [], 'Standalone mode, texture, sound and navigation must require no HTTP requests.');
      reports.push({ width, mobile, externalHttpRequests: requests.length, runtimeErrors: errors.length,
        identityCounterGap: identity.counter.left - identity.brand.right, reverseHint, memoryHandoff,
        verified: ['WebGL hero', 'short hold cancellation', mobile ? 'native touch hold' : 'one-second 4 hold',
          'one-second 4 reverse', 'released 333 return', 'temporary faint hint', 'embedded film',
          'retained transition pixels', 'two bounded memory buffers', 'no pristine CSS source', 'lower hero mute',
          'spaced lowercase local visit', 'persistent brand and INDEX', 'connected Work anchors', 'About', 'Home-only Contact inquiry', 'visitor', 'horizontal bounds'] });
      console.log(`PASS standalone ${width}px: one-second${mobile ? ' native touch' : ' keyboard 4'} entry, 4/333 return, temporary faint hint, lower hero mute, spaced visit, persistent INDEX, connected Work, Home Contact, zero HTTP requests/runtime errors.`);
    } finally { await context.close(); }
  }
  await writeFile(new URL('../artifacts/control-offline-results.json', import.meta.url), JSON.stringify({
    contract: 'smart-continuation-v3-offline', checkedAt: new Date().toISOString(), html: htmlPath.pathname, htmlBytes: Buffer.byteLength(html),
    htmlSha256: createHash('sha256').update(html).digest('hex'), reports,
  }, null, 2) + '\n');
} finally { await browser.close(); }
