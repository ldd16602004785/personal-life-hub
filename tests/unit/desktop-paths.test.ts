import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  resolveDesktopClientDir,
  resolveDesktopDataDir,
  type DesktopPathOptions
} from "../../desktop/paths";

const baseOptions: DesktopPathOptions = {
  isPackaged: false,
  execPath: "C:\\project\\node_modules\\electron\\electron.exe",
  appPath: "C:\\project",
  projectRoot: "C:\\project"
};

describe("desktop paths", () => {
  it("keeps development data inside the project workspace", () => {
    expect(resolveDesktopDataDir(baseOptions)).toBe(
      path.join("C:\\project", "personal-life-hub-data")
    );
  });

  it("stores packaged data beside the distributed executable", () => {
    expect(
      resolveDesktopDataDir({
        ...baseOptions,
        isPackaged: true,
        execPath: "D:\\个人工作生活\\个人工作生活.exe",
        appPath: "D:\\个人工作生活\\resources\\app"
      })
    ).toBe(path.join("D:\\个人工作生活", "data"));
  });

  it("allows automated tests to override the data directory", () => {
    expect(
      resolveDesktopDataDir({
        ...baseOptions,
        dataDirOverride: "C:\\temp\\desktop-test-data"
      })
    ).toBe(path.resolve("C:\\temp\\desktop-test-data"));
  });

  it("loads packaged client files from the application resources", () => {
    expect(
      resolveDesktopClientDir({
        ...baseOptions,
        isPackaged: true,
        appPath: "D:\\个人工作生活\\resources\\app"
      })
    ).toBe(path.join("D:\\个人工作生活\\resources\\app", "dist", "client"));
  });
});
