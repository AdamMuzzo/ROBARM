export type TransportDataListener = (data: Uint8Array) => void;
export type TransportErrorListener = (message: string) => void;

export interface ByteTransport {
  listPorts(): Promise<SerialPortDescriptor[]>;
  open(path: string, baudRate: number): Promise<void>;
  close(): Promise<void>;
  write(data: Uint8Array): Promise<void>;
  onData(listener: TransportDataListener): () => void;
  onError(listener: TransportErrorListener): () => void;
  onClosed(listener: () => void): () => void;
}

export class ElectronSerialTransport implements ByteTransport {
  private get bridge() {
    if (!window.robarmDesktop) throw new Error('Desktop serial bridge is unavailable');
    return window.robarmDesktop.serial;
  }

  listPorts() {
    return this.bridge.list();
  }

  async open(path: string, baudRate: number) {
    await this.bridge.open(path, baudRate);
  }

  close() {
    return this.bridge.close();
  }

  write(data: Uint8Array) {
    return this.bridge.write(data);
  }

  onData(listener: TransportDataListener) {
    return this.bridge.onData(listener);
  }

  onError(listener: TransportErrorListener) {
    return this.bridge.onError(listener);
  }

  onClosed(listener: () => void) {
    return this.bridge.onClosed(listener);
  }
}

