// src/routes/betsRoutes.ts
import express from "express";
import Bet from "../models/Bet";
import { log } from "console";

const router = express.Router();

/**
 * Map field -> type for casting query params.
 * Adjust as your Bet schema evolves.
 */
const FIELD_TYPES: Record<
  string,
  "string" | "number" | "date" | "address"
> = {
  // core identifiers
  betId: "address",
  creator: "address",

  // enums from contract (you said these are integers)
  status: "number",
  category: "number",
  proofType: "number",

  // strings
  title: "string",
  description: "string",

  // timestamps
  createdAt: "date",
  updatedAt: "date",

  // aggregates we compute in pipeline
  totalStake: "number",
  totalParticipants: "number",
  totalBet: "number",
  yesVotes: "number",
  noVotes: "number",
  invalidVotes: "number",
  totalVotes: "number",
};

// query params we should never treat as filters
const RESERVED_PARAMS = new Set([
  "sort",
  "order",
  "limit",
  "cursor",
  "user",
  "activity",
]);

function castByField(field: string, raw: unknown) {
  const t = FIELD_TYPES[field] ?? "string";
  if (raw === undefined || raw === null) return raw;

  const s = String(raw);

  if (t === "number") {
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  }

  if (t === "date") {
    const d = new Date(s);
    return isNaN(d.getTime()) ? undefined : d;
  }

  // address/string are both stored as strings
  return s;
}

function isFilterableKey(key: string) {
  if (RESERVED_PARAMS.has(key)) return false;
  if (key.startsWith("min_")) return false;
  if (key.startsWith("max_")) return false;
  if (key.startsWith("contains_")) return false;
  return true;
}

function applyUserActivityFilter(pipeline: any[], user?: string, activity?: string) {
  if (!user || !activity) return;

  if (activity === "creator") {
    pipeline.push({ $match: { creator: user } });
    return;
  }

  if (activity === "bettor") {
    // requires lookup parts already present in pipeline
    pipeline.push({
      $match: { "parts.participant": user },
    });
    return;
  }

  if (activity === "voter") {
    // votes lookup already exists earlier; just match it
    pipeline.push({
      $match: { "votes.voter": user },
    });
    return;
  }
}

function applyCursor(
  pipeline: any[],
  query: any,
  sortField: string,
  sortOrder: 1 | -1
) {
  if (!query.cursor) return;

  const cursorVal = castByField(sortField, query.cursor);

  if (cursorVal === undefined) return;

  pipeline.push({
    $match: {
      [sortField]:
        sortOrder === -1
          ? { $lt: cursorVal }
          : { $gt: cursorVal },
    },
  });
}

function buildBaseMatch(query: any) {
  const match: any = {};

  for (const [key, value] of Object.entries(query)) {
   

    // exact matches
    if (isFilterableKey(key)) {
      const casted = castByField(key, value);
      if (casted !== undefined) {
        match[key] = casted;
      }
    }
    if (key.startsWith("min_")) {
        const field = key.replace("min_", "");
        const casted = castByField(field, value);
        if (casted !== undefined) {
          //pipeline.push({ $match: { [field]: { $gte: casted } } });
          match[field] ={ $gte: casted }
          //match[field].$gte = casted;
        }
      }

      if (key.startsWith("max_")) {
        const field = key.replace("max_", "");
        const casted = castByField(field, value);
        if (casted !== undefined) {
          //pipeline.push({ $match: { [field]: { $lte: casted } } });
          match[field] ={ $lte: casted }
        }
      }
      
       // contains_
        if (key.startsWith("contains_")) {
          const field = key.replace("contains_", "");

          // only apply contains_ to string-ish fields (avoid regex on numbers)
          const t = FIELD_TYPES[field];
          if (t && t !== "string") continue;

          match[field] = { $regex: String(value), $options: "i" };
          continue;
        }
  }

  return match;
}

// GET /api/bets
router.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const sortField = String(req.query.sort || "createdAt");
    const sortOrder = req.query.order === "asc" ? 1 : -1;

    const pipeline: any[] = [];
    console.log("query:", req.query);

    // 1) Base indexed filters (exact + contains_)
    pipeline.push({ $match: buildBaseMatch(req.query) });

    // 2) Cursor pagination (cursor compares against sortField type)
    applyCursor(pipeline, req.query, sortField, sortOrder);

   
    // 8) Sorting + limit
    pipeline.push({ $sort: { [sortField]: sortOrder } });
    pipeline.push({ $limit: limit + 1 });
    //console.log("Aggregation pipeline:", JSON.stringify(pipeline, null, 2));
    const bets = await Bet.aggregate(pipeline);


    const hasNext = bets.length > limit;
    const data = hasNext ? bets.slice(0, limit) : bets;
    
    const nextCursor =
      hasNext && data.length
        ? bets[data.length - 1][sortField]
        : null;
    

        res.json({
      data,
      pagination: {
        limit,
        hasNext,
        nextCursor
        
      },
    });
     
  } catch (err: any) {
    console.error("❌ GET /api/bets failed:", err);
    res.status(500).json({ error: err?.message ?? "Unknown error" });
  }
});

export default router;
