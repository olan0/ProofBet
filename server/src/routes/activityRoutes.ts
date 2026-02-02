import { Router, Request, Response } from "express";
import Activity from "../models/Activity";
import { title } from "process";

const router = Router();

const MAX_LIMIT = 100;



router.get("/", async (req, res) => {

  const filter: any = {};
  const actor = (req.query.actor as string)?.toLowerCase();
  if (!actor) {
    return res.status(400).json({ error: "user is required" });
  }
  else {
      filter.actor = actor
  }

  const rawType = (req.query.type as string) ?? "1|2|3";
  //const roles = rawType.split("|").map(r => r.trim());

  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
  const cursor = req.query.cursor ? new Date(req.query.cursor as string) : null;

  
  filter.role = {
    $in: String(rawType)
      .split("|")
      .map(v => Number(v)),
  };
  if (cursor) {
     filter.timestamp = { $lt: cursor };
  }
  const items = await Activity.find(filter)
  .sort({ timestamp: -1 })
  .limit(limit + 1);

const hasNext = items.length > limit;
if (hasNext) items.pop();
console.log("filter:", filter);

res.json({
  items,
  pageInfo: {
    nextCursor: hasNext
      ? items[items.length - 1].timestamp
      : null,
    hasNext,
  },
});});


export default router;
