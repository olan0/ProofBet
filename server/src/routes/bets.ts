// src/routes/bets.ts
import express from "express";
import Bet from "../models/Bet";

const router = express.Router();

router.get("/", async (req, res) => {
  const { status = "OPEN_FOR_BETS", page = 1, limit = 25 } = req.query;
  const bets = await Bet.find({ status })
    .sort({ createdAt: -1 })
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit));
  res.json(bets);
});

export default router;
