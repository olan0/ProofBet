/**
 * Scheduler for keeper job - runs daily at midnight UTC
 */

import cron from "node-cron";
import { runKeeper } from "./keeperJob";

export function startKeeperScheduler() {
  // Run at 00:00 UTC every day
  const task = cron.schedule("0 0 * * *", async () => {
    console.log("🔔 Keeper job triggered by scheduler");
    await runKeeper();
  });

  console.log("✅ Keeper scheduler started (runs daily at midnight UTC)");
  return task;
}
