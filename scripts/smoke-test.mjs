import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const url = process.env.SMOKE_URL ?? 'http://127.0.0.1:5173';

function canvasHasPaintedPixels(data) {
  const pixels = data;
  let variedPixels = 0;
  for (let index = 0; index < pixels.length; index += 4 * 97) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    if (Math.abs(red - green) > 4 || Math.abs(red - blue) > 4 || red < 235) {
      variedPixels += 1;
    }
    if (variedPixels > 80) return true;
  }
  return false;
}

async function getCanvasPixels(page, selector) {
  return page.locator(selector).evaluate((canvas) => {
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return null;
    const width = canvas.width;
    const height = canvas.height;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return Array.from(pixels);
  });
}

await mkdir('artifacts', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForSelector('canvas');
await page.screenshot({ path: 'artifacts/simulator-desktop.png', fullPage: true });

const simulationPainted = await getCanvasPixels(page, '.robot-viewport canvas');

if (!simulationPainted || !canvasHasPaintedPixels(simulationPainted)) {
  throw new Error('The simulation canvas appears blank.');
}

await page.getByRole('button', { name: /Parts/i }).click();
await page.getByRole('button', { name: /J4\/J5 wrist assembly/i }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: 'artifacts/simulator-parts.png', fullPage: true });

const partPainted = await getCanvasPixels(page, '.part-viewport canvas');

if (!partPainted || !canvasHasPaintedPixels(partPainted)) {
  throw new Error('The part viewer canvas appears blank.');
}

await page.getByRole('button', { name: /Main controller stack/i }).click();
await page.getByText(/24 V in -> fused distribution/i).waitFor();
await page.waitForTimeout(400);
await page.screenshot({ path: 'artifacts/simulator-electronics.png', fullPage: true });

await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole('button', { name: /Simulation/i }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: 'artifacts/simulator-mobile.png', fullPage: true });

await browser.close();
console.log(`Smoke test passed at ${url}`);
