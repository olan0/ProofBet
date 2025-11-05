import express from "express";
import { UserService } from "../services/UserService";

const router = express.Router();

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
    const { wallet_address, alias } = req.body;
    if (!wallet_address || !alias) return res.status(400).json({ error: "Missing fields" });

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
