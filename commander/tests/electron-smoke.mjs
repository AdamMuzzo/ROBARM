import { _electron as electron } from '../../node_modules/playwright/index.mjs';

const packagedExecutable = process.env.ROBARM_EXECUTABLE;
const application = await electron.launch({
  args: packagedExecutable ? [] : ['desktop/main.cjs'],
  cwd: process.cwd(),
  executablePath: packagedExecutable ?? new URL('../node_modules/electron/dist/electron.exe', import.meta.url).pathname.replace(/^\/(?:([A-Za-z]:))/, '$1'),
  env: packagedExecutable ? process.env : { ...process.env, VITE_DEV_SERVER_URL: 'http://127.0.0.1:5174' }
});

try {
  const window = await application.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  await window.getByText('ROBARM', { exact: true }).waitFor();
  const bridge = await window.evaluate(() => ({
    available: Boolean(window.robarmDesktop),
    platform: window.robarmDesktop?.platform,
    serialList: typeof window.robarmDesktop?.serial.list
  }));
  if (!bridge.available || bridge.serialList !== 'function') throw new Error(`Desktop preload bridge failed: ${JSON.stringify(bridge)}`);
  const ports = await window.evaluate(() => window.robarmDesktop?.serial.list());
  if (!Array.isArray(ports)) throw new Error('Serial discovery did not return an array');
  const target = await window.getByText('SIMULATION', { exact: true }).first().textContent();
  if (target !== 'SIMULATION') throw new Error(`Unsafe startup target: ${target}`);
  await window.getByRole('button', { name: 'Software stop and disable' }).click();
  console.log(JSON.stringify({ bridge, portCount: ports.length, startupTarget: target }));
} finally {
  await application.close();
}
