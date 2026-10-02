const { test, expect } = require('@playwright/test');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const { readFileSync } = require('node:fs');

const site = pathToFileURL(resolve(__dirname, '../site/index.html')).href;

for (const [name, width, height] of [['desktop', 1440, 1000], ['laptop', 1024, 900], ['tablet', 768, 1024], ['phone', 390, 844], ['small-phone', 320, 740]]) {
  test(`${name}: readable layout, local assets and working disclosures`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    const errors = [];
    const externalRequests = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => { if (/^https?:/.test(request.url())) externalRequests.push(request.url()); });
    await page.goto(site);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Reliable AI.Measurable impact.');
    await expect(page.locator('.hero-intro')).toBeVisible();
    const typography = await page.evaluate(() => {
      const bodyFont = getComputedStyle(document.body).fontFamily;
      return [...document.querySelectorAll('h1, h2, h3, .heading-accent, .monogram, .proof-number, .eyebrow')].map((element) => {
        const style = getComputedStyle(element);
        return { sameFont: style.fontFamily === bodyFont, style: style.fontStyle };
      });
    });
    expect(typography.every((item) => item.sameFont && item.style === 'normal')).toBe(true);
    await expect(page.locator('h1 em, h2 em, h3 em')).toHaveCount(0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
    await page.screenshot({ path: testInfo.outputPath(`${name}-hero.png`) });
    for (const details of await page.locator('details').all()) {
      await details.locator('summary').click();
      await expect(details).toHaveAttribute('open', '');
      await expect(details.locator('.detail-content')).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${name}-full.png`), fullPage: true });
    expect(errors).toEqual([]);
    expect(externalRequests).toEqual([]);
    for (const anchor of await page.locator('a[target="_blank"]').all()) {
      expect(await anchor.getAttribute('rel')).toContain('noopener');
    }
    await page.getByRole('link', { name: /Let’s talk/ }).click();
    await expect(page).toHaveURL(/#contact$/);
    await expect(page.getByRole('heading', { name: /Let’s build something/ })).toBeVisible();
  });
}

test('branding uses uppercase DC, neutral colors and a minimal footer', async ({ page }) => {
  await page.goto(site);
  await expect(page.locator('.monogram')).toHaveText('DC.');
  await expect(page.locator('footer')).not.toContainText('Built with intention.');
  await expect(page.locator('footer p')).toHaveCount(0);
  await expect(page.locator('.hero .heading-accent')).toHaveCSS('color', 'rgb(0, 0, 0)');
  await expect(page.locator('.contact-box')).toHaveCSS('background-color', 'rgb(17, 17, 17)');
  for (const file of ['styles.css', 'assets/favicon.svg']) {
    const source = readFileSync(resolve(__dirname, '../site', file), 'utf8');
    const colors = [...source.matchAll(/#([0-9a-f]{3,8})\b/gi)].map((match) => {
      let value = match[1];
      if (value.length <= 4) value = [...value].map((digit) => digit + digit).join('');
      return [0, 2, 4].map((start) => parseInt(value.slice(start, start + 2), 16));
    });
    expect(colors.length).toBeGreaterThan(0);
    expect(colors.every(([red, green, blue]) => red === green && green === blue)).toBe(true);
  }
});

test('benchmark mutation is distinct from RL Gym and describes runtime evaluation coverage', async ({ page }) => {
  await page.goto(site);
  const mutation = page.locator('#benchmark-mutation');
  await expect(mutation.getByRole('heading', { level: 3 })).toHaveText('Expanding whatbenchmarks can test.');
  await expect(mutation).toContainText('benchmark-agnostic runtime mutation framework');
  await mutation.locator('summary').click();
  await expect(mutation).toContainText('not only malformed inputs or integration failures');
  await expect(mutation).toContainText('Benchmark-agnostic describes the shared core');
  await expect(mutation).not.toContainText('RL Gym');
  const environments = page.locator('#agent-evaluation');
  await expect(environments).toContainText('RL Gym');
  await expect(environments).not.toContainText('15+');
  await expect(page.locator('body')).not.toContainText('configurable tool-call degradations');
  await expect(page.locator('a[href*="Turing-Generalized-Agents"]')).toHaveCount(0);
});

test('keyboard navigation and copy-email fallback are usable', async ({ page }) => {
  await page.goto(site);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main$/);
  const summary = page.locator('details summary').first();
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('details').first()).toHaveAttribute('open', '');
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('Not permitted'); } } }));
  await page.getByRole('button', { name: 'Copy email address' }).click();
  await expect(page.getByRole('status')).toHaveText('Copy manually: dushyantchetiwal24@gmail.com');
});

test('successful email copy is announced only after success', async ({ page }) => {
  await page.goto(site);
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value) => { window.copiedEmail = value; } } }));
  await page.getByRole('button', { name: 'Copy email address' }).click();
  await expect(page.getByRole('status')).toHaveText('Email address copied.');
  expect(await page.evaluate(() => window.copiedEmail)).toBe('dushyantchetiwal24@gmail.com');
});

test('all essential content works with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(site);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copy email address' })).toBeHidden();
  await page.locator('#retrieval-quality summary').click();
  await expect(page.locator('#retrieval-quality .detail-content')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download résumé' })).toHaveAttribute('href', 'assets/dushyant-chetiwal-resume.pdf');
  await context.close();
});

test('reduced motion disables smooth scrolling and resume is a local PDF', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(site);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
  const resume = readFileSync(resolve(__dirname, '../site/assets/dushyant-chetiwal-resume.pdf'));
  expect(resume.subarray(0, 5).toString()).toBe('%PDF-');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://dushyantchetiwal.github.io/');
});
