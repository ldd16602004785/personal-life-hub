import { buildApp } from "./app";
import { spawn } from "node:child_process";

const app = await buildApp({ logger: true });
const port = Number(process.env.PORT ?? 4317);

try {
  await app.listen({ host: "127.0.0.1", port });
  if (process.env.NO_OPEN !== "1" && process.platform === "win32") {
    const url = `http://127.0.0.1:${port}`;
    const child = spawn("cmd.exe", ["/c", "start", "", url], {
      detached: true,
      stdio: "ignore",
      windowsHide: true
    });
    child.unref();
  }
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
