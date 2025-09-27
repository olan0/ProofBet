
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Droplet, AlertCircle } from "lucide-react";
import { getUsdcTokenContract, getProofTokenContract } from "../blockchain/contracts";
import { ethers } from "ethers";

export default function FaucetPanel({ walletAddress }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usdcAmount, setUsdcAmount] = useState("1000");
  const [proofAmount, setProofAmount] = useState("500");
  const [recipientAddress, setRecipientAddress] = useState(walletAddress || "");

  // Add an effect to sync the recipient address with the connected wallet address
  useEffect(() => {
    if (walletAddress) {
      setRecipientAddress(walletAddress);
    }
  }, [walletAddress]);


  const handleGetTokens = async (tokenType) => {
    setLoading(true);
    setError("");
    try {
      if (!ethers.isAddress(recipientAddress)) {
        throw new Error("Invalid recipient address.");
      }

      if (tokenType === 'usdc') {
        const usdcContract = getUsdcTokenContract(true); // with signer
        const amount = ethers.parseUnits(usdcAmount, 6); // USDC has 6 decimals
        const tx = await usdcContract.mint(recipientAddress, amount);
        await tx.wait();
        alert(`Successfully minted ${usdcAmount} mUSDC to ${recipientAddress}!`);
      }

      if (tokenType === 'proof') {
        const proofContract = getProofTokenContract(true); // with signer
        const amount = ethers.parseEther(proofAmount); // PROOF has 18 decimals
        const tx = await proofContract.transfer(recipientAddress, amount);
        await tx.wait();
        alert(`Successfully transferred ${proofAmount} PROOF to ${recipientAddress}!`);
      }

    } catch (err) {
      console.error("Failed to get tokens:", err);
      const message = err.reason || "Operation failed. Make sure you are connected as the contract owner (deployer account).";
      setError(message);
    }
    setLoading(false);
  };

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Droplet className="w-5 h-5 text-blue-400" />
          Test Token Faucet
        </CardTitle>
        <CardDescription className="text-gray-400">
          Mint mock USDC or transfer PROOF tokens to any test account. This requires you to be connected as the contract deployer.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
            <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-md flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <p className="text-sm text-red-300">{error}</p>
            </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="recipient" className="text-gray-300">Recipient Address</Label>
          <Input
            id="recipient"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            className="bg-gray-700 border-gray-600 text-white font-mono"
            placeholder="0x..."
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="usdc_amount" className="text-gray-300">mUSDC Amount</Label>
            <Input
              id="usdc_amount"
              type="number"
              value={usdcAmount}
              onChange={(e) => setUsdcAmount(e.target.value)}
              className="bg-gray-700 border-gray-600 text-white"
            />
            <Button
              onClick={() => handleGetTokens('usdc')}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Get mUSDC'}
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="proof_amount" className="text-gray-300">PROOF Amount</Label>
            <Input
              id="proof_amount"
              type="number"
              value={proofAmount}
              onChange={(e) => setProofAmount(e.target.value)}
              className="bg-gray-700 border-gray-600 text-white"
            />
            <Button
              onClick={() => handleGetTokens('proof')}
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Get PROOF'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
