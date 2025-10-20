import express from "express";
import { MessageService } from "../services/MessageService";
import { io } from "../server";

const router = express.Router();

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
    const msg = await MessageService.createMessage(req.body);
     // Emit to all connected clients
    io.emit("newMessage", msg);
    res.status(201).json(msg);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Failed to create message" });
  }
});

export default router;
