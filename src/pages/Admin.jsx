import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getConnectedAddress, getBetFactoryContract } from "../components/blockchain/contracts";
import FaucetPanel from "../components/admin/FaucetPanel";
import AdminControlPanel from "../components/admin/AdminControlPanel";
import KeeperPanel from "../components/admin/KeeperPanel";
import { Settings, Droplets, SlidersHorizontal, Bot, ShieldOff } from 'lucide-react';

export default function AdminPage() {
    const [walletAddress, setWalletAddress] = useState(null);
    const [isOwner, setIsOwner] = useState(null); // null = loading

    useEffect(() => {
        const fetchAddress = async () => {
            const address = await getConnectedAddress();
            setWalletAddress(address);
            if (address) {
                try {
                    const factory = getBetFactoryContract();
                    const owner = await factory.owner();
                    setIsOwner(owner.toLowerCase() === address.toLowerCase());
                } catch {
                    setIsOwner(false);
                }
            } else {
                setIsOwner(false);
            }
        };
        fetchAddress();
    }, []);

    if (isOwner === null) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <p className="text-gray-400">Checking permissions...</p>
            </div>
        );
    }

    if (!isOwner) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <Card className="bg-gray-800 border-red-700 max-w-md w-full">
                    <CardContent className="p-8 flex flex-col items-center text-center gap-4">
                        <ShieldOff className="w-12 h-12 text-red-400" />
                        <h2 className="text-2xl font-bold text-white">Access Denied</h2>
                        <p className="text-gray-400">Only the contract deployer can access the Admin Panel.</p>
                        {walletAddress && (
                            <p className="text-xs text-gray-500 font-mono break-all">Connected: {walletAddress}</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }

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

                <Card className="bg-gray-800 border-gray-700">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <SlidersHorizontal className="w-5 h-5 text-orange-400" />
                            Contract Settings
                        </CardTitle>
                        <CardDescription>
                            Owner-only functions to configure the BetFactory contract parameters.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <AdminControlPanel />
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Card className="bg-gray-800 border-gray-700">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Droplets className="w-5 h-5 text-cyan-400" />
                                Token Faucet
                            </CardTitle>
                            <CardDescription>
                                Mint mock USDC and PROOF tokens to your connected wallet.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <FaucetPanel walletAddress={walletAddress} />
                        </CardContent>
                    </Card>

                    <Card className="bg-gray-800 border-gray-700">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Bot className="w-5 h-5 text-green-400" />
                                Keeper Functions
                            </CardTitle>
                            <CardDescription>
                                Manually trigger keeper functions to advance market states.
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