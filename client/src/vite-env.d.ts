/// <reference types="vite/client" />

interface PersonalLifeHubDesktopBridge {
  getInfo: () => Promise<{
    dataDir: string;
    version: string;
  }>;
  openDataFolder: () => Promise<{
    ok: boolean;
    message?: string;
  }>;
  quit: () => Promise<{ ok: boolean }>;
}

interface Window {
  personalLifeHubDesktop?: PersonalLifeHubDesktopBridge;
}
