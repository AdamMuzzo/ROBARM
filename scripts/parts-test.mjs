import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const url = process.env.SMOKE_URL ?? 'http://127.0.0.1:5173/?tab=parts';
await mkdir('artifacts', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.part-viewport[data-model-status="ready"]', { timeout: 60_000 });
await page.screenshot({ path: 'artifacts/parts-assembly.png' });

await page.getByRole('button', { name: 'Exploded', exact: true }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: 'artifacts/parts-exploded.png' });

await page.getByRole('button', { name: /Upper arm.*Upper_arm\.STL/i }).click();
await page.waitForTimeout(200);
if (!await page.getByRole('heading', { name: 'Required hardware' }).isVisible()) throw new Error('Component hardware list is missing.');
await page.screenshot({ path: 'artifacts/parts-selected-component.png' });

await page.getByRole('button', { name: /Base assembly/i }).click();
await page.waitForSelector('.part-viewport[data-model-status="ready"]', { timeout: 60_000 });
await page.getByPlaceholder('Search the BOM...').fill('ESTOP_TOP');
if (!await page.getByRole('button', { name: /Base assembly/i }).isVisible()) throw new Error('Nested STL search did not find the base assembly.');
await page.getByPlaceholder('Search the BOM...').fill('');
await page.getByRole('button', { name: 'Exploded', exact: true }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: 'artifacts/parts-base-exploded.png' });

await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(200);
await page.screenshot({ path: 'artifacts/parts-mobile.png' });

if (pageErrors.length) throw new Error(`Browser errors: ${pageErrors.join(' | ')}`);
await browser.close();
console.log(`Parts test passed at ${url}`);
