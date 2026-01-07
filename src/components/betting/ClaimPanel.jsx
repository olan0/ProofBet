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
  const [voterHasClaimed, setVoterHasClaimed] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  const [isCreator, setIsCreator] = useState(false);
  const [creatorHasClaimed, setCreatorHasClaimed] = useState(false);
  const [winningsAmount, setWinningsAmount] = useState(0);
  const [voterRewardAmounts, setVoterRewardAmounts] = useState({ usdc: 0, proof: 0 });
  const [creatorCollateralAmount, setCreatorCollateralAmount] = useState(0);

  useEffect(() => {
    const findUserData = async () => {
      if (!walletAddress || !bet) return;
      try {
        const betContract = getBetContract(bet.address);
        const [participantData, voterInfo, winningSide, creator, collateralAmount, betData] = await Promise.all([
            betContract.participants(walletAddress),
            betContract.voters(walletAddress),
            betContract.outcomeSide(),
            betContract.creator(),
            betContract.creatorCollateral(),
            betContract.getBetInfo()
        ]);
        
        setUserParticipantData(participantData);
        setUserVoteStake(voterInfo.stakeProof);
        setVoterHasClaimed(voterInfo.claimed);
        
        // Check if user is creator
        const userIsCreator = creator.toLowerCase() === walletAddress.toLowerCase();
        setIsCreator(userIsCreator);
        
        // Creator can claim if: collateral exists AND not yet claimed
        if (userIsCreator) {
          const collateralAmountFloat = parseFloat(ethers.formatUnits(collateralAmount, 6));
          setCreatorCollateralAmount(collateralAmountFloat);
          setCreatorHasClaimed(participantData.claimed || collateralAmountFloat === 0);
        }
        
        // Calculate payout amounts using getResolutionInfo
        try {
          const resInfo = await betContract.getResolutionInfo();

          const outcomeNum = Number(resInfo.outcome);
          const userYesStake = parseFloat(ethers.formatUnits(participantData.yesStake, 6));
          const userNoStake = parseFloat(ethers.formatUnits(participantData.noStake, 6));
          const totalUserStake = userYesStake + userNoStake;

          // Calculate participant payout
          const bettorBonusPool = parseFloat(ethers.formatUnits(resInfo.bettorBonusPoolUsdc, 6));

          if (bettorBonusPool > 0) {
            // Bettors get their stake + proportional bonus from forfeited collateral
            const totalStakeAll = parseFloat(ethers.formatUnits(resInfo.yesStake, 6)) + parseFloat(ethers.formatUnits(resInfo.noStake, 6));
            const userBonus = totalStakeAll > 0 ? (totalUserStake / totalStakeAll) * bettorBonusPool : 0;
            setWinningsAmount(totalUserStake + userBonus);
          } else if (outcomeNum === 3) {
            // Invalid but no bonus pool
            setWinningsAmount(totalUserStake);
          } else {
            const totalWinningStake = outcomeNum === 1 ? parseFloat(ethers.formatUnits(resInfo.yesStake, 6)) : parseFloat(ethers.formatUnits(resInfo.noStake, 6));
            const totalLosingStake = outcomeNum === 1 ? parseFloat(ethers.formatUnits(resInfo.noStake, 6)) : parseFloat(ethers.formatUnits(resInfo.yesStake, 6));
            const userWinningStake = outcomeNum === 1 ? userYesStake : userNoStake;

            if (userWinningStake > 0 && totalWinningStake > 0) {
              const voterReward = parseFloat(ethers.formatUnits(resInfo.voterRewardPoolUsdc, 6));
              const platformFee = parseFloat(ethers.formatUnits(resInfo.platformFeeUsdc, 6));
              const winnersPool = totalLosingStake - voterReward - platformFee;
              const userShare = (userWinningStake / totalWinningStake) * winnersPool;
              setWinningsAmount(userWinningStake + userShare);
            } else {
              setWinningsAmount(0);
            }
          }

          // Calculate voter reward
          const userVote = Number(voterInfo.vote);
          if (userVote === outcomeNum && userVote !== 0) {
            const winningVoters = outcomeNum === 1 ? Number(resInfo.yesVotes) : outcomeNum === 2 ? Number(resInfo.noVotes) : Number(resInfo.invalidVotes);
            const usdcReward = winningVoters > 0 ? parseFloat(ethers.formatUnits(resInfo.voterRewardPoolUsdc, 6)) / winningVoters : 0;
            const proofBonus = winningVoters > 0 ? parseFloat(ethers.formatEther(resInfo.forfeitProof)) / winningVoters : 0;
            const originalStake = parseFloat(ethers.formatEther(voterInfo.stakeProof));
            setVoterRewardAmounts({
              usdc: usdcReward,
              proof: originalStake + proofBonus
            });
          } else {
            setVoterRewardAmounts({ usdc: 0, proof: 0 });
          }
        } catch (e) {
          console.error("Could not calculate payout amounts:", e);
        }
        

        
        // Debug info
        setDebugInfo({
          winningSide: Number(winningSide),
          userYesStake: ethers.formatUnits(participantData.yesStake, 6),
          userNoStake: ethers.formatUnits(participantData.noStake, 6),
          claimed: participantData.claimed,
          voterStake: ethers.formatEther(voterInfo.stakeProof),
          isCreator: userIsCreator,
          creatorCollateralAmount: creatorCollateralAmount
        });
        
      } catch (e) {
        console.error("Could not fetch user data:", e);
      }
    };
    findUserData();
  }, [walletAddress, bet]);

  const { canClaimWinnings, canClaimVoterRewards, canClaimCreatorStake } = useMemo(() => {
    if (!walletAddress || !bet || bet.effectiveStatus !== 'completed') {
      return { canClaimWinnings: false, canClaimVoterRewards: false, canClaimCreatorStake: false };
    }

    // Check for winnings
    const hasWithdrawnWinnings = userParticipantData?.claimed || false;
    // If winning side is INVALID, all bettors are winners and get a share
    const isWinner = bet.winning_side === 'invalid' 
      ? participants.some(p => p.participant_address.toLowerCase() === walletAddress.toLowerCase())
      : participants.some(p => 
          p.participant_address.toLowerCase() === walletAddress.toLowerCase() && 
          p.position === bet.winning_side
        );
    const hasWinningsToClaim = isWinner && !hasWithdrawnWinnings;

    // Check for voter rewards
    const didVote = votes.some(v => v.address.toLowerCase() === walletAddress.toLowerCase());
    const hasVoterRewardsToClaim = didVote && !voterHasClaimed;

    // Check for creator collateral claim
    const hasCreatorStakeToClaim = isCreator && !creatorHasClaimed && bet.proofUrl;

    return { 
      canClaimWinnings: hasWinningsToClaim, 
      canClaimVoterRewards: hasVoterRewardsToClaim,
      canClaimCreatorStake: hasCreatorStakeToClaim
    };

  }, [walletAddress, bet, participants, votes, userParticipantData, userVoteStake, isCreator, creatorHasClaimed]);

  const handleClaim = async () => {
    setIsProcessing(true);
    setError('');
    try {
      const betContract = getBetContract(bet.address, true);
      let tx;
      if (canClaimCreatorStake) {
        console.log("Attempting to claim creator collateral...");
        tx = await betContract.claimCreatorCollateral();
      } else if (canClaimWinnings) {
        console.log("Attempting to claim bettor winnings/refunds...");
        tx = await betContract.claimBettor();
      } else if (canClaimVoterRewards) {
        console.log("Attempting to claim voter rewards/refunds...");
        tx = await betContract.claimVoter();
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

  if (bet.effectiveStatus !== 'completed' || (!canClaimWinnings && !canClaimVoterRewards && !canClaimCreatorStake)) {
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
        {canClaimWinnings && (
          <div className="space-y-2">
            <p className="text-green-300">{bet.winning_side === 'invalid' ? 'The proof was rejected! As a bettor, claim your share of the creator\'s collateral.' : 'Congratulations! You were on the winning side. Claim your payout now.'}</p>
            {winningsAmount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-green-400">${winningsAmount.toFixed(2)} USDC</span>
              </div>
            )}
          </div>
        )}
        {canClaimVoterRewards && (
          <div className="space-y-2">
            <p className="text-purple-300">You voted correctly! Claim your staked PROOF and your share of the USDC rewards.</p>
            {(voterRewardAmounts.usdc > 0 || voterRewardAmounts.proof > 0) && (
              <div className="flex items-center gap-4">
                {voterRewardAmounts.proof > 0 && (
                  <span className="text-xl font-bold text-purple-400">{voterRewardAmounts.proof.toFixed(2)} PROOF</span>
                )}
                {voterRewardAmounts.usdc > 0 && (
                  <span className="text-xl font-bold text-green-400">${voterRewardAmounts.usdc.toFixed(4)} USDC</span>
                )}
              </div>
            )}
          </div>
        )}
        {canClaimCreatorStake && (
          <div className="space-y-2">
            <p className="text-blue-300">As the creator who submitted proof, claim your USDC collateral back.</p>
            {creatorCollateralAmount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-cyan-400">${creatorCollateralAmount.toFixed(2)} USDC</span>
              </div>
            )}
          </div>
        )}
        
        <Button onClick={handleClaim} disabled={isProcessing} className="w-full bg-green-600 hover:bg-green-700 text-white text-lg font-bold">
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Wallet className="mr-2 h-5 w-5" />
              {canClaimCreatorStake ? 'Claim Creator Collateral' : canClaimWinnings ? 'Claim Winnings' : 'Claim Rewards'}
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