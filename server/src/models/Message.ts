import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Message interface — defines the schema shape and TypeScript type.
 */
export interface IMessage extends Document {
  bet_address: string;       // blockchain bet address
  sender_address: string;    // wallet of sender
  message: string;           // message content
  sender_alias?: string;     // optional display name
  timestamp: Date;           // creation date
}

/**
 * Mongoose schema definition
 */
const MessageSchema: Schema<IMessage> = new Schema<IMessage>({
  bet_address: {
    type: String,
    required: true,
    index: true,
    description: "The blockchain address of the bet this message belongs to",
  },
  sender_address: {
    type: String,
    required: true,
    description: "Wallet address of the message sender",
  },
  message: {
    type: String,
    required: true,
    description: "The message content",
  },
  sender_alias: {
    type: String,
    description: "Display name of the sender (optional)",
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// helpful indexes for querying
MessageSchema.index({ bet_address: 1, timestamp: -1 });
MessageSchema.index({ sender_address: 1 });
MessageSchema.index({ message: "text" });

export const Message: Model<IMessage> =
  mongoose.models.Message || mongoose.model<IMessage>("Message", MessageSchema);
