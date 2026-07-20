import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const url = process.env.SMOKE_URL ?? 'http://127.0.0.1:5173/?tab=wiring';
await mkdir('artifacts', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.getByRole('heading', { name: 'ROBARM wiring diagrams' }).waitFor();

const visualCards = page.locator('.hardware-visual-sequence figure');
if (await visualCards.count() !== 3) throw new Error('Expected three visual hardware cards on each sheet.');
await page.locator('.hardware-photo img').first().waitFor();
await page.waitForFunction(() => {
  const image = document.querySelector('.hardware-photo img');
  return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
});

await page.locator('.board-pinmap-reference summary').click();
await page.locator('.board-pinmap-reference img').scrollIntoViewIfNeeded();
await page.waitForFunction(() => {
  const image = document.querySelector('.board-pinmap-reference img');
  return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0;
});
await page.getByRole('heading', { name: 'What every colored board area does' }).waitFor();
if (await page.locator('.board-anatomy-grid article').count() !== 15) throw new Error('Expected fifteen Octopus Pro board anatomy entries.');
if (!await page.getByText('STOP0-STOP5 read J1-J6 homes. STOP7 reads the K1 auxiliary contact. STOP6 is spare.', { exact: true }).isVisible()) {
  throw new Error('ROBARM endstop assignment is missing from the board anatomy guide.');
}
await page.getByRole('heading', { name: 'What every colored board area does' }).scrollIntoViewIfNeeded();
await page.screenshot({ path: 'artifacts/wiring-board-anatomy.png' });
await page.locator('.board-pinmap-reference summary').click();
await page.evaluate(() => {
  window.scrollTo(0, 0);
  document.querySelectorAll('*').forEach((element) => {
    if (element instanceof HTMLElement) element.scrollTop = 0;
  });
});

const sheetButtons = page.locator('.wiring-sheet-list button');
if (await sheetButtons.count() !== 4) throw new Error('Expected four wiring drawing sheets.');
await page.screenshot({ path: 'artifacts/wiring-power.png' });

await page.getByRole('button', { name: /Six-axis motion/i }).click();
await page.getByRole('button', { name: 'J6', exact: true }).first().click();
if (!await page.getByText('PC13', { exact: true }).first().isVisible()) throw new Error('J6 step pin is missing.');
if (!await page.getByText('PE4', { exact: true }).first().isVisible()) throw new Error('J6 chip-select pin is missing.');
await page.screenshot({ path: 'artifacts/wiring-motion.png' });

await page.getByRole('button', { name: /Homing \+ I\/O/i }).click();
if (!await page.getByText(/Do not connect a 24 V sensor output directly/i).isVisible()) throw new Error('24 V sensor warning is missing.');
await page.screenshot({ path: 'artifacts/wiring-homing.png' });

await page.getByRole('button', { name: /Arm harness/i }).click();
if (!await page.getByText('Base hole 2', { exact: true }).first().isVisible()) throw new Error('Harness exit schedule is missing.');
await page.screenshot({ path: 'artifacts/wiring-harness.png' });

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(100);
await page.screenshot({ path: 'artifacts/wiring-mobile.png' });

await page.getByRole('button', { name: /Power \+ E-stop/i }).click();
await page.locator('.board-pinmap-reference summary').click();
await page.getByRole('heading', { name: 'What every colored board area does' }).scrollIntoViewIfNeeded();
await page.screenshot({ path: 'artifacts/wiring-board-anatomy-mobile.png' });

if (pageErrors.length) throw new Error(`Browser errors: ${pageErrors.join(' | ')}`);
await browser.close();
console.log(`Wiring test passed at ${url}`);
