export interface IpRecord {
  ip: string;
  status: "Up" | "Down";
  provider: string;
  latency?: number;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
}

export interface ApplyResult {
  success: boolean;
  message: string;
}

// API, прокинутое из preload через contextBridge
export interface FixerApi {
  getIps: () => Promise<IpRecord[]>;
  getStatus: () => Promise<boolean | null>;
  getBlockText: (ips: string[]) => Promise<string>;
  apply: (ips: string[]) => Promise<ApplyResult>;
  remove: () => Promise<ApplyResult>;
}

declare global {
  interface Window {
    api: FixerApi;
  }
}
