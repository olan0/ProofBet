import express from "express";
import { ethers } from "ethers";
import { UserService } from "../services/UserService";

const router = express.Router();

const MAX_AGE_MS = 5 * 60 * 1000;

function verifySig(message: string, signature: string, timestamp: number, expected: string): boolean {
  if (Date.now() - timestamp > MAX_AGE_MS) return false;
  const recovered = ethers.verifyMessage(`${message}:${timestamp}`, signature).toLowerCase();
  return recovered === expected.toLowerCase();
}

// Retrieve alias for a wallet
router.get("/:wallet_address", async (req, res) => {
  try {
    const alias = await UserService.getAlias(req.params.wallet_address);
    if (!alias) return res.status(404).json({ message: "Alias not found" });
    res.json({ alias });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to retrieve alias" });
  }
});

// Create or update alias (with duplicate check)
router.post("/", async (req, res) => {
  try {
    const { wallet_address, alias, signature, timestamp } = req.body;
    if (!wallet_address) return res.status(400).json({ error: "Missing fields" });

    if (!signature || !timestamp) {
      return res.status(401).json({ error: "Signature required" });
    }

    const payload = `proofbet:alias:${wallet_address}:${alias ?? ""}`;
    if (!verifySig(payload, signature, Number(timestamp), wallet_address)) {
      return res.status(401).json({ error: "Invalid or expired signature" });
    }

    const user = await UserService.updateAlias(wallet_address, alias);
    res.json(user);
  } catch (err: any) {
    console.error("❌ Alias update error:", err);
    if (err.message === "Alias already in use") {
      return res.status(409).json({ error: "Alias already in use" });
    }
    res.status(500).json({ error: "Failed to set alias" });
  }
});

export default router;
