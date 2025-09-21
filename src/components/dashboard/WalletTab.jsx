
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import DepositModal from '../wallet/DepositModal';
import AliasManager from '../wallet/AliasManager';
import { DollarSign, Shield, Plus, User } from 'lucide-react';

export default function WalletTab({
  walletAddress,
  userProfile,
  onDeposit,
  onAliasUpdate
}) {
  const [showDepositModal, setShowDepositModal] = React.useState(false);

  if (!walletAddress) {
    return (
      <Card className="bg-gray-800 border-gray-700 text-center">
        <CardContent className="p-10">
          <p className="text-gray-400">Connect your wallet to manage your funds and profile.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Balances and Deposit */}
        <div className="md:col-span-1 space-y-6">
          <Card className="bg-gray-800 border-gray-700 h-full">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                Your Funds
                <Button 
                  onClick={() => setShowDepositModal(true)}
                  size="sm" 
                  variant="outline"
                  className="border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Deposit
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-400" />
                  <span className="text-gray-300">USDC Balance</span>
                </div>
                <span className="text-xl font-bold text-green-400">${(userProfile?.internal_balance_usd || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-purple-400" />
                  <span className="text-gray-300">PROOF Balance</span>
                </div>
                <span className="text-xl font-bold text-purple-400">{(userProfile?.internal_balance_proof || 0).toFixed(0)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alias Management */}
        <div className="md:col-span-2 space-y-6">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <User className="w-5 h-5 text-cyan-400" />
                Platform Alias
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AliasManager 
                walletAddress={walletAddress} 
                currentAlias={userProfile?.alias || ''}
                onAliasUpdate={onAliasUpdate}
              />
            </CardContent>
          </Card>
          
          {/* Removed ENS Manager Card */}
        </div>
      </div>

      <DepositModal 
        isOpen={showDepositModal}
        onClose={() => setShowDepositModal(false)}
        onDeposit={onDeposit}
        currentUsdBalance={userProfile?.internal_balance_usd || 0}
        currentProofBalance={userProfile?.internal_balance_proof || 0}
      />
    </>
  );
}
