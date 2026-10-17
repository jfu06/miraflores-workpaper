/**
 * Run a command against a server of its own.
 *
 * The integration tests write events, so they need a database nobody else is
 * using and a server pointed at it. Starting both here keeps that out of the
 * test file and makes `npm run test:fail-closed` a single command on a clean
 * machine.
 */

import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = Number(process.env.PORT ?? 3199);
const base = `http://localhost:${PORT}`;
const dir = mkdtempSync(join(tmpdir(), "workpaper-test-"));

const server = spawn("npx", ["next", "dev", "--turbopack", "-p", String(PORT)], {
  env: { ...process.env, EVENTS_DB_PATH: join(dir, "events.db") },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d));
server.stderr.on("data", (d) => (serverLog += d));

const stop = () => {
  server.kill("SIGTERM");
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    /* the temp directory is the OS's problem after this */
  }
};

const ready = async () => {
  for (let i = 0; i < 120; i += 1) {
    if (server.exitCode !== null) return false;
    try {
      const res = await fetch(base, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
};

if (!(await ready())) {
  console.error(`The server did not come up on ${base}.\n${serverLog.slice(-2000)}`);
  stop();
  process.exit(1);
}

const [cmd, ...args] = process.argv.slice(2);
const child = spawn(cmd, [...args, "--url", base], { stdio: "inherit" });
child.on("exit", (code) => {
  stop();
  process.exit(code ?? 1);
});
process.on("SIGINT", () => {
  stop();
  process.exit(130);
});
