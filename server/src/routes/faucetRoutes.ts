import express from "express";
import { FaucetService } from "../services/FaucetService";

const router = express.Router();

/**
 * POST /api/faucet/claim
 * Claim 50 PROOF tokens (once per day per address)
 */
router.post("/claim", async (req, res) => {
  try {
    const { wallet_address } = req.body;

    if (!wallet_address) {
      return res.status(400).json({ error: "Missing wallet_address" });
    }

    const result = await FaucetService.claimFaucet(wallet_address);

    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        txHash: result.txHash,
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
      });
    }
  } catch (err) {
    console.error("Faucet claim error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/faucet/status/:wallet_address
 * Check if address has claimed today
 */
router.get("/status/:wallet_address", async (req, res) => {
  try {
    const { wallet_address } = req.params;

    const claimedToday = await FaucetService.hasClaimedToday(wallet_address);
    const lastClaim = await FaucetService.getLastClaim(wallet_address);

    res.json({
      wallet_address,
      claimedToday,
      lastClaim: lastClaim
        ? {
            claimed_at: lastClaim.claimed_at,
            amount: lastClaim.amount,
            tx_hash: lastClaim.tx_hash,
          }
        : null,
      nextClaimTime: claimedToday
        ? new Date(new Date().getTime() + 24 * 60 * 60 * 1000)
        : null,
    });
  } catch (err) {
    console.error("Faucet status error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
