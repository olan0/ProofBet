import { Schema, model } from "mongoose";

export enum ActivityType {
  CREATE = 1,
  BET = 2,
  VOTE = 3,
}

export enum ActorRole {
  CREATOR = 1,
  BETTOR = 2,
  VOTER = 3,
}


interface IActivity {
  txHash: string;
  blockNumber: number;
  timestamp: Date;

  betId: string;
  betTitle?: string;
  betStatus?: number;

  actor: string;          // address
  role: ActorRole;        // CREATOR | BETTOR | VOTER
  type: ActivityType;     // CREATE | BET | VOTE | RESOLVE | CANCEL

  side?: number;          // YES / NO / INVALID
  amountUsdc?: string;    // store as string (BigInt safe)
  amountProof?: string;

  metadata?: Record<string, any>;
}
const numericEnumValues = <T extends object>(e: T) =>
  Object.values(e).filter(v => typeof v === "number");

const ActivitySchema = new Schema<IActivity>({
  txHash: { type: String, index: true },
  blockNumber: { type: Number, index: true },
  timestamp: { type: Date, index: true },

  betId: { type: String, index: true },
  betTitle: String,
  betStatus: Number,

  actor: { type: String, index: true, lowercase: true },
 
  role: {
    type: Number,
    enum: numericEnumValues(ActorRole),
    index: true,
    required: true,
  },

  type: {
    type: Number,
    enum: numericEnumValues(ActivityType),
    index: true,
    required: true,
  },

  side: Number,
  amountUsdc: String,
  amountProof: String,

  metadata: Schema.Types.Mixed,
});

ActivitySchema.index({ actor: 1, timestamp: -1 });
ActivitySchema.index({ betId: 1, timestamp: -1 });

export default model<IActivity>("Activity", ActivitySchema);
