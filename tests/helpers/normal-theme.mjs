import assert from 'node:assert/strict';

const normalBackground = 'rgb(36, 36, 36)';
const normalGradient = /^linear-gradient\((?:180deg, )?rgb\(40, 40, 40\) 0%, rgb\(36, 36, 36\) 50%, rgb\(32, 32, 32\) 100%\)$/;

/** Check the shared page surface after initial load, navigation or reversal. */
export async function assertNormalTheme(page) {
  await page.waitForFunction((color) => getComputedStyle(document.documentElement).backgroundColor === color, normalBackground);
  const surface = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const body = getComputedStyle(document.body);
    return {
      color: root.backgroundColor,
      gradient: root.backgroundImage,
      attachment: root.backgroundAttachment,
      repeat: root.backgroundRepeat,
      bodyColor: body.backgroundColor,
      bodyImage: body.backgroundImage,
      theme: document.querySelector('meta[name="theme-color"]')?.content,
      sections: [...document.querySelectorAll('.hero,.masthead,.hero-nav,.page-header,.page-nav,.content-section,.section-pin,.page-footer,#page-content')].map((element) => {
        const style = getComputedStyle(element);
        return { color: style.backgroundColor, image: style.backgroundImage };
      }),
    };
  });
  assert.equal(surface.color, normalBackground, 'Normal Side uses the shared #242424 base.');
  assert.match(surface.gradient, normalGradient, 'The page owns one restrained #282828 → #242424 → #202020 gradient.');
  assert.equal(surface.attachment, 'fixed', 'The gradient stays anchored while sections scroll.');
  assert.equal(surface.repeat, 'no-repeat');
  assert.equal(surface.bodyColor, 'rgba(0, 0, 0, 0)', 'The body lets the page gradient show through.');
  assert.equal(surface.bodyImage, 'none', 'The body must not restart the gradient.');
  assert.equal(surface.theme, '#242424', 'Browser chrome restores the Normal Side base color.');
  assert.ok(surface.sections.every(({ color, image }) => color === 'rgba(0, 0, 0, 0)' && image === 'none'), 'Sections, navigation and sticky wrappers share the uninterrupted page surface.');
}
