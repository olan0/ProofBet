import mongoose from "mongoose";

const SyncStateSchema = new mongoose.Schema({
  contract: { type: String, required: true, unique: true },
  lastProcessedBlock: { type: Number, default: 0 },
});

export const SyncState = mongoose.model("SyncState", SyncStateSchema);
