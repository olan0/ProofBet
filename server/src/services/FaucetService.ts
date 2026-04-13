import { FaucetClaim } from "../models/FaucetClaim";
import { ethers } from "ethers";

const FAUCET_AMOUNT = ethers.parseEther("50"); // 50 PROOF
const PRIVATE_KEY = process.env.KEEPER_PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL;
const PROOF_TOKEN_ADDRESS = process.env.PROOF_TOKEN_ADDRESS;

export class FaucetService {
  /**
   * Check if an address has claimed today
   */
  static async hasClaimedToday(walletAddress: string): Promise<boolean> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const claim = await FaucetClaim.findOne({
      wallet_address: walletAddress.toLowerCase(),
      claimed_at: { $gte: today, $lt: tomorrow },
    });

    return !!claim;
  }

  /**
   * Get last claim for an address
   */
  static async getLastClaim(walletAddress: string) {
    return FaucetClaim.findOne({
      wallet_address: walletAddress.toLowerCase(),
    }).sort({ claimed_at: -1 });
  }

  /**
   * Process faucet claim - transfer PROOF to wallet
   */
  static async claimFaucet(walletAddress: string): Promise<{
    success: boolean;
    message: string;
    txHash?: string;
  }> {
    try {
      // Verify address format
      if (!ethers.isAddress(walletAddress)) {
        return { success: false, message: "Invalid wallet address" };
      }

      // Check if already claimed today
      const claimedToday = await this.hasClaimedToday(walletAddress);
      if (claimedToday) {
        return { success: false, message: "Already claimed today. Try again tomorrow!" };
      }

      // Verify keeper credentials
      if (!PRIVATE_KEY || !RPC_URL || !PROOF_TOKEN_ADDRESS) {
        console.error("Missing faucet configuration");
        return { success: false, message: "Faucet not properly configured" };
      }

      // Create provider and signer
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const signer = new ethers.Wallet(PRIVATE_KEY, provider);

      // Simple ERC20 transfer ABI
      const erc20Abi = [
        "function transfer(address to, uint256 amount) returns (bool)",
        "function balanceOf(address account) view returns (uint256)",
      ];

      const proofToken = new ethers.Contract(PROOF_TOKEN_ADDRESS, erc20Abi, signer);

      // Check balance
      const balance = await proofToken.balanceOf(signer.address);
      if (balance < FAUCET_AMOUNT) {
        console.error("Insufficient PROOF balance in faucet", {
          balance: ethers.formatEther(balance),
          needed: ethers.formatEther(FAUCET_AMOUNT),
        });
        return { success: false, message: "Faucet out of PROOF temporarily" };
      }

      // Send transfer
      console.log(`💰 Sending 50 PROOF to ${walletAddress}`);
      const tx = await proofToken.transfer(walletAddress, FAUCET_AMOUNT);
      console.log(`   TX: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();
      if (!receipt) {
        return { success: false, message: "Transaction failed" };
      }

      // Record claim
      await FaucetClaim.create({
        wallet_address: walletAddress.toLowerCase(),
        amount: FAUCET_AMOUNT.toString(),
        tx_hash: receipt.hash,
      });

      return {
        success: true,
        message: "Claimed 50 PROOF! Check your wallet.",
        txHash: receipt.hash,
      };
    } catch (err: any) {
      console.error("Faucet claim error:", err);
      return {
        success: false,
        message: err.message || "Claim failed. Please try again.",
      };
    }
  }
}
