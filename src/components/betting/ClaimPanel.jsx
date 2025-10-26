import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, PartyPopper, Wallet, AlertCircle, Clock, Bug } from 'lucide-react';
import { getBetContract } from '../blockchain/contracts';
import { ethers } from 'ethers';

export default function ClaimPanel({ bet, participants, votes, walletAddress, loadBetDetails }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [userParticipantData, setUserParticipantData] = useState(null);
  const [userVoteStake, setUserVoteStake] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);

  useEffect(() => {
    const findUserData = async () => {
      if (!walletAddress || !bet) return;
      try {
        const betContract = getBetContract(bet.address);
        const [participantData, voteStakeData, winningSide] = await Promise.all([
            betContract.participants(walletAddress),
            betContract.voterStakesProof(walletAddress),
            betContract.winningSide()
        ]);
        
        setUserParticipantData(participantData);
        setUserVoteStake(voteStakeData);
        
        // Debug info
        setDebugInfo({
          winningSide: Number(winningSide),
          userYesStake: ethers.formatUnits(participantData.yesStake, 6),
          userNoStake: ethers.formatUnits(participantData.noStake, 6),
          hasWithdrawn: participantData.hasWithdrawn,
          voterStake: ethers.formatEther(voteStakeData)
        });
        
      } catch (e) {
        console.error("Could not fetch user data:", e);
      }
    };
    findUserData();
  }, [walletAddress, bet]);

  const { canClaimWinnings, canClaimVoterRewards } = useMemo(() => {
    if (!walletAddress || !bet || bet.effectiveStatus !== 'completed') {
      return { canClaimWinnings: false, canClaimVoterRewards: false };
    }

    // Check for winnings
    const hasWithdrawnWinnings = userParticipantData?.hasWithdrawn || false;
    const isWinner = participants.some(p => 
      p.participant_address.toLowerCase() === walletAddress.toLowerCase() && 
      p.position === bet.winning_side
    );
    const hasWinningsToClaim = isWinner && !hasWithdrawnWinnings;

    // Check for voter rewards
    const didVote = votes.some(v => v.address.toLowerCase() === walletAddress.toLowerCase());
    const hasWithdrawnVoterRewards = userVoteStake !== null && userVoteStake === 0n; 
    const hasVoterRewardsToClaim = didVote && !hasWithdrawnVoterRewards;

    return { 
      canClaimWinnings: hasWinningsToClaim, 
      canClaimVoterRewards: hasVoterRewardsToClaim 
    };

  }, [walletAddress, bet, participants, votes, userParticipantData, userVoteStake]);

  const handleClaim = async () => {
    setIsProcessing(true);
    setError('');
    try {
      const betContract = getBetContract(bet.address, true);
      let tx;
      if (canClaimWinnings) {
        console.log("Attempting to claim winnings...");
        tx = await betContract.claimWinnings();
      } else if (canClaimVoterRewards) {
        console.log("Attempting to claim voter rewards...");
        tx = await betContract.claimVoterRewards();
      }
      if (tx) {
        console.log("Transaction sent, waiting for confirmation...");
        await tx.wait();
        console.log("Transaction confirmed!");
        loadBetDetails(bet.address);
      }
    } catch (err) {
      console.error("Claim failed:", err);
      
      if (err.message && err.message.includes("Winnings not yet distributed")) {
        setError("⚠️ Contract Error: The market status is 'Completed' but the smart contract hasn't finalized winnings distribution. This is likely a bug in the contract's resolution logic. Please check the Admin panel's Keeper section or contact support.");
      } else if (err.message && err.message.includes("No winnings to claim")) {
        setError("You don't have any winnings to claim from this market.");
      } else {
        setError(err.reason || err.message || "Transaction failed. Please try again.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (bet.effectiveStatus !== 'completed' || (!canClaimWinnings && !canClaimVoterRewards)) {
    return null;
  }

  return (
    <Card className="bg-gradient-to-br from-green-500/10 via-gray-800 to-gray-800 border-green-500/30">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-3">
          <PartyPopper className="w-6 h-6 text-green-400" />
          Claim Your Funds
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canClaimWinnings && <p className="text-green-300">Congratulations! You were on the winning side. Claim your payout now.</p>}
        {canClaimVoterRewards && <p className="text-purple-300">You voted correctly! Claim your staked PROOF and your share of the USDC rewards.</p>}
        
        <Button onClick={handleClaim} disabled={isProcessing} className="w-full bg-green-600 hover:bg-green-700 text-white text-lg font-bold">
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Wallet className="mr-2 h-5 w-5" />
              {canClaimWinnings ? 'Claim Winnings' : 'Claim Rewards'}
            </>
          )}
        </Button>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-900/30 border border-red-500/50 rounded-md">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-300 font-semibold mb-1">Claim Failed</p>
              <p className="text-sm text-red-200">{error}</p>
            </div>
          </div>
        )}
        
        {debugInfo && (
          <details className="text-xs text-gray-400 bg-gray-900/50 border border-gray-700 rounded p-2">
            <summary className="cursor-pointer flex items-center gap-2 font-semibold">
              <Bug className="w-3 h-3" />
              Debug Info (for developers)
            </summary>
            <pre className="mt-2 overflow-x-auto">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}