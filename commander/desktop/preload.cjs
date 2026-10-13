const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, listener, convert = (value) => value) {
  const handler = (_event, value) => listener(convert(value));
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('robarmDesktop', {
  platform: process.platform,
  serial: {
    list: () => ipcRenderer.invoke('serial:list'),
    open: (path, baudRate) => ipcRenderer.invoke('serial:open', path, baudRate),
    close: () => ipcRenderer.invoke('serial:close'),
    write: (data) => ipcRenderer.invoke('serial:write', data),
    onData: (listener) => subscribe('serial:data', listener, (value) => new Uint8Array(value)),
    onError: (listener) => subscribe('serial:error', listener),
    onClosed: (listener) => subscribe('serial:closed', listener)
  }
});

