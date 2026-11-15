import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { _electron as electron, type ElectronApplication } from "@playwright/test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(__dirname, "..", "..");

export interface LaunchTestDesktopOptions {
  temporaryRoot: string;
  dataDir?: string;
}

export async function launchTestDesktop(
  options: LaunchTestDesktopOptions
): Promise<{ desktop: ElectronApplication; dataDir: string }> {
  const dataDir = options.dataDir ?? path.join(options.temporaryRoot, "data");
  const desktop = await electron.launch({
    args: ["."],
    cwd: projectRoot,
    env: {
      ...process.env,
      APP_DATA_DIR: dataDir,
      APP_USER_DATA_DIR: path.join(options.temporaryRoot, "user-data"),
      APP_DISABLE_SPLASH: "1"
    }
  });
  return { desktop, dataDir };
}

export function createTemporaryRoot(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}
