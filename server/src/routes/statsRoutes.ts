import { Router, Request, Response } from "express";
import Bet from "../models/Bet";
import Activity from "../models/Activity";

const router = Router();

/**
 * Helpers
 */
const parseLimit = (req: Request, def = 5) =>
  Math.min(parseInt(req.query.limit as string) || def, 50);

/**
 * 1️⃣ Platform Stats
 * GET /api/stats/platform
 */
router.get("/platform", async (_req, res) => {
  try {
    const [betStats] = await Bet.aggregate([
      {
        $group: {
          _id: null,
          totalBets: { $sum: 1 },
          activeBets: {
            $sum: { $cond: [{ $eq: ["$status", 1] }, 1, 0] }
          },
          completedBets: {
            $sum: { $cond: [{ $eq: ["$status", 3] }, 1, 0] }
          },
          cancelledBets: {
            $sum: { $cond: [{ $eq: ["$status", 4] }, 1, 0] }
          },
          totalVolume: { $sum: "$totalBet" }
        }
      }
    ]);

    const totalParticipants = await Activity.distinct("actor");

    res.json({
      totalBets: betStats?.totalBets ?? 0,
      totalVolume: betStats?.totalVolume ?? 0,
      totalParticipants: totalParticipants.length,
      activeBets: betStats?.activeBets ?? 0,
      completedBets: betStats?.completedBets ?? 0,
      cancelledBets: betStats?.cancelledBets ?? 0
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load platform stats" });
  }
});

/**
 * 2️⃣ Top Active Markets
 * GET /api/stats/top-active
 */
router.get("/top-active", async (req, res) => {
  const limit = parseLimit(req);

  try {
    const data = await Activity.aggregate([
      // 1) group activity by betId, collect unique actors
      {
        $group: {
          _id: "$betId",
          actors: { $addToSet: "$actor" },
        },
      },

      // 2) compute activityCount
      {
        $project: {
          _id: 0,
          betId: "$_id",
          activityCount: { $size: "$actors" },
        },
      },

      // 3) join bets to fetch metadata
      {
        $lookup: {
          from: "bets",              // ✅ must match the Mongo collection name for Bet
          localField: "betId",
          foreignField: "betId",     // ✅ must match your Bet schema field name
          as: "bet",
        },
      },
      { $unwind: { path: "$bet", preserveNullAndEmptyArrays: true } },

      // 4) select fields you want
      {
        $project: {
          betId: 1,
          activityCount: 1,
          title: "$bet.title",
          deadlines: "$bet.deadlines",        // if you store as array [bettingEnd, proofEnd, voteEnd]
          bettingDeadline: "$bet.bettingDeadline",    // optional if you have a single field
          status: "$bet.status",
          createdAt: "$bet.createdAt",
        },
      },

      // 5) sort + limit
      { $sort: { activityCount: -1, createdAt: -1 } },
      { $limit: limit },
    ]);

    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: "Failed to load top active markets", detail: e?.message });
  }
});


/**
 * 2️⃣ Top Volume Markets
 * GET /api/stats/top-volume
 */
router.get("/top-volume", async (req, res) => {
  const limit = parseLimit(req);

  try {
    const data = await Bet.find()
      .sort({ totalBet: -1 })
      .limit(limit)
      .select("betId title totalBet bettingDeadline");

    res.json(data);
  } catch {
    res.status(500).json({ error: "Failed to load top volume markets" });
  }
});

/**
 * 2️⃣ Recent Markets
 * GET /api/stats/recent
 */
router.get("/recent", async (req, res) => {
  const limit = parseLimit(req);

  try {
    const data = await Bet.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("betId title createdAt totalBet bettingDeadline");

    res.json(data);
  } catch {
    res.status(500).json({ error: "Failed to load recent markets" });
  }
});

/**
 * 3️⃣ Top Creators
 * GET /api/stats/top-creators
 */
router.get("/top-creators", async (req, res) => {
  const limit = parseLimit(req);

  try {
    const data = await Bet.aggregate([
      {
        $group: {
          _id: "$creator",
          marketCount: { $sum: 1 },
          totalVolume: { $sum: "$totalBet" }
        }
      },
      { $sort: { marketCount: -1 } },
      { $limit: limit }
    ]);

    res.json(
      data.map(d => ({
        address: d._id,
        marketCount: d.marketCount,
        totalVolume: d.totalVolume
      }))
    );
  } catch {
    res.status(500).json({ error: "Failed to load top creators" });
  }
});

/**
 * 4️⃣ User Stats
 * GET /api/stats/user/:wallet
 */
router.get("/user/:wallet", async (req, res) => {
  const wallet = req.params.wallet?.toLowerCase();

  try {
    const marketsCreated = await Bet.countDocuments({
      creator: wallet
    });

    const volumeCreated = await Bet.aggregate([
      { $match: { creator: wallet } },
      { $group: { _id: null, volume: { $sum: "$totalBet" } } }
    ]);

    const activities = await Activity.aggregate([
      { $match: { actor: wallet } },
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
          totalUsdc: { $sum: "$amountUsdc" }
        }
      }
    ]);

    const bettor = activities.find(a => a._id === 2) || {};
    const voter = activities.find(a => a._id === 3) || {};

    res.json({
      marketsCreated,
      totalVolumeCreated: volumeCreated[0]?.volume ?? 0,
      betsPlaced: bettor.count ?? 0,
      totalStaked: bettor.totalUsdc ?? 0,
      votesCount: voter.count ?? 0
    });
  } catch {
    res.status(500).json({ error: "Failed to load user stats" });
  }
});

/**
 * 5️⃣ Category Breakdown
 * GET /api/stats/by-category
 */
router.get("/by-category", async (_req, res) => {
  try {
    const data = await Bet.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
          volume: { $sum: "$totalBet" }
        }
      }
    ]);

    const result: Record<string, any> = {};
    for (const row of data) {
      result[row._id] = {
        count: row.count,
        volume: row.volume
      };
    }

    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to load category stats" });
  }
});

export default router;
