import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';

const url = process.env.SMOKE_URL ?? 'http://127.0.0.1:5173';
await mkdir('artifacts', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.robot-viewport[data-model-status="ready"]', { timeout: 120_000 });
await page.waitForSelector('.safety-card.is-clear');
await page.locator('#joint-j2').focus();
await page.locator('#joint-j2').press('Home');
await page.waitForSelector('.safety-card.is-caution, .safety-card.is-collision');
await page.getByRole('button', { name: 'Home', exact: true }).click();
await page.getByRole('button', { name: 'Front camera view' }).click();
await page.getByRole('button', { name: 'Toggle cable routing overlay' }).click();
await page.screenshot({ path: 'artifacts/simulator-workbench.png', fullPage: true });

await page.getByRole('button', { name: 'Guided assembly' }).click();
await page.waitForSelector('.robot-viewport[data-assembly-phase="disassembled"]', { timeout: 20_000 });
await page.getByRole('button', { name: /Next/ }).click();
await page.getByPlaceholder('Search motor, pulley, sensor...').fill('fan');
await page.waitForSelector('.finder-results button');
await page.screenshot({ path: 'artifacts/simulator-service-tools.png', fullPage: true });
await page.getByPlaceholder('Search motor, pulley, sensor...').fill('');

await page.getByRole('button', { name: /Diagnose/ }).click();
await page.getByLabel('Observed symptom').selectOption('homing-fails');
await page.getByRole('button', { name: 'Locate affected parts' }).click();
await page.waitForSelector('.robot-viewport[data-assembly-phase="disassembled"]');
await page.screenshot({ path: 'artifacts/simulator-diagnostics.png', fullPage: true });

await page.getByRole('button', { name: 'Parts', exact: true }).click();
await page.getByRole('button', { name: 'Electronics' }).click();
await page.getByPlaceholder('Search the BOM...').fill('fan');
await page.getByRole('button', { name: /Noctua NF-A4x20 5V/ }).click();
await page.waitForSelector('.part-viewport[data-model-status="ready"]', { timeout: 30_000 });
const downloadPromise = page.waitForEvent('download');
await page.getByRole('button', { name: 'Export bill of materials as CSV' }).click();
const download = await downloadPromise;
const downloadPath = await download.path();
if (!downloadPath || !(await readFile(downloadPath, 'utf8')).includes('BTT Octopus Pro')) throw new Error('BOM CSV did not contain the complete catalog.');

await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole('button', { name: 'Simulator' }).click();
await page.waitForSelector('.robot-viewport[data-model-status="ready"]', { timeout: 120_000 });
await page.screenshot({ path: 'artifacts/simulator-workbench-mobile.png', fullPage: true });

if (pageErrors.length) throw new Error(`Browser errors: ${pageErrors.join(' | ')}`);
await browser.close();
console.log(`Feature test passed at ${url}`);
