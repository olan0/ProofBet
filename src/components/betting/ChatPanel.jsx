
import React, { useState, useEffect, useRef } from "react";
//import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare as MessageIcon, Send, MessageCircle, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
//import { Message } from "@/entities/Message";
import { formatAddress } from "../blockchain/contracts";
import { io } from "socket.io-client";
import axios from "axios";




export default function ChatPanel({ betAddress, walletAddress, walletConnected, onRequestWalletConnect,apiBaseUrl = "http://localhost:3000/api"  }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadMessages = async () => {
    setLoading(true);
    try {
      const params = { bet_address: betAddress };
      if (search) params.search = search;
      if (walletAddress) params.walletAddress = walletAddress;

      const res = await axios.get(`${apiBaseUrl}/messages`, { params });
      setMessages(res.data.messages); 
    } catch (error) {
      console.error("Error loading messages:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (betAddress) {
      loadMessages();
      // Poll for new messages every 5 seconds
      //const interval = setInterval(loadMessages, 5000);
      //return () => clearInterval(interval);
      // Connect to socket server
      const socket = io(apiBaseUrl.replace("/api", "")); // e.g. http://localhost:3001
      socket.on("connect", () => console.log("🟢 Connected to chat socket"));
      socket.on("disconnect", () => console.log("🔴 Disconnected from socket"));

      // Listen for new messages
      socket.on("newMessage", (msg) => {
        if (msg.bet_address === betAddress) {
          setMessages((prev) => [...prev, msg]);
        }
      });
      return () => socket.disconnect();
    }
  }, [betAddress,search]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!walletConnected) {
      onRequestWalletConnect();
      return;
    }

    if (!newMessage.trim()) return;

    setSending(true);
    try {


      await axios.post(`${apiBaseUrl}/messages`, {
        bet_address: betAddress,
        sender_address: walletAddress,
        message: newMessage.trim(),
      });
      
      setNewMessage("");
      await loadMessages();
    } catch (error) {
      console.error("Error sending message:", error);
    }
    setSending(false);
  };

  return (
  <div className="space-y-4">
           { /* Messages Container */}
        <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4 h-96 overflow-y-auto space-y-3">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <MessageIcon className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            <>
              {messages.map((msg) => {
                const isOwnMessage = walletAddress && msg.sender_address.toLowerCase() === walletAddress.toLowerCase();
                const timeAgo = formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true });
                
                return (
                  <div
                    key={msg._id}
                    className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] rounded-lg p-3 ${
                      isOwnMessage 
                        ? 'bg-cyan-600 text-white' 
                        : 'bg-gray-800 border border-gray-600 text-gray-200'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium ${isOwnMessage ? 'text-cyan-100' : 'text-cyan-400'}`}>
                          {isOwnMessage ? 'You' : formatAddress(msg.sender_address)}
                        </span>
                        <span className={`text-xs ${isOwnMessage ? 'text-cyan-200' : 'text-gray-500'}`}>
                          {timeAgo}
                        </span>
                      </div>
                      <p className="text-sm break-words">{msg.message}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Message Input */}
        {walletConnected ? (
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              maxLength={500}
              disabled={sending}
            />
            <Button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
        ) : (
          <div className="text-center py-4 bg-gray-700/50 rounded-lg border border-gray-600">
            <p className="text-gray-300 text-sm mb-3">Connect your wallet to join the discussion</p>
            <Button
              onClick={onRequestWalletConnect}
              variant="outline"
              className="border-cyan-500 text-cyan-400 hover:bg-cyan-500/10"
            >
              Connect Wallet
            </Button>
          </div>
        )}
        
        
      </div>
  );
}
