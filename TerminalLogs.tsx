import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  getIps: () => ipcRenderer.invoke("get-ips"),
  getStatus: () => ipcRenderer.invoke("get-status"),
  getBlockText: (ips: string[]) => ipcRenderer.invoke("get-block-text", ips),
  apply: (ips: string[]) => ipcRenderer.invoke("apply", ips),
  remove: () => ipcRenderer.invoke("remove"),
});
