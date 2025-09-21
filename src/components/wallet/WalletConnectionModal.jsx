import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wallet, AlertCircle, CheckCircle } from "lucide-react";

export default function WalletConnectionModal({ isOpen, onClose, onConnect }) {
  const [connectionMethod, setConnectionMethod] = useState("metamask");
  const [manualAddress, setManualAddress] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  const handleConnect = async () => {
    setConnecting(true);
    setError("");

    try {
      if (connectionMethod === "metamask") {
        // Simulate MetaMask connection
        if (typeof window !== 'undefined' && window.ethereum) {
          // In a real app, this would be: await window.ethereum.request({ method: 'eth_requestAccounts' });
          const mockAddress = "0x742d35Cc6Ee1234567890123456789012345f3a";
          await onConnect(mockAddress);
        } else {
          setError("MetaMask not detected. Please install MetaMask or use manual entry.");
          setConnecting(false);
          return;
        }
      } else if (connectionMethod === "walletconnect") {
        // Simulate WalletConnect
        const mockAddress = "0x" + Math.random().toString(16).substr(2, 40);
        await onConnect(mockAddress);
      } else if (connectionMethod === "manual") {
        if (!manualAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
          setError("Please enter a valid Ethereum address (0x...)");
          setConnecting(false);
          return;
        }
        await onConnect(manualAddress);
      }
      
      onClose();
    } catch (err) {
      setError("Failed to connect wallet. Please try again.");
    }
    setConnecting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Wallet className="w-5 h-5 text-cyan-400" />
            Connect Your Wallet
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Alert className="bg-blue-500/10 border-blue-500/20">
            <AlertCircle className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-blue-200">
              You need to connect a wallet to place bets, vote, or claim rewards.
            </AlertDescription>
          </Alert>

          <div className="space-y-3">
            <div 
              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                connectionMethod === "metamask" 
                  ? 'border-cyan-500 bg-cyan-500/10' 
                  : 'border-gray-600 hover:border-gray-500'
              }`}
              onClick={() => setConnectionMethod("metamask")}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold">MetaMask</h3>
                  <p className="text-xs text-gray-400">Connect using MetaMask browser extension</p>
                </div>
                {connectionMethod === "metamask" && <CheckCircle className="w-5 h-5 text-cyan-400 ml-auto" />}
              </div>
            </div>

            <div 
              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                connectionMethod === "walletconnect" 
                  ? 'border-cyan-500 bg-cyan-500/10' 
                  : 'border-gray-600 hover:border-gray-500'
              }`}
              onClick={() => setConnectionMethod("walletconnect")}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold">WalletConnect</h3>
                  <p className="text-xs text-gray-400">Connect using mobile wallet</p>
                </div>
                {connectionMethod === "walletconnect" && <CheckCircle className="w-5 h-5 text-cyan-400 ml-auto" />}
              </div>
            </div>

            <div 
              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                connectionMethod === "manual" 
                  ? 'border-cyan-500 bg-cyan-500/10' 
                  : 'border-gray-600 hover:border-gray-500'
              }`}
              onClick={() => setConnectionMethod("manual")}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-600 rounded-lg flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold">Manual Entry</h3>
                  <p className="text-xs text-gray-400">Enter wallet address manually</p>
                </div>
                {connectionMethod === "manual" && <CheckCircle className="w-5 h-5 text-cyan-400 ml-auto" />}
              </div>
            </div>
          </div>

          {connectionMethod === "manual" && (
            <div className="space-y-2">
              <Label htmlFor="address" className="text-gray-300">Ethereum Address</Label>
              <Input
                id="address"
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="0x742d35Cc6Ee1234567890123456789012345f3a"
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="bg-red-900/20 border-red-500/50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-red-200">{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3 pt-2">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleConnect}
              disabled={connecting || (connectionMethod === "manual" && !manualAddress)}
              className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700"
            >
              {connecting ? 'Connecting...' : 'Connect Wallet'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}