// One process that runs every background service (price-publisher + market-maker per market
// + keeper) and restarts any that crash. Built for an always-on worker host (Railway / Render
// / Fly) so the on-chain feed advances 24/7 — every browser then reads the same data, with or
// without a screen open.
//
// Required env:
//   WALLET_SECRET  JSON array secret key of the deployer/publisher wallet (funds everything)
//                  — or set ANCHOR_WALLET to a keypair file path instead.
// Optional: MARKETS (default "0,1"), plus any MM_*/PUBLISH_INTERVAL_MS/SYNTH_VOL_BPS tuning.

import { spawn } from "child_process";
import { createServer } from "http";
import { writeFileSync, mkdtempSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// materialise the keypair from WALLET_SECRET if no ANCHOR_WALLET file is provided
if (!process.env.ANCHOR_WALLET || !existsSync(process.env.ANCHOR_WALLET)) {
  if (process.env.WALLET_SECRET) {
    const dir = mkdtempSync(join(tmpdir(), "flux-"));
    const path = join(dir, "id.json");
    writeFileSync(path, process.env.WALLET_SECRET.trim());
    process.env.ANCHOR_WALLET = path;
    console.log(`[services] wrote wallet from WALLET_SECRET -> ${path}`);
  } else {
    console.error("[services] set WALLET_SECRET (JSON array) or ANCHOR_WALLET (file path)");
    process.exit(1);
  }
}

const markets = (process.env.MARKETS || "0,1").split(",").map((s) => s.trim()).filter(Boolean);
const tsNode = join(__dirname, "..", "node_modules", ".bin", process.platform === "win32" ? "ts-node.cmd" : "ts-node");

type Svc = { name: string; file: string; env?: Record<string, string> };
const svcs: Svc[] = [
  { name: "publisher", file: "price-publisher.ts", env: { MARKETS: markets.join(",") } },
  ...markets.map((m) => ({ name: `mm-${m}`, file: "market-maker.ts", env: { MARKET: m } })),
  { name: "keeper", file: "keeper.ts", env: { MARKETS: markets.join(",") } },
];

function run(s: Svc) {
  const child = spawn(tsNode, [join(__dirname, s.file)], {
    env: { ...process.env, ...s.env },
    stdio: "inherit",
  });
  child.on("exit", (code) => {
    console.error(`[services] ${s.name} exited (code ${code}) — restarting in 3s`);
    setTimeout(() => run(s), 3000);
  });
  child.on("error", (e) => console.error(`[services] ${s.name} error: ${e.message}`));
}

console.log(`[services] starting: ${svcs.map((s) => s.name).join(", ")} (markets ${markets.join(",")})`);
svcs.forEach(run);

// Minimal health server so this can deploy as a (free) web service and survive health checks.
// Keep it awake with an external uptime pinger (UptimeRobot / cron-job.org) hitting "/" every
// ~10 min so a free instance never sleeps.
const port = Number(process.env.PORT) || 10000;
createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/plain" });
  res.end("fluxperp services ok\n");
}).listen(port, () => console.log(`[services] health server on :${port}`));

process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
