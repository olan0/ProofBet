
import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowDownToLine, ArrowUpFromLine, Wallet, DollarSign, ShieldCheck, Loader2 } from "lucide-react";
import { ethers } from "ethers";
import { 
  getBetFactoryContract, 
  getUsdcTokenContract, 
  getProofTokenContract 
} from "../blockchain/contracts";

export default function InternalWalletPanel({ walletAddress }) {
  const [internalBalances, setInternalBalances] = useState({ usdc: 0, proof: 0 });
  const [walletBalances, setWalletBalances] = useState({ usdc: 0, proof: 0 });
  const [depositAmount, setDepositAmount] = useState({ usdc: "", proof: "" });
  const [withdrawAmount, setWithdrawAmount] = useState({ usdc: "", proof: "" });
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({ usdc: false, proof: false });
  const [error, setError] = useState("");

  const loadBalances = useCallback(async () => {
    try {
      if (!walletAddress) {
        console.warn("walletAddress is not defined, cannot load balances.");
        setLoading(false);
        return;
      }

      const factory = getBetFactoryContract();
      const usdcContract = getUsdcTokenContract();
      const proofContract = getProofTokenContract();

      // Get internal balances
      const [internalUsdc, internalProof] = await factory.getInternalBalances(walletAddress);
      
      // Get wallet balances  
      const [walletUsdc, walletProof] = await Promise.all([
        usdcContract.balanceOf(walletAddress),
        proofContract.balanceOf(walletAddress)
      ]);

      setInternalBalances({
        usdc: parseFloat(ethers.formatUnits(internalUsdc, 6)),
        proof: parseFloat(ethers.formatEther(internalProof))
      });

      setWalletBalances({
        usdc: parseFloat(ethers.formatUnits(walletUsdc, 6)),
        proof: parseFloat(ethers.formatEther(walletProof))
      });

      setLoading(false);
    } catch (err) {
      console.error("Failed to load balances:", err);
      setError("Failed to load balances: " + (err.reason || err.message || "Unknown error"));
      setLoading(false);
    }
  }, [walletAddress]); // walletAddress is a dependency for useCallback

  useEffect(() => {
    if (walletAddress) {
      loadBalances();
    }
  }, [walletAddress, loadBalances]); // loadBalances is now a stable function reference due to useCallback

  const handleDeposit = async (token) => {
    const amount = depositAmount[token];
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount to deposit.");
      return;
    }

    setProcessing(prev => ({ ...prev, [token]: true }));
    setError("");

    try {
      const factory = getBetFactoryContract(true);
      
      if (token === 'usdc') {
        const usdcContract = getUsdcTokenContract(true);
        const amountWei = ethers.parseUnits(amount, 6);
        
        // Approve factory to spend USDC
        const approveTx = await usdcContract.approve(await factory.getAddress(), amountWei);
        await approveTx.wait();
        
        // Deposit USDC
        const depositTx = await factory.depositUsdc(amountWei);
        await depositTx.wait();
      } else { // token is 'proof'
        const proofContract = getProofTokenContract(true);
        const amountWei = ethers.parseEther(amount);
        
        // Approve factory to spend PROOF
        const approveTx = await proofContract.approve(await factory.getAddress(), amountWei);
        await approveTx.wait();
        
        // Deposit PROOF
        const depositTx = await factory.depositProof(amountWei);
        await depositTx.wait();
      }

      // Refresh balances and reset form
      await loadBalances();
      setDepositAmount(prev => ({ ...prev, [token]: "" }));
      
    } catch (err) {
      console.error(`Failed to deposit ${token.toUpperCase()}:`, err);
      setError(err.reason || `Failed to deposit ${token.toUpperCase()}`);
    }
    
    setProcessing(prev => ({ ...prev, [token]: false }));
  };

  const handleWithdraw = async (token) => {
    const amount = withdrawAmount[token];
    if (!amount || parseFloat(amount) <= 0) {
      setError("Please enter a valid amount to withdraw.");
      return;
    }

    setProcessing(prev => ({ ...prev, [token]: true }));
    setError("");

    try {
      const factory = getBetFactoryContract(true);
      
      if (token === 'usdc') {
        const amountWei = ethers.parseUnits(amount, 6);
        const tx = await factory.withdrawUsdc(amountWei);
        await tx.wait();
      } else { // token is 'proof'
        const amountWei = ethers.parseEther(amount);
        const tx = await factory.withdrawProof(amountWei);
        await tx.wait();
      }

      // Refresh balances and reset form
      await loadBalances();
      setWithdrawAmount(prev => ({ ...prev, [token]: "" }));
      
    } catch (err) {
      console.error(`Failed to withdraw ${token.toUpperCase()}:`, err);
      setError(err.reason || `Failed to withdraw ${token.toUpperCase()}`);
    }
    
    setProcessing(prev => ({ ...prev, [token]: false }));
  };

  if (loading) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Wallet className="w-5 h-5 text-cyan-400" />
          Internal Wallet
        </CardTitle>
        <p className="text-gray-400 text-sm">
          Deposit tokens to your internal wallet for seamless betting without transaction approvals.
        </p>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-6 bg-red-900/20 border-red-500/50">
            <AlertDescription className="text-red-200">{error}</AlertDescription>
          </Alert>
        )}

        {/* Balance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="bg-gray-700/50 border-gray-600">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  <span className="text-gray-300">USDC</span>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-400">
                    {internalBalances.usdc.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400">
                    Wallet: {walletBalances.usdc.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gray-700/50 border-gray-600">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  <span className="text-gray-300">PROOF</span>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-purple-400">
                    {internalBalances.proof.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400">
                    Wallet: {walletBalances.proof.toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="deposit">
          <TabsList className="grid w-full grid-cols-2 bg-gray-700">
            <TabsTrigger value="deposit" className="data-[state=active]:bg-green-600">
              <ArrowDownToLine className="w-4 h-4 mr-2" />
              Deposit
            </TabsTrigger>
            <TabsTrigger value="withdraw" className="data-[state=active]:bg-red-600">
              <ArrowUpFromLine className="w-4 h-4 mr-2" />
              Withdraw
            </TabsTrigger>
          </TabsList>

          <TabsContent value="deposit" className="space-y-4 mt-4">
            {/* USDC Deposit */}
            <div className="space-y-2">
              <Label className="text-gray-300">Deposit USDC</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={depositAmount.usdc}
                  onChange={(e) => setDepositAmount(prev => ({ ...prev, usdc: e.target.value }))}
                  className="bg-gray-700 border-gray-600 text-white"
                />
                <Button 
                  onClick={() => handleDeposit('usdc')}
                  disabled={processing.usdc || !depositAmount.usdc || parseFloat(depositAmount.usdc) <= 0 || parseFloat(depositAmount.usdc) > walletBalances.usdc}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {processing.usdc ? <Loader2 className="w-4 h-4 animate-spin" /> : "Deposit"}
                </Button>
              </div>
              <p className="text-xs text-gray-400">
                Available: {walletBalances.usdc.toFixed(2)} USDC
              </p>
            </div>

            {/* PROOF Deposit */}
            <div className="space-y-2">
              <Label className="text-gray-300">Deposit PROOF</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={depositAmount.proof}
                  onChange={(e) => setDepositAmount(prev => ({ ...prev, proof: e.target.value }))}
                  className="bg-gray-700 border-gray-600 text-white"
                />
                <Button 
                  onClick={() => handleDeposit('proof')}
                  disabled={processing.proof || !depositAmount.proof || parseFloat(depositAmount.proof) <= 0 || parseFloat(depositAmount.proof) > walletBalances.proof}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {processing.proof ? <Loader2 className="w-4 h-4 animate-spin" /> : "Deposit"}
                </Button>
              </div>
              <p className="text-xs text-gray-400">
                Available: {walletBalances.proof.toFixed(2)} PROOF
              </p>
            </div>
          </TabsContent>

          <TabsContent value="withdraw" className="space-y-4 mt-4">
            {/* USDC Withdraw */}
            <div className="space-y-2">
              <Label className="text-gray-300">Withdraw USDC</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={withdrawAmount.usdc}
                  onChange={(e) => setWithdrawAmount(prev => ({ ...prev, usdc: e.target.value }))}
                  className="bg-gray-700 border-gray-600 text-white"
                />
                <Button 
                  onClick={() => handleWithdraw('usdc')}
                  disabled={processing.usdc || !withdrawAmount.usdc || parseFloat(withdrawAmount.usdc) <= 0 || parseFloat(withdrawAmount.usdc) > internalBalances.usdc}
                  variant="destructive"
                >
                  {processing.usdc ? <Loader2 className="w-4 h-4 animate-spin" /> : "Withdraw"}
                </Button>
              </div>
              <p className="text-xs text-gray-400">
                Available: {internalBalances.usdc.toFixed(2)} USDC
              </p>
            </div>

            {/* PROOF Withdraw */}
            <div className="space-y-2">
              <Label className="text-gray-300">Withdraw PROOF</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="0.00"
                  value={withdrawAmount.proof}
                  onChange={(e) => setWithdrawAmount(prev => ({ ...prev, proof: e.target.value }))}
                  className="bg-gray-700 border-gray-600 text-white"
                />
                <Button 
                  onClick={() => handleWithdraw('proof')}
                  disabled={processing.proof || !withdrawAmount.proof || parseFloat(withdrawAmount.proof) <= 0 || parseFloat(withdrawAmount.proof) > internalBalances.proof}
                  variant="destructive"
                >
                  {processing.proof ? <Loader2 className="w-4 h-4 animate-spin" /> : "Withdraw"}
                </Button>
              </div>
              <p className="text-xs text-gray-400">
                Available: {internalBalances.proof.toFixed(2)} PROOF
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="mt-6 p-3 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-200">
          💡 <strong>Tip:</strong> Keep some USDC in your internal wallet for betting and PROOF for voting. 
          This eliminates the need for transaction approvals on every bet!
        </div>
      </CardContent>
    </Card>
  );
}
