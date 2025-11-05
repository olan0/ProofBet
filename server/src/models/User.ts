import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  wallet_address: string;   // unique identifier
  alias: string;            // display name
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    wallet_address: { type: String, required: true, unique: true },
    alias: { type: String, required: true },
  },
  { timestamps: true }
);

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
