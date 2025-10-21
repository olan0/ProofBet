import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getConnectedAddress } from "../components/blockchain/contracts";
import FaucetPanel from "../components/admin/FaucetPanel";
import MarketSeederPanel from "../components/admin/MarketSeederPanel";
import KeeperPanel from "../components/admin/KeeperPanel";
import { Settings, Droplets, DatabaseZap, Bot } from 'lucide-react';

export default function AdminPage() {
    const [walletAddress, setWalletAddress] = useState(null);

    useEffect(() => {
        const fetchAddress = async () => {
            const address = await getConnectedAddress();
            setWalletAddress(address);
        };
        fetchAddress();
    }, []);

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl flex items-center justify-center">
                        <Settings className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-4xl font-bold text-white">Admin Panel</h1>
                        <p className="text-orange-200 text-lg">Tools for local development and testing.</p>
                    </div>
                </div>

                <Alert variant="destructive" className="bg-red-900/30 border-red-500/50 text-red-300">
                    <AlertTitle>Development Only</AlertTitle>
                    <AlertDescription>
                        These tools are designed for use on a local Hardhat development network. Most features will not work on a live network.
                    </AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card className="bg-gray-800 border-gray-700">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Droplets className="w-5 h-5 text-cyan-400" />
                                Token Faucet
                            </CardTitle>
                            <CardDescription>
                                Mint mock USDC and PROOF tokens to your connected wallet. This is essential for testing betting, creation, and voting features.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <FaucetPanel walletAddress={walletAddress} />
                        </CardContent>
                    </Card>

                    <Card className="bg-gray-800 border-gray-700">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <DatabaseZap className="w-5 h-5 text-purple-400" />
                                Hardhat Market Seeder
                            </CardTitle>
                            <CardDescription>
                                Run an E2E script to automatically create a diverse set of markets with different statuses (Open, Voting, Completed, etc.). This script populates your local blockchain with realistic test data.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <MarketSeederPanel walletAddress={walletAddress} />
                        </CardContent>
                    </Card>
                    
                    <Card className="bg-gray-800 border-gray-700 lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Bot className="w-5 h-5 text-green-400" />
                                Keeper Functions
                            </CardTitle>
                             <CardDescription>
                                Manually trigger the time-based "keeper" functions that advance market states. In a live environment, this would be automated. Use this to move markets from 'Open' to 'Awaiting Proof' or from 'Voting' to 'Resolved' after their deadlines have passed.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <KeeperPanel walletAddress={walletAddress} />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}