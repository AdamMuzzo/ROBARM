export {};

declare global {
  interface SerialPortDescriptor {
    path: string;
    manufacturer?: string;
    serialNumber?: string;
    vendorId?: string;
    productId?: string;
    friendlyName?: string;
  }

  interface RobarmDesktopBridge {
    platform: string;
    serial: {
      list(): Promise<SerialPortDescriptor[]>;
      open(path: string, baudRate: number): Promise<{ path: string }>;
      close(): Promise<void>;
      write(data: Uint8Array): Promise<void>;
      onData(listener: (data: Uint8Array) => void): () => void;
      onError(listener: (message: string) => void): () => void;
      onClosed(listener: () => void): () => void;
    };
  }

  interface Window {
    robarmDesktop?: RobarmDesktopBridge;
  }
}

