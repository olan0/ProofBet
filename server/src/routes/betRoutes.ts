// src/routes/betsRoutes.ts
import express from "express";
import Bet from "../models/Bet";
import { ALLOWED_FILTERS, ALLOWED_SORT_FIELDS } from "../config/betQueryConfig";
const router = express.Router();

// GET /api/bets
router.get("/", async (req, res) => {
  try {
   
    
    const filter = buildMongoFilter(req.query);
    const sort = buildSort(req.query);
    const { limit, skip } = buildPagination(req.query);

    const [bets, total] = await Promise.all([
      Bet.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Bet.countDocuments(filter),
    ]);

    res.json({
      data: bets,
      pagination: {
        total,
        page: Math.floor(skip / limit) + 1,
        pages: Math.ceil(total / limit),
      },
    });
   
  } catch (err) {
    res.status(400).json({ error: "Invalid query" });
  }
});

function buildSort(query: any): Record<string, 1 | -1> {
  const sortBy = ALLOWED_SORT_FIELDS.includes(query.sortBy)
    ? query.sortBy
    : "createdAt";

  const order = query.order === "asc" ? 1 : -1;

  return { [sortBy]: order } as Record<string, 1 | -1>;
}

function buildPagination(query: any) {
  const limit = Math.min(Number(query.limit) || 20, 100);
  const page = Math.max(Number(query.page) || 1, 1);
  const skip = (page - 1) * limit;

  return { limit, skip };
}

function cast(value: any, type: string) {
  if (type === "number") return Number(value);
  if (type === "date") return new Date(value);
  return value;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildMongoFilter(query: any) {
  console.log("Building filter from query:", query);
  const filter: any = {};

  for (const [key, type] of Object.entries(ALLOWED_FILTERS)) {
    // exact match
    if (query[key] !== undefined) {
      filter[key] = cast(query[key], type);
    }

    // range filters
    if (query[`min_${key}`] !== undefined) {
      filter[key] ??= {};
      filter[key].$gte = cast(query[`min_${key}`], type);
    }

    if (query[`max_${key}`] !== undefined) {
      filter[key] ??= {};
      filter[key].$lte = cast(query[`max_${key}`], type);
    }

    // string contains filter (case-insensitive)
    if (
      type === "string" &&
      query[`contains_${key}`] !== undefined
    ) {
      console.log("Adding contains filter for", key, query[`contains_${key}`]);
      filter[key] = {
        $regex: escapeRegex(String(query[`contains_${key}`])),
        $options: "i", // case-insensitive
      };
    }

  }
console.log("Built filter:", filter);
  return filter;
}

export default router;
