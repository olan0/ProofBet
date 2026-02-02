import mongoose, { Schema, Document } from "mongoose";

export interface IBetVote extends Document {
  betId: string;
  title: string;
  voter: string;
  vote: number;           // 1 = YES, 2 = NO, 3 = INVALID
  stakeProof: string;     // bigint → string
  blockNumber: number;
  txHash: string;
  createdAt:  Date;
}

const BetVoteSchema = new Schema<IBetVote>(
  {
    betId: { type: String, required: true, index: true },
    title: {type: String, required: true},
    voter: { type: String, required: true, index: true },
    vote: { type: Number, required: true },
    stakeProof: { type: String, required: false },

    blockNumber: { type: Number, required: true, index: true },
    txHash: { type: String, required: true, index: true },
    createdAt: { type: Date, default: Date.now }
    
  
   
  }
);

// One vote per tx per voter
BetVoteSchema.index(
  { txHash: 1, voter: 1 },
  { unique: true }
);



export default mongoose.model<IBetVote>(
  "BetVote",
  BetVoteSchema
);
