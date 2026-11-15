import { contextBridge, ipcRenderer } from "electron";

const desktopApi = {
  getInfo: () =>
    ipcRenderer.invoke("desktop:get-info") as Promise<{
      dataDir: string;
      version: string;
    }>,
  openDataFolder: () =>
    ipcRenderer.invoke("desktop:open-data-folder") as Promise<{
      ok: boolean;
      message?: string;
    }>,
  quit: () => ipcRenderer.invoke("desktop:quit") as Promise<{ ok: boolean }>
};

contextBridge.exposeInMainWorld("personalLifeHubDesktop", desktopApi);
