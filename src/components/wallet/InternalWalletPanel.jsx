import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
    Wallet, 
    ArrowDownToLine, 
    ArrowUpFromLine, 
    Loader2, 
    CheckCircle, 
    AlertCircle,
    DollarSign,
    ShieldCheck,
    User
} from "lucide-react";
import { getBetFactoryContract, getUsdcTokenContract, getProofTokenContract } from "../blockchain/contracts";

import { ethers } from "ethers";
import axios from "axios";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

export default function InternalWalletPanel({ walletAddress }) {
    const [activeTab, setActiveTab] = useState("deposit");
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");
    
    const [usdcDepositAmount, setUsdcDepositAmount] = useState("");
    const [usdcWithdrawAmount, setUsdcWithdrawAmount] = useState("");
    const [proofDepositAmount, setProofDepositAmount] = useState("");
    const [proofWithdrawAmount, setProofWithdrawAmount] = useState("");
    
    const [walletBalances, setWalletBalances] = useState({ usdc: 0, proof: 0 });
    const [internalBalances, setInternalBalances] = useState({ usdc: 0, proof: 0 });
    const [userAlias, setUserAlias] = useState("");
    const [aliasLoading, setAliasLoading] = useState(false);

    useEffect(() => {
        loadBalances();
        loadUserProfile();
    }, [walletAddress]);

    const loadBalances = async () => {
        if (!walletAddress) return;
        
        try {
            const factory = getBetFactoryContract();
            const usdcToken = getUsdcTokenContract();
            const proofToken = getProofTokenContract();
            
            const [walletUsdc, walletProof, internalBals] = await Promise.all([
                usdcToken.balanceOf(walletAddress),
                proofToken.balanceOf(walletAddress),
                factory.getInternalBalances(walletAddress)
            ]);
            
            setWalletBalances({
                usdc: parseFloat(ethers.formatUnits(walletUsdc, 6)),
                proof: parseFloat(ethers.formatEther(walletProof))
            });
            
            setInternalBalances({
                usdc: parseFloat(ethers.formatUnits(internalBals[0], 6)),
                proof: parseFloat(ethers.formatEther(internalBals[1]))
            });
        } catch (err) {
            console.error("Failed to load balances:", err);
        }
    };

    const loadUserProfile = async () => {
        if (!walletAddress) return;
        
        try {
            const res = await axios.get(`${apiBaseUrl.replace("/api", "")}/api/users/${walletAddress.toUpperCase()}`);
            setUserAlias(res.data.alias);;
            
        } catch (err) {
             if (err.response && err.response.status === 404) {
                console.log("Alias not found — user will set a new one");
                setUserAlias(""); // or prompt user
            } 
            else 
                 console.error("Failed to load user profile:", err);
        }
    };

    const handleSaveAlias = async () => {
        const trimmedAlias = userAlias.trim();
        
        if (!trimmedAlias) {
            setError("Please enter an alias");
            return;
        }
        
        if (trimmedAlias.length < 3) {
            setError("Alias must be at least 3 characters long");
            return;
        }
        
        if (trimmedAlias.length > 50) {
            setError("Alias must be 50 characters or less");
            return;
        }
        
        setAliasLoading(true);
        setError("");
        setSuccess("");
        
        try {
                await axios.post(`${apiBaseUrl.replace("/api", "")}/api/users`, {
                wallet_address: walletAddress.toUpperCase(),
                alias: trimmedAlias,
                });
            
            
            setSuccess("✓ Alias saved successfully! Reload the page to see it in the header.");
        } catch (err) {
             if (err.response && err.response.status === 409) {
                setError("This alias is already taken. Please choose a different one.");
            } else {
                    console.error("Failed to save alias:", err);
                    setError("Failed to save alias. It might already be taken by another user.");
            }
        } finally {
            setAliasLoading(false);
        }
    };

    const handleDeposit = async (token) => {
        setLoading(true);
        setError("");
        setSuccess("");
        
        try {
            const amount = token === 'usdc' ? usdcDepositAmount : proofDepositAmount;
            if (!amount || parseFloat(amount) <= 0) {
                setError("Please enter a valid amount");
                setLoading(false);
                return;
            }
            
            const factory = getBetFactoryContract(true);
            const tokenContract = token === 'usdc' ? getUsdcTokenContract(true) : getProofTokenContract(true);
            const decimals = token === 'usdc' ? 6 : 18;
            const amountInSmallestUnit = ethers.parseUnits(amount, decimals);
            
            const approveTx = await tokenContract.approve(await factory.getAddress(), amountInSmallestUnit);
            await approveTx.wait();
            
            const depositTx = token === 'usdc' 
                ? await factory.depositUsdc(amountInSmallestUnit)
                : await factory.depositProof(amountInSmallestUnit);
            await depositTx.wait();
            
            setSuccess(`✓ Successfully deposited ${amount} ${token.toUpperCase()}`);
            if (token === 'usdc') setUsdcDepositAmount("");
            else setProofDepositAmount("");
            
            await loadBalances();
        } catch (err) {
            console.error("Deposit failed:", err);
            setError(err.reason || err.message || "Deposit failed");
        } finally {
            setLoading(false);
        }
    };

    const handleWithdraw = async (token) => {
        setLoading(true);
        setError("");
        setSuccess("");
        
        try {
            const amount = token === 'usdc' ? usdcWithdrawAmount : proofWithdrawAmount;
            if (!amount || parseFloat(amount) <= 0) {
                setError("Please enter a valid amount");
                setLoading(false);
                return;
            }
            
            const factory = getBetFactoryContract(true);
            const decimals = token === 'usdc' ? 6 : 18;
            const amountInSmallestUnit = ethers.parseUnits(amount, decimals);
            
            const withdrawTx = token === 'usdc'
                ? await factory.withdrawUsdc(amountInSmallestUnit)
                : await factory.withdrawProof(amountInSmallestUnit);
            await withdrawTx.wait();
            
            setSuccess(`✓ Successfully withdrew ${amount} ${token.toUpperCase()}`);
            if (token === 'usdc') setUsdcWithdrawAmount("");
            else setProofWithdrawAmount("");
            
            await loadBalances();
        } catch (err) {
            console.error("Withdraw failed:", err);
            setError(err.reason || err.message || "Withdrawal failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Profile Section */}
            <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <User className="w-5 h-5 text-purple-400" />
                        Profile Settings
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-gray-300">Display Name (Alias)</Label>
                        <div className="flex gap-2">
                            <Input
                                value={userAlias}
                                onChange={(e) => setUserAlias(e.target.value)}
                                placeholder="Enter your display name..."
                                className="flex-1 bg-gray-700 border-gray-600 text-white"
                                maxLength={50}
                            />
                            <Button 
                                onClick={handleSaveAlias} 
                                disabled={aliasLoading}
                                className="bg-purple-600 hover:bg-purple-700"
                            >
                                {aliasLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                            </Button>
                        </div>
                        <p className="text-xs text-gray-400">
                            This name will be displayed instead of your wallet address throughout the app.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Balance Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="bg-gradient-to-br from-green-500/10 to-gray-800 border-green-500/20">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <DollarSign className="w-5 h-5 text-green-400" />
                            USDC
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div>
                            <p className="text-xs text-gray-400">Wallet Balance</p>
                            <p className="text-2xl font-bold text-white">{walletBalances.usdc.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">Internal Balance</p>
                            <p className="text-2xl font-bold text-green-400">{internalBalances.usdc.toFixed(2)}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500/10 to-gray-800 border-purple-500/20">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-purple-400" />
                            PROOF
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div>
                            <p className="text-xs text-gray-400">Wallet Balance</p>
                            <p className="text-2xl font-bold text-white">{walletBalances.proof.toFixed(2)}</p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-400">Internal Balance</p>
                            <p className="text-2xl font-bold text-purple-400">{internalBalances.proof.toFixed(2)}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Transaction Panel */}
            <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-cyan-400" />
                        Manage Funds
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {(success || error) && (
                        <Alert className={`mb-4 ${success ? 'bg-green-900/20 border-green-500/50' : 'bg-red-900/20 border-red-500/50'}`}>
                            {success ? <CheckCircle className="h-4 w-4 text-green-400" /> : <AlertCircle className="h-4 w-4 text-red-400" />}
                            <AlertDescription className={success ? 'text-green-200' : 'text-red-200'}>
                                {success || error}
                            </AlertDescription>
                        </Alert>
                    )}

                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="grid w-full grid-cols-2 bg-gray-900">
                            <TabsTrigger value="deposit">Deposit</TabsTrigger>
                            <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
                        </TabsList>

                        <TabsContent value="deposit" className="space-y-6 mt-4">
                            {/* USDC Deposit */}
                            <div className="space-y-3 p-4 bg-gray-900 rounded-lg">
                                <Label className="text-gray-300">Deposit USDC</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="number"
                                        value={usdcDepositAmount}
                                        onChange={(e) => setUsdcDepositAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="flex-1 bg-gray-700 border-gray-600 text-white"
                                    />
                                    <Button 
                                        onClick={() => handleDeposit('usdc')} 
                                        disabled={loading}
                                        className="bg-green-600 hover:bg-green-700"
                                    >
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownToLine className="w-4 h-4" />}
                                    </Button>
                                </div>
                                <p className="text-xs text-gray-400">Available: {walletBalances.usdc.toFixed(2)} USDC</p>
                            </div>

                            {/* PROOF Deposit */}
                            <div className="space-y-3 p-4 bg-gray-900 rounded-lg">
                                <Label className="text-gray-300">Deposit PROOF</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="number"
                                        value={proofDepositAmount}
                                        onChange={(e) => setProofDepositAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="flex-1 bg-gray-700 border-gray-600 text-white"
                                    />
                                    <Button 
                                        onClick={() => handleDeposit('proof')} 
                                        disabled={loading}
                                        className="bg-purple-600 hover:bg-purple-700"
                                    >
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownToLine className="w-4 h-4" />}
                                    </Button>
                                </div>
                                <p className="text-xs text-gray-400">Available: {walletBalances.proof.toFixed(2)} PROOF</p>
                            </div>
                        </TabsContent>

                        <TabsContent value="withdraw" className="space-y-6 mt-4">
                            {/* USDC Withdraw */}
                            <div className="space-y-3 p-4 bg-gray-900 rounded-lg">
                                <Label className="text-gray-300">Withdraw USDC</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="number"
                                        value={usdcWithdrawAmount}
                                        onChange={(e) => setUsdcWithdrawAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="flex-1 bg-gray-700 border-gray-600 text-white"
                                    />
                                    <Button 
                                        onClick={() => handleWithdraw('usdc')} 
                                        disabled={loading}
                                        className="bg-green-600 hover:bg-green-700"
                                    >
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpFromLine className="w-4 h-4" />}
                                    </Button>
                                </div>
                                <p className="text-xs text-gray-400">Available: {internalBalances.usdc.toFixed(2)} USDC</p>
                            </div>

                            {/* PROOF Withdraw */}
                            <div className="space-y-3 p-4 bg-gray-900 rounded-lg">
                                <Label className="text-gray-300">Withdraw PROOF</Label>
                                <div className="flex gap-2">
                                    <Input
                                        type="number"
                                        value={proofWithdrawAmount}
                                        onChange={(e) => setProofWithdrawAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="flex-1 bg-gray-700 border-gray-600 text-white"
                                    />
                                    <Button 
                                        onClick={() => handleWithdraw('proof')} 
                                        disabled={loading}
                                        className="bg-purple-600 hover:bg-purple-700"
                                    >
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpFromLine className="w-4 h-4" />}
                                    </Button>
                                </div>
                                <p className="text-xs text-gray-400">Available: {internalBalances.proof.toFixed(2)} PROOF</p>
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}