import fs from "node:fs";
import path from "node:path";

const target = path.resolve("test-results/e2e-data");
const allowedRoot = path.resolve("test-results");

if (!target.startsWith(`${allowedRoot}${path.sep}`)) {
  throw new Error("Refusing to clean data outside test-results");
}

fs.rmSync(target, { recursive: true, force: true });
