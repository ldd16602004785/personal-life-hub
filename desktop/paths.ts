import path from "node:path";

export interface DesktopPathOptions {
  isPackaged: boolean;
  execPath: string;
  appPath: string;
  projectRoot: string;
  dataDirOverride?: string;
}

export function resolveDesktopDataDir(options: DesktopPathOptions): string {
  if (options.dataDirOverride) return path.resolve(options.dataDirOverride);
  if (options.isPackaged) {
    return path.join(path.dirname(options.execPath), "data");
  }
  return path.join(options.projectRoot, "personal-life-hub-data");
}

export function resolveDesktopClientDir(options: DesktopPathOptions): string {
  return path.join(
    options.isPackaged ? options.appPath : options.projectRoot,
    "dist",
    "client"
  );
}
