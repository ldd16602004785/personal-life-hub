import fs from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { createTestApp, type TestAppContext } from "../helpers/test-app";
import {
  deleteAttachment,
  resolveAttachment,
  saveAttachment
} from "../../server/src/services/attachments";

let context: TestAppContext | undefined;

afterEach(async () => {
  await context?.cleanup();
  context = undefined;
});

const pngBytes = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00
]);

describe("attachment safety", () => {
  it("stores valid PNG data under a generated local filename", async () => {
    context = await createTestApp();
    const stored = saveAttachment(context.app.appConfig, {
      buffer: pngBytes,
      originalName: "../../photo.png",
      mediaType: "image/png"
    });

    expect(stored.originalName).toBe("photo.png");
    expect(stored.relativePath).toMatch(/\.png$/);
    expect(fs.existsSync(resolveAttachment(context.app.appConfig, stored.relativePath))).toBe(
      true
    );
  });

  it("rejects files whose signature does not match the declared image type", async () => {
    context = await createTestApp();

    expect(() =>
      saveAttachment(context!.app.appConfig, {
        buffer: Buffer.from("not an image"),
        originalName: "fake.png",
        mediaType: "image/png"
      })
    ).toThrow(/有效的 JPEG/);
  });

  it("rejects path traversal and deletes only resolved local files", async () => {
    context = await createTestApp();
    const stored = saveAttachment(context.app.appConfig, {
      buffer: pngBytes,
      originalName: "photo.png",
      mediaType: "image/png"
    });

    expect(() => resolveAttachment(context!.app.appConfig, "../app.db")).toThrow(
      /附件不存在/
    );
    deleteAttachment(context.app.appConfig, stored.relativePath);
    expect(() => resolveAttachment(context!.app.appConfig, stored.relativePath)).toThrow(
      /附件不存在/
    );
  });
});
