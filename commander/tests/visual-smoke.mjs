import { chromium } from '../../node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';

const outputDirectory = path.resolve('artifacts');
await fs.mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1560, height: 980 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});
page.on('pageerror', (error) => errors.push(error.message));

await page.goto('http://127.0.0.1:5174', { waitUntil: 'networkidle' });
await page.waitForSelector('text=ROBARM');
await page.waitForSelector('canvas');
await page.waitForTimeout(2500);

const dimensions = await page.evaluate(() => ({
  bodyWidth: document.body.scrollWidth,
  viewportWidth: window.innerWidth,
  bodyHeight: document.body.scrollHeight,
  viewportHeight: window.innerHeight,
  canvases: document.querySelectorAll('canvas').length
}));

await page.screenshot({ path: path.join(outputDirectory, 'control.png'), fullPage: true });
for (const workspace of ['Simulator', 'Programs', 'Commands', 'Vitals', 'Calibration', 'Inputs', 'Learning', 'Settings']) {
  await page.getByRole('tab', { name: workspace }).click();
  await page.waitForTimeout(workspace === 'Simulator' ? 1500 : 150);
  await page.screenshot({ path: path.join(outputDirectory, `${workspace.toLowerCase()}.png`), fullPage: true });
}

await browser.close();
if (dimensions.bodyWidth > dimensions.viewportWidth) throw new Error(`Horizontal overflow: ${JSON.stringify(dimensions)}`);
if (dimensions.canvases < 1) throw new Error('No integrated simulator canvas rendered');
if (errors.length) throw new Error(`Browser errors:\n${errors.join('\n')}`);
console.log(JSON.stringify(dimensions));

