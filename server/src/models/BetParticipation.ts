import mongoose, { Schema, Document } from "mongoose";

export interface IBetParticipation extends Document {
  betId: string;
  user: string;
  title: string;
  side: number;            // 1 = YES, 2 = NO
  amountUsdc: number;
  blockNumber: number;
  txHash: string;
  createdAt: Date;
}

const BetParticipationSchema = new Schema<IBetParticipation>(
  {
    betId: { type: String, required: true, index: true },
    title: {type: String, required: true},
    user: { type: String, required: true, index: true },
    side: { type: Number, required: true },
    amountUsdc: { type: Number, required: true },

    blockNumber: { type: Number, required: true, index: true },
    txHash: { type: String, required: true, index: true },
    createdAt: { type: Date, default: Date.now }
  
  }
);

// Prevent duplicates on re-sync
BetParticipationSchema.index(
  { txHash: 1, user: 1 },
  { unique: true }
);



export default mongoose.model<IBetParticipation>(
  "BetParticipation",
  BetParticipationSchema
);
