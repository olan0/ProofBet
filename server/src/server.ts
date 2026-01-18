import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import messageRoutes from "./routes/messageRoutes";
import userRoutes from "./routes/userRoutes";
import betRoutes from "./routes/betRoutes";
import { Server } from "socket.io";
import http from "http";
import { initEventSync } from "./services/EventSync";

dotenv.config();

const app = express();
const server = http.createServer(app);

// Create Socket.IO instance
export const io = new Server(server, {
  cors: {
    origin: "*", // change to your frontend URL in production
  },
});

app.use(cors());
app.use(express.json());

// Connect to MongoDB
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) throw new Error("MONGO_URI missing in .env");

mongoose
  .connect(mongoUri)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

// Routes

app.use("/api/messages", messageRoutes);
app.use("/api/users", userRoutes);
app.use("/api/bets", betRoutes);
initEventSync().catch(console.error);
//startBetIndexer();
// Handle socket connections
io.on("connection", (socket) => {
  console.log("🟢 Client connected:", socket.id);
  socket.on("disconnect", () => console.log("🔴 Client disconnected:", socket.id));
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));