import mongoose, { Schema, Document, Model } from "mongoose";

export interface IFaucetClaim extends Document {
  wallet_address: string;
  claimed_at: Date;
  amount: number; // in PROOF (wei-based)
  tx_hash?: string;
}

const FaucetClaimSchema = new Schema<IFaucetClaim>(
  {
    wallet_address: { type: String, required: true, lowercase: true },
    claimed_at: { type: Date, required: true, default: Date.now },
    amount: { type: Number, required: true },
    tx_hash: { type: String },
  },
  { timestamps: true }
);

// Index for checking daily claims
FaucetClaimSchema.index({ wallet_address: 1, claimed_at: 1 });

export const FaucetClaim: Model<IFaucetClaim> =
  mongoose.models.FaucetClaim || mongoose.model<IFaucetClaim>("FaucetClaim", FaucetClaimSchema);
