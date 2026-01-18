// src/models/Bet.ts
import { N } from "ethers";
import mongoose from "mongoose";

const BetSchema = new mongoose.Schema({
  betId: { type: String, unique: true },
  creator: { type: String, index: true },
  title: String,
  description: String,
  status: { type: Number, default: 0, index: true }, // 0: OPEN_FOR_BETS, 1: AWAITING_PROOF, 2: VOTING_IN_PROGRESS, 3: RESOLVED, 4: CANCELED
  category:{ type: Number, requred: true, index: true }, // Category enum
  proofType:{ type: Number, requred: true, index: true }, // ProofType enum
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
