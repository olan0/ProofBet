import express from "express";
import { ethers } from "ethers";
import { MessageService } from "../services/MessageService";
import { io } from "../server";

const router = express.Router();

const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

function verifySig(message: string, signature: string, timestamp: number, expected: string): boolean {
  if (Date.now() - timestamp > MAX_AGE_MS) return false;
  const recovered = ethers.verifyMessage(`${message}:${timestamp}`, signature).toLowerCase();
  return recovered === expected.toLowerCase();
}

router.get("/", async (req, res) => {
  try {
    const { bet_address, sender_address, search, page, limit } = req.query;
    const messages = await MessageService.getMessages({
      bet_address: String(bet_address),
      sender_address: sender_address ? String(sender_address) : undefined,
      search: search ? String(search) : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });

    const total = await MessageService.countMessages({
      bet_address: String(bet_address),
      sender_address: sender_address ? String(sender_address) : undefined,
      search: search ? String(search) : undefined,
    });

    res.json({ messages, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { bet_address, sender_address, message, signature, timestamp } = req.body;

    if (!signature || !timestamp) {
      return res.status(401).json({ error: "Signature required" });
    }

    const payload = `proofbet:message:${bet_address}:${message}`;
    if (!verifySig(payload, signature, Number(timestamp), sender_address)) {
      return res.status(401).json({ error: "Invalid or expired signature" });
    }

    const msg = await MessageService.createMessage(req.body);
    io.emit("newMessage", msg);
    res.status(201).json(msg);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Failed to create message" });
  }
});

export default router;
