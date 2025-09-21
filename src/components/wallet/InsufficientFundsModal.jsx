import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Wallet, AlertTriangle, Plus } from "lucide-react";

export default function InsufficientFundsModal({ 
  isOpen, 
  onClose, 
  onDeposit, 
  currentBalance, 
  requiredAmount, 
  actionType = "participate",
  currency = "usd" 
}) {
  const shortfall = Math.max(0, (requiredAmount || 0) - (currentBalance || 0));
  const currencySymbol = currency === 'usd' ? '$' : '';
  const currencyName = currency === 'usd' ? 'USDC' : 'PROOF';
  const decimals = currency === 'usd' ? 2 : 0;

  const getActionMessage = () => {
    switch (actionType) {
      case "bet":
        return `place a bet of ${currencySymbol}${(requiredAmount || 0).toFixed(decimals)} ${currencyName}`;
      case "vote":
        return `stake ${(requiredAmount || 0).toFixed(decimals)} ${currencyName} to vote`;
      case "create":
        return `pay the ${(requiredAmount || 0).toFixed(decimals)} ${currencyName} creation fee`;
      default:
        return `complete this action requiring ${currencySymbol}${(requiredAmount || 0).toFixed(decimals)} ${currencyName}`;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            Insufficient Balance
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <Alert className="bg-yellow-500/10 border-yellow-500/20">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            <AlertDescription className="text-yellow-200">
              You need more {currencyName} in your ProofBet balance to {getActionMessage()}.
            </AlertDescription>
          </Alert>

          {/* Balance Comparison */}
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <span className="text-red-200">Your Balance:</span>
              <span className="font-bold text-red-400">{currencySymbol}{(currentBalance || 0).toFixed(decimals)} {currencyName}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <span className="text-green-200">Required:</span>
              <span className="font-bold text-green-400">{currencySymbol}{(requiredAmount || 0).toFixed(decimals)} {currencyName}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
              <span className="text-gray-300">Need to deposit:</span>
              <span className="font-bold text-cyan-400">+{currencySymbol}{(shortfall || 0).toFixed(decimals)} {currencyName}</span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                onClose();
                onDeposit();
              }}
              className="flex-1 bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Deposit Funds
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}