import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { AppConfig } from "../config";
import { AppError } from "../api/errors";

const imageTypes = new Map<string, string>([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"]
]);

export interface StoredAttachment {
  relativePath: string;
  originalName: string;
  mediaType: string;
  size: number;
}

export function saveAttachment(
  config: AppConfig,
  input: { buffer: Buffer; originalName: string; mediaType: string }
): StoredAttachment {
  const extension = imageTypes.get(input.mediaType);
  if (!extension || !hasExpectedSignature(input.buffer, input.mediaType)) {
    throw new AppError(400, "INVALID_IMAGE", "仅支持有效的 JPEG、PNG 或 WebP 图片");
  }
  if (input.buffer.length === 0 || input.buffer.length > 10 * 1024 * 1024) {
    throw new AppError(400, "INVALID_IMAGE_SIZE", "图片大小必须在 10 MB 以内");
  }

  fs.mkdirSync(config.attachmentsDir, { recursive: true });
  const relativePath = `${crypto.randomUUID()}${extension}`;
  fs.writeFileSync(path.join(config.attachmentsDir, relativePath), input.buffer, {
    flag: "wx"
  });

  return {
    relativePath,
    originalName: path.basename(input.originalName),
    mediaType: input.mediaType,
    size: input.buffer.length
  };
}

export function resolveAttachment(config: AppConfig, relativePath: string): string {
  const target = path.resolve(config.attachmentsDir, relativePath);
  if (
    !target.startsWith(`${path.resolve(config.attachmentsDir)}${path.sep}`) ||
    !fs.existsSync(target)
  ) {
    throw new AppError(404, "ATTACHMENT_NOT_FOUND", "附件不存在");
  }
  return target;
}

export function deleteAttachment(config: AppConfig, relativePath: string): void {
  const target = resolveAttachment(config, relativePath);
  fs.rmSync(target, { force: true });
}

function hasExpectedSignature(buffer: Buffer, mediaType: string): boolean {
  if (mediaType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mediaType === "image/png") {
    return (
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  if (mediaType === "image/webp") {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }
  return false;
}
