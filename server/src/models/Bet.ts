// src/models/Bet.ts
import { N } from "ethers";
import mongoose from "mongoose";

const BetSchema = new mongoose.Schema({
  betId: { type: String, unique: true },
  creator: { type: String, index: true },
  title: String,
  description: String,
  status: {
    type: String,
    enum: ["OPEN_FOR_BETS", "AWAITING_PROOF", "VOTING", "COMPLETED", "CANCELLED"],
    default: "OPEN_FOR_BETS",
  },
  totalYesStake: { type: String, default: "0" },
  totalNoStake: { type: String, default: "0" },
  totalVotes: { type: Number, default: 0 },
  yesVotes: { type: Number, default: 0 },
  noVotes: { type: Number, default: 0 },
  invalidVotes: { type: Number, default: 0 },
  proofUrl: String,
  winningSide: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  resolvedAt: Date,
  blockNumber: Number,
  txHash: String,
  rewardPerWinner: Number,
  rewardPerVoter: Number,
  bettingDeadline: Number,
  proofDeadline: Number,
  votingDeadline: Number,
});

export default mongoose.model("Bet", BetSchema);
