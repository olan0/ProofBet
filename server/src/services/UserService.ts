import { User, IUser } from "../models/User";

export class UserService {
  /**
   * Retrieve user by wallet
   */
  static async getUser(wallet_address: string): Promise<IUser | null> {
    return await User.findOne({ wallet_address });
  }

  /**
   * Retrieve alias only
   */
  static async getAlias(wallet_address: string): Promise<string | null> {
    const user = await User.findOne({ wallet_address });
    return user ? user.alias : null;
  }

  /**
   * Check if alias already exists
   */
  static async aliasExists(alias: string): Promise<boolean> {
    const existing = await User.findOne({ alias });
    return !!existing;
  }

  /**
   * Create or update alias — checks for duplicates first
   */
  static async updateAlias(wallet_address: string, alias: string): Promise<IUser | null> {
    // check if alias is already taken
    const exists = await User.findOne({ alias });
    if (exists && exists.wallet_address !== wallet_address) {
      throw new Error("Alias already in use");
    }

    // create or update
    return await User.findOneAndUpdate(
      { wallet_address },
      { alias },
      { new: true, upsert: true }
    );
  }
}
