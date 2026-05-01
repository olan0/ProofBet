/**
 * Scheduler for keeper job - runs daily at midnight UTC
 */

import cron from "node-cron";
import { runKeeper } from "./keeperJob";

export function startKeeperScheduler() {
  // Run immediately on startup, then daily at midnight UTC
  runKeeper().catch(console.error);

  const task = cron.schedule("0 0 * * *", async () => {
    console.log("🔔 Keeper job triggered by scheduler");
    await runKeeper();
  });

  console.log("✅ Keeper scheduler started (runs on startup + daily at midnight UTC)");
  return task;
}
