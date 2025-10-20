
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Loader2 } from "lucide-react";
import FaucetPanel from "../components/admin/FaucetPanel";
import MarketSeederPanel from "../components/admin/MarketSeederPanel";
import KeeperPanel from "../components/admin/KeeperPanel"; // Import the new panel
import { connectWallet, getConnectedAddress, formatAddress } from "../components/blockchain/contracts";

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState(null);

  useEffect(() => {
    const checkWallet = async () => {
      const address = await getConnectedAddress();
      setWalletAddress(address);
      setLoading(false);
    };
    checkWallet();

    // Add listener for account changes to ensure state is always fresh
    if (window.ethereum) {
        const handleAccountsChanged = (accounts) => {
            if (accounts.length > 0) {
                setWalletAddress(accounts[0]);
            } else {
                setWalletAddress(null);
            }
        };

        window.ethereum.on('accountsChanged', handleAccountsChanged);

        return () => {
            window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        };
    }
  }, []);
  
  const handleConnect = async () => {
      const address = await connectWallet();
      setWalletAddress(address);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 p-6 flex items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 min-h-screen bg-gray-900 text-white">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gray-800 rounded-lg border border-gray-700">
            <Shield className="w-8 h-8 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
            <p className="text-gray-400">Tools for managing the local test environment.</p>
          </div>
        </div>
        {walletAddress && (
          <div className="mt-4 md:mt-0 text-right">
            <p className="text-sm text-gray-400">Connected Wallet:</p>
            <p className="text-md font-medium text-white">{formatAddress(walletAddress)}</p>
          </div>
        )}
      </header>

      {walletAddress ? (
        <div className="grid gap-8 grid-cols-1 lg:grid-cols-2">
            <FaucetPanel walletAddress={walletAddress} />
            <KeeperPanel walletAddress={walletAddress} />
            <div className="lg:col-span-2">
              <MarketSeederPanel walletAddress={walletAddress} />
            </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-gray-800/50 rounded-lg max-w-md mx-auto">
            <Card className="bg-transparent border-none text-center w-full">
                <CardHeader>
                    <CardTitle className="text-white text-2xl">Admin Access Required</CardTitle>
                    <CardDescription className="text-gray-400">Please connect your wallet to manage the platform.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={handleConnect} className="bg-gradient-to-r from-cyan-500 to-purple-600">Connect Wallet</Button>
                </CardContent>
            </Card>
        </div>
      )}
    </div>
  );
}
