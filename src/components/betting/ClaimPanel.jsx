
import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, PartyPopper, Wallet, AlertCircle } from 'lucide-react';
import { getBetContract } from '../blockchain/contracts';
import { ethers } from 'ethers';

export default function ClaimPanel({ bet, participants, votes, walletAddress, loadBetDetails }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [userParticipantData, setUserParticipantData] = useState(null);
  const [userVoteStake, setUserVoteStake] = useState(null); // New state variable

  useEffect(() => {
    const findUserData = async () => { // Renamed from findParticipantData for clarity
      if (!walletAddress || !bet) return;
      try {
        const betContract = getBetContract(bet.address);
        // Fetch both participant data and vote stake in parallel
        const [participantData, voteStakeData] = await Promise.all([
            betContract.participants(walletAddress),
            betContract.voterStakesProof(walletAddress)
        ]);
        setUserParticipantData(participantData);
        setUserVoteStake(voteStakeData);
      } catch (e) {
        console.error("Could not fetch user data:", e); // Updated error message
      }
    };
    findUserData();
  }, [walletAddress, bet, loadBetDetails]);

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
    // A voter's stake is set to 0 after they claim rewards.
    // Check if userVoteStake is not null (meaning it has been fetched) and if it's 0n (BigInt zero)
    const hasWithdrawnVoterRewards = userVoteStake !== null && userVoteStake === 0n; 
    const hasVoterRewardsToClaim = didVote && !hasWithdrawnVoterRewards;

    return { 
      canClaimWinnings: hasWinningsToClaim, 
      canClaimVoterRewards: hasVoterRewardsToClaim 
    };

  }, [walletAddress, bet, participants, votes, userParticipantData, userVoteStake]); // Added userVoteStake to dependencies

  const handleClaim = async () => {
    setIsProcessing(true);
    setError('');
    try {
      const betContract = getBetContract(bet.address, true);
      let tx;
      if (canClaimWinnings) {
        tx = await betContract.claimWinnings();
      } else if (canClaimVoterRewards) {
        tx = await betContract.claimVoterRewards();
      }
      if (tx) {
        await tx.wait();
        loadBetDetails(bet.address); // Refresh details to update claimed status
      }
    } catch (err) {
      console.error("Claim failed:", err);
      setError(err.reason || "The transaction failed. Please check your wallet and try again.");
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
          <div className="flex items-center gap-2 text-sm text-red-400">
            <AlertCircle className="w-4 h-4" />
            <p>{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
