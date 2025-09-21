import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DollarSign, Shield, AlertCircle, Plus } from "lucide-react";

export default function DepositModal({ isOpen, onClose, onDeposit, currentUsdBalance = 0, currentProofBalance = 0 }) {
  const [usdAmount, setUsdAmount] = useState("");
  const [proofAmount, setProofAmount] = useState("");
  const [depositing, setDepositing] = useState(false);
  const [error, setError] = useState("");

  const handleDeposit = async (tokenType) => {
    setDepositing(true);
    setError("");
    
    try {
      const amount = tokenType === 'usd' ? parseFloat(usdAmount) : parseFloat(proofAmount);
      
      if (isNaN(amount) || amount <= 0) {
        setError("Please enter a valid amount");
        setDepositing(false);
        return;
      }
      
      await onDeposit(amount, tokenType);
      
      // Reset form
      if (tokenType === 'usd') setUsdAmount("");
      if (tokenType === 'proof') setProofAmount("");
      
    } catch (err) {
      setError("Failed to process deposit. Please try again.");
    }
    setDepositing(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Plus className="w-5 h-5 text-green-400" />
            Deposit Funds
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Alert className="bg-blue-500/10 border-blue-500/20">
            <AlertCircle className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-blue-200">
              <strong>USDC:</strong> For betting and winnings<br/>
              <strong>PROOF:</strong> For platform fees (bet creation, voting)
            </AlertDescription>
          </Alert>

          <Tabs defaultValue="usd" className="w-full">
            <TabsList className="bg-gray-700 border border-gray-600 grid w-full grid-cols-2">
              <TabsTrigger value="usd" className="data-[state=active]:bg-green-600">
                <DollarSign className="w-4 h-4 mr-2" />
                USDC
              </TabsTrigger>
              <TabsTrigger value="proof" className="data-[state=active]:bg-purple-600">
                <Shield className="w-4 h-4 mr-2" />
                PROOF
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="usd" className="space-y-4">
              <div className="text-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-green-300 text-sm">Current USDC Balance</p>
                <p className="text-2xl font-bold text-green-400">${currentUsdBalance.toFixed(2)}</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="usd-amount" className="text-gray-300">Deposit Amount (USDC)</Label>
                <Input
                  id="usd-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={usdAmount}
                  onChange={(e) => setUsdAmount(e.target.value)}
                  placeholder="10.00"
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
              
              <Button
                onClick={() => handleDeposit('usd')}
                disabled={depositing || !usdAmount}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold"
              >
                {depositing ? 'Processing...' : `Deposit $${usdAmount || '0.00'} USDC`}
              </Button>
            </TabsContent>

            <TabsContent value="proof" className="space-y-4">
              <div className="text-center p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <p className="text-purple-300 text-sm">Current PROOF Balance</p>
                <p className="text-2xl font-bold text-purple-400">{currentProofBalance.toFixed(0)} PROOF</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="proof-amount" className="text-gray-300">Deposit Amount (PROOF)</Label>
                <Input
                  id="proof-amount"
                  type="number"
                  step="1"
                  min="1"
                  value={proofAmount}
                  onChange={(e) => setProofAmount(e.target.value)}
                  placeholder="100"
                  className="bg-gray-700 border-gray-600 text-white"
                />
              </div>
              
              <Button
                onClick={() => handleDeposit('proof')}
                disabled={depositing || !proofAmount}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold"
              >
                {depositing ? 'Processing...' : `Deposit ${proofAmount || '0'} PROOF`}
              </Button>
            </TabsContent>
          </Tabs>

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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}