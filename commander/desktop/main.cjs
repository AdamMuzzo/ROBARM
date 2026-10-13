const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('node:path');
const { SerialPort } = require('serialport');

let mainWindow = null;
let activePort = null;
let quitting = false;

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

async function closeActivePort() {
  const port = activePort;
  activePort = null;
  if (!port?.isOpen) return;
  await new Promise((resolve) => port.close(() => resolve()));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1560,
    height: 980,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#121412',
    show: false,
    autoHideMenuBar: true,
    title: 'ROBARM Commander',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const developmentUrl = process.env.VITE_DEV_SERVER_URL;
    if (developmentUrl && url.startsWith(developmentUrl)) return;
    if (!developmentUrl && url.startsWith('file:')) return;
    event.preventDefault();
  });

  const developmentUrl = process.env.VITE_DEV_SERVER_URL;
  if (developmentUrl) mainWindow.loadURL(developmentUrl);
  else mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

ipcMain.handle('serial:list', async () => {
  const ports = await SerialPort.list();
  return ports.map((port) => ({
    path: port.path,
    manufacturer: port.manufacturer,
    serialNumber: port.serialNumber,
    vendorId: port.vendorId,
    productId: port.productId,
    friendlyName: port.friendlyName
  }));
});

ipcMain.handle('serial:open', async (_event, requestedPath, baudRate) => {
  if (typeof requestedPath !== 'string' || requestedPath.length > 200) {
    throw new Error('Invalid serial-port path');
  }
  if (!Number.isInteger(baudRate) || baudRate < 9600 || baudRate > 5_000_000) {
    throw new Error('Invalid serial baud rate');
  }
  const available = await SerialPort.list();
  if (!available.some((port) => port.path === requestedPath)) {
    throw new Error(`Serial port ${requestedPath} is not currently available`);
  }
  await closeActivePort();
  const port = new SerialPort({ path: requestedPath, baudRate, autoOpen: false });
  await new Promise((resolve, reject) => {
    port.open((error) => error ? reject(error) : resolve());
  });
  activePort = port;
  port.on('data', (data) => sendToRenderer('serial:data', new Uint8Array(data)));
  port.on('error', (error) => sendToRenderer('serial:error', error.message));
  port.on('close', () => {
    if (activePort === port) activePort = null;
    if (!quitting) sendToRenderer('serial:closed');
  });
  return { path: requestedPath };
});

ipcMain.handle('serial:write', async (_event, data) => {
  if (!activePort?.isOpen) throw new Error('No serial port is open');
  const bytes = Buffer.from(data);
  if (bytes.length === 0 || bytes.length > 4096) throw new Error('Invalid serial write length');
  await new Promise((resolve, reject) => {
    activePort.write(bytes, (writeError) => {
      if (writeError) return reject(writeError);
      activePort.drain((drainError) => drainError ? reject(drainError) : resolve());
    });
  });
});

ipcMain.handle('serial:close', async () => {
  await closeActivePort();
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  quitting = true;
  if (activePort?.isOpen) activePort.close();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

