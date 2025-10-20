import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ArrowDownToLine, ArrowUpFromLine, AlertCircle, CheckCircle } from "lucide-react";
import { ethers } from "ethers";
import { 
    getBetFactoryContract, 
    getUsdcTokenContract, 
    getProofTokenContract 
} from "../blockchain/contracts";

export default function InternalWalletPanel({ walletAddress }) {
    const [usdcBalance, setUsdcBalance] = useState("0");
    const [proofBalance, setProofBalance] = useState("0");
    const [internalUsdcBalance, setInternalUsdcBalance] = useState("0");
    const [internalProofBalance, setInternalProofBalance] = useState("0");

    const [depositUsdcAmount, setDepositUsdcAmount] = useState("");
    const [depositProofAmount, setDepositProofAmount] = useState("");
    const [withdrawUsdcAmount, setWithdrawUsdcAmount] = useState("");
    const [withdrawProofAmount, setWithdrawProofAmount] = useState("");

    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(null); // 'deposit_usdc', 'deposit_proof', 'withdraw_usdc', 'withdraw_proof'
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const fetchBalances = useCallback(async () => {
        if (!walletAddress) return;
        try {
            const factory = getBetFactoryContract();
            const usdc = getUsdcTokenContract();
            const proof = getProofTokenContract();

            const [
                walletUsdc, 
                walletProof,
                internalBalances
            ] = await Promise.all([
                usdc.balanceOf(walletAddress),
                proof.balanceOf(walletAddress),
                factory.getInternalBalances(walletAddress)
            ]);
            
            const [internalUsdc, internalProof] = internalBalances;

            setUsdcBalance(ethers.formatUnits(walletUsdc, 6));
            setProofBalance(ethers.formatEther(walletProof));
            setInternalUsdcBalance(ethers.formatUnits(internalUsdc, 6));
            setInternalProofBalance(ethers.formatEther(internalProof));
        } catch (e) {
            console.error("Failed to fetch balances:", e);
            setError("Could not fetch wallet balances. Ensure you are on the correct network.");
        }
        setLoading(false);
    }, [walletAddress]);

    useEffect(() => {
        fetchBalances();
    }, [fetchBalances]);

    const clearMessages = () => {
        setError("");
        setSuccess("");
    };

    const handleDeposit = async (tokenType) => {
        clearMessages();
        const amount = tokenType === 'usdc' ? depositUsdcAmount : depositProofAmount;
        const balance = tokenType === 'usdc' ? usdcBalance : proofBalance;
        const decimals = tokenType === 'usdc' ? 6 : 18;
        const tokenContract = tokenType === 'usdc' ? getUsdcTokenContract(true) : getProofTokenContract(true);
        const factory = getBetFactoryContract(true);

        if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
            setError(`Please enter a valid amount to deposit.`);
            return;
        }
        if (parseFloat(amount) > parseFloat(balance)) {
            setError(`Cannot deposit more than your wallet balance of ${balance}.`);
            return;
        }

        setProcessing(`deposit_${tokenType}`);
        try {
            const parsedAmount = ethers.parseUnits(amount, decimals);
            
            // 1. Approve factory to spend tokens
            const approveTx = await tokenContract.approve(await factory.getAddress(), parsedAmount);
            await approveTx.wait();
            setSuccess("Approval successful. Now processing deposit...");

            // 2. Call deposit function on factory
            const depositTx = tokenType === 'usdc' 
                ? await factory.depositUsdc(parsedAmount) 
                : await factory.depositProof(parsedAmount);
            await depositTx.wait();
            
            setSuccess(`Successfully deposited ${amount} ${tokenType.toUpperCase()}. Balances will update shortly.`);
            if (tokenType === 'usdc') setDepositUsdcAmount("");
            else setDepositProofAmount("");

            await fetchBalances(); // Refresh balances
        } catch (e) {
            console.error(`Deposit failed:`, e);
            setError(e.reason || `Failed to deposit ${tokenType.toUpperCase()}.`);
        }
        setProcessing(null);
    };

    const handleWithdraw = async (tokenType) => {
        clearMessages();
        const amount = tokenType === 'usdc' ? withdrawUsdcAmount : withdrawProofAmount;
        const balance = tokenType === 'usdc' ? internalUsdcBalance : internalProofBalance;
        const decimals = tokenType === 'usdc' ? 6 : 18;
        
        if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
            setError(`Please enter a valid amount to withdraw.`);
            return;
        }
        if (parseFloat(amount) > parseFloat(balance)) {
            setError(`Cannot withdraw more than your internal balance of ${balance}.`);
            return;
        }

        setProcessing(`withdraw_${tokenType}`);
        try {
            const factory = getBetFactoryContract(true);
            const parsedAmount = ethers.parseUnits(amount, decimals);
            
            const withdrawTx = tokenType === 'usdc' 
                ? await factory.withdrawUsdc(parsedAmount)
                : await factory.withdrawProof(parsedAmount);
            await withdrawTx.wait();
            
            setSuccess(`Successfully withdrew ${amount} ${tokenType.toUpperCase()}. Balances will update shortly.`);
            if (tokenType === 'usdc') setWithdrawUsdcAmount("");
            else setWithdrawProofAmount("");
            
            await fetchBalances(); // Refresh balances
        } catch (e) {
            console.error(`Withdrawal failed:`, e);
            setError(e.reason || `Failed to withdraw ${tokenType.toUpperCase()}.`);
        }
        setProcessing(null);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
            </div>
        );
    }
    
    return (
        <div className="space-y-8">
            {error && (
                <Alert variant="destructive" className="bg-red-900/20 border-red-500/50">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-red-200">{error}</AlertDescription>
                </Alert>
            )}
            {success && (
                <Alert className="bg-green-900/20 border-green-500/50">
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription className="text-green-200">{success}</AlertDescription>
                </Alert>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* DEPOSIT CARD */}
                <Card className="bg-gray-800/50 border-gray-700">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <ArrowDownToLine className="w-5 h-5 text-cyan-400" />
                            Deposit to Internal Wallet
                        </CardTitle>
                        <CardDescription>Move funds from your wallet to the platform's internal wallet for gas-free betting and voting.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* USDC Deposit */}
                        <div className="space-y-2">
                            <Label htmlFor="deposit-usdc" className="text-gray-300">USDC Amount</Label>
                            <div className="flex gap-2">
                                <Input 
                                    id="deposit-usdc" 
                                    type="number" 
                                    placeholder="e.g., 100" 
                                    value={depositUsdcAmount} 
                                    onChange={(e) => setDepositUsdcAmount(e.target.value)}
                                    className="bg-gray-700 border-gray-600 text-white"
                                />
                                <Button variant="outline" onClick={() => setDepositUsdcAmount(usdcBalance)}>Max</Button>
                            </div>
                            <p className="text-sm text-gray-400">Wallet Balance: {parseFloat(usdcBalance).toFixed(2)} USDC</p>
                            <Button 
                                onClick={() => handleDeposit('usdc')} 
                                disabled={processing}
                                className="w-full"
                            >
                                {processing === 'deposit_usdc' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Deposit USDC'}
                            </Button>
                        </div>
                        {/* PROOF Deposit */}
                        <div className="space-y-2">
                            <Label htmlFor="deposit-proof" className="text-gray-300">PROOF Amount</Label>
                            <div className="flex gap-2">
                                <Input 
                                    id="deposit-proof" 
                                    type="number" 
                                    placeholder="e.g., 50" 
                                    value={depositProofAmount} 
                                    onChange={(e) => setDepositProofAmount(e.target.value)}
                                    className="bg-gray-700 border-gray-600 text-white"
                                />
                                <Button variant="outline" onClick={() => setDepositProofAmount(proofBalance)}>Max</Button>
                            </div>
                            <p className="text-sm text-gray-400">Wallet Balance: {parseFloat(proofBalance).toFixed(2)} PROOF</p>
                            <Button 
                                onClick={() => handleDeposit('proof')} 
                                disabled={processing}
                                className="w-full"
                            >
                                {processing === 'deposit_proof' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Deposit PROOF'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* WITHDRAW CARD */}
                <Card className="bg-gray-800/50 border-gray-700">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <ArrowUpFromLine className="w-5 h-5 text-purple-400" />
                            Withdraw from Internal Wallet
                        </CardTitle>
                        <CardDescription>Move funds from the platform's internal wallet back to your connected wallet.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* USDC Withdraw */}
                        <div className="space-y-2">
                            <Label htmlFor="withdraw-usdc" className="text-gray-300">USDC Amount</Label>
                            <div className="flex gap-2">
                                <Input 
                                    id="withdraw-usdc" 
                                    type="number" 
                                    placeholder="e.g., 100" 
                                    value={withdrawUsdcAmount} 
                                    onChange={(e) => setWithdrawUsdcAmount(e.target.value)}
                                    className="bg-gray-700 border-gray-600 text-white"
                                />
                                <Button variant="outline" onClick={() => setWithdrawUsdcAmount(internalUsdcBalance)}>Max</Button>
                            </div>
                            <p className="text-sm text-gray-400">Internal Balance: {parseFloat(internalUsdcBalance).toFixed(2)} USDC</p>
                            <Button 
                                onClick={() => handleWithdraw('usdc')} 
                                disabled={processing}
                                className="w-full bg-purple-600 hover:bg-purple-700"
                            >
                                {processing === 'withdraw_usdc' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Withdraw USDC'}
                            </Button>
                        </div>
                        {/* PROOF Withdraw */}
                        <div className="space-y-2">
                            <Label htmlFor="withdraw-proof" className="text-gray-300">PROOF Amount</Label>
                            <div className="flex gap-2">
                                <Input 
                                    id="withdraw-proof" 
                                    type="number" 
                                    placeholder="e.g., 50" 
                                    value={withdrawProofAmount} 
                                    onChange={(e) => setWithdrawProofAmount(e.target.value)}
                                    className="bg-gray-700 border-gray-600 text-white"
                                />
                                <Button variant="outline" onClick={() => setWithdrawProofAmount(internalProofBalance)}>Max</Button>
                            </div>
                            <p className="text-sm text-gray-400">Internal Balance: {parseFloat(internalProofBalance).toFixed(2)} PROOF</p>
                            <Button 
                                onClick={() => handleWithdraw('proof')} 
                                disabled={processing}
                                className="w-full bg-purple-600 hover:bg-purple-700"
                            >
                                {processing === 'withdraw_proof' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Withdraw PROOF'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}