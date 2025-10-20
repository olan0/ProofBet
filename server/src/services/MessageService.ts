import { Message, IMessage } from "../models/Message";

interface FilterOptions {
  bet_address: string;
  sender_address?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class MessageService {
  /**
   * Get messages with optional filters and pagination
   */
  static async getMessages({
    bet_address,
    sender_address,
    search,
    page = 1,
    limit = 20,
  }: FilterOptions): Promise<IMessage[]> {
    const query: any = { bet_address };

    if (sender_address) query.sender_address = sender_address;
    if (search) query.message = { $regex: search, $options: "i" };

    const skip = (page - 1) * limit;

    return await Message.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
  }

  /**
   * Count total messages matching filters (for pagination)
   */
  static async countMessages({
    bet_address,
    sender_address,
    search,
  }: FilterOptions): Promise<number> {
    const query: any = { bet_address };

    if (sender_address) query.sender_address = sender_address;
    if (search) query.message = { $regex: search, $options: "i" };

    return await Message.countDocuments(query);
  }

  /**
   * Create a new message
   */
  static async createMessage(data: {
    bet_address: string;
    sender_address: string;
    message: string;
    sender_alias?: string;
  }): Promise<IMessage> {
    const newMsg = new Message(data);
    return await newMsg.save();
  }
}
