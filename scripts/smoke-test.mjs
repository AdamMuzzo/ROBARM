import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const url = process.env.SMOKE_URL ?? 'http://127.0.0.1:5173';

function canvasHasPaintedPixels(data) {
  let variedPixels = 0;
  for (let index = 0; index < data.length; index += 4 * 97) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    if (Math.abs(red - green) > 4 || Math.abs(red - blue) > 4 || red < 225) variedPixels += 1;
    if (variedPixels > 80) return true;
  }
  return false;
}

async function getCanvasPixels(page, selector) {
  return page.locator(selector).evaluate((canvas) => {
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    if (!gl) return null;
    const pixels = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return Array.from(pixels);
  });
}

async function expectPaintedCanvas(page, selector, label) {
  const pixels = await getCanvasPixels(page, selector);
  if (!pixels || !canvasHasPaintedPixels(pixels)) throw new Error(`${label} canvas appears blank.`);
}

await mkdir('artifacts', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 920 } });
const pageErrors = [];
page.on('pageerror', (error) => pageErrors.push(error.message));

await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForSelector('.robot-viewport[data-model-status="ready"]', { timeout: 30_000 });
await expectPaintedCanvas(page, '.robot-viewport canvas', 'Simulation');
await page.screenshot({ path: 'artifacts/simulator-desktop.png', fullPage: true });

await page.getByRole('button', { name: 'Disassemble' }).click();
await page.waitForSelector('.robot-viewport[data-assembly-phase="disassembled"]', { timeout: 15_000 });
await expectPaintedCanvas(page, '.robot-viewport canvas', 'Disassembled simulation');
await page.screenshot({ path: 'artifacts/simulator-disassembled.png', fullPage: true });
const explodedCanvas = page.locator('.robot-viewport canvas');
const explodedBounds = await explodedCanvas.boundingBox();
let inspectionPoint = null;
if (explodedBounds) {
  for (let row = 2; row < 15 && !inspectionPoint; row += 1) {
    for (let column = 1; column < 20; column += 1) {
      const x = explodedBounds.x + explodedBounds.width * column / 20;
      const y = explodedBounds.y + explodedBounds.height * row / 16;
      await page.mouse.move(x, y);
      if (await page.locator('.part-hover-prompt').isVisible()) {
        inspectionPoint = { x, y };
        break;
      }
    }
  }
}
if (!inspectionPoint) throw new Error('No exploded component responded to pointer hover.');
await page.mouse.click(inspectionPoint.x, inspectionPoint.y);
await page.waitForSelector('.exploded-part-inspector[data-selected-piece]', { timeout: 5_000 });
await page.screenshot({ path: 'artifacts/simulator-part-inspection.png', fullPage: true });
await page.getByRole('button', { name: 'Reassemble' }).click();
await page.waitForSelector('.robot-viewport[data-assembly-phase="assembled"]', { timeout: 15_000 });

await page.getByRole('button', { name: /02 Reach/ }).click();
await page.waitForTimeout(250);
await page.screenshot({ path: 'artifacts/simulator-motion.png', fullPage: true });

await page.getByRole('button', { name: 'Parts' }).click();
await page.waitForSelector('.part-viewport[data-model-status="ready"]', { timeout: 30_000 });
await expectPaintedCanvas(page, '.part-viewport canvas', 'Part');
await page.screenshot({ path: 'artifacts/simulator-parts.png', fullPage: true });
await page.getByRole('button', { name: 'Exploded', exact: true }).click();
await page.waitForTimeout(700);
await expectPaintedCanvas(page, '.part-viewport canvas', 'Exploded part');
await page.screenshot({ path: 'artifacts/simulator-parts-components.png', fullPage: true });
await page.getByRole('button', { name: /Upper arm.*Upper_arm\.STL/i }).click();
await page.waitForTimeout(250);
await page.screenshot({ path: 'artifacts/simulator-parts-component-selected.png', fullPage: true });

await page.getByRole('button', { name: /J6 tool attachments/i }).click();
await page.waitForSelector('.part-viewport[data-model-status="ready"]', { timeout: 30_000 });
await page.getByRole('button', { name: 'Show X-ray model' }).click();
await page.waitForSelector('.part-viewport[data-model-status="ready"]', { timeout: 30_000 });
await expectPaintedCanvas(page, '.part-viewport canvas', 'X-ray part');
await page.screenshot({ path: 'artifacts/simulator-parts-xray.png', fullPage: true });

await page.getByRole('button', { name: 'Electronics' }).click();
await page.waitForSelector('.part-viewport[data-model-status="ready"]', { timeout: 30_000 });
await page.getByRole('button', { name: 'Show solid model' }).click();
await page.getByRole('button', { name: /BTT Octopus Pro/i }).click();
await page.waitForSelector('.part-viewport[data-model-status="ready"]', { timeout: 30_000 });
await expectPaintedCanvas(page, '.part-viewport canvas', 'Octopus Pro');
await page.screenshot({ path: 'artifacts/simulator-electronics.png', fullPage: true });

await page.getByRole('button', { name: /NEMA 17 \/ 60 mm/i }).click();
await page.waitForSelector('.part-viewport[data-model-status="ready"]', { timeout: 30_000 });
await expectPaintedCanvas(page, '.part-viewport canvas', 'NEMA 17 motor');
await page.screenshot({ path: 'artifacts/simulator-motor.png', fullPage: true });

await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole('button', { name: 'Simulator' }).click();
await page.waitForSelector('.robot-viewport[data-model-status="ready"]', { timeout: 30_000 });
await page.getByRole('button', { name: 'Show solid model' }).click();
await page.waitForTimeout(250);
await page.screenshot({ path: 'artifacts/simulator-mobile.png', fullPage: true });

if (pageErrors.length > 0) throw new Error(`Browser errors: ${pageErrors.join(' | ')}`);

await browser.close();
console.log(`Smoke test passed at ${url}`);
