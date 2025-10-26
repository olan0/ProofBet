
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, TrendingUp, Shield, Vote, Wallet, Plus, Info, Loader2 } from "lucide-react";
import TrustScoreDisplay from "../trust/TrustScoreDisplay";
import { ethers } from "ethers";
import { getBetContract, getBetFactoryContract } from "../blockchain/contracts";
import { TrustScoreManager } from "../trust/TrustScoreManager";
import { createPageUrl } from "@/utils";

export default function VotingPanel({
  bet,
  participants,
  votes,
  appSettings,
  walletConnected,
  walletAddress,
  onRequestWalletConnect,
  loadBetDetails,
  isProcessingTx,
}) {
  const navigate = useNavigate(); 
  const [betAmount, setBetAmount] = useState(bet.minimum_bet_amount || 0.01);
  const [isLocalProcessing, setIsLocalProcessing] = useState(false);
  const [error, setError] = useState(null);

  const [internalBalances, setInternalBalances] = useState({ usdc: 0, proof: 0 });
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [userTrustScore, setUserTrustScore] = useState(null);
  const [loadingTrustScore, setLoadingTrustScore] = useState(false);

  const isProcessing = isProcessingTx || isLocalProcessing;

  const loadUserTrustScore = useCallback(async () => {
    if (!walletAddress) return;
    setLoadingTrustScore(true);
    try {
      const trustScore = await TrustScoreManager.getTrustScore(walletAddress);
      setUserTrustScore(trustScore);
    } catch (e) { setUserTrustScore({ overall_score: 0 }); }
    setLoadingTrustScore(false);
  }, [walletAddress]);

  const loadInternalBalances = useCallback(async () => {
    if (!walletAddress) return;
    setLoadingBalances(true);
    try {
      const factory = getBetFactoryContract();
      const [internalUsdc, internalProof] = await factory.getInternalBalances(walletAddress);
      setInternalBalances({
        usdc: parseFloat(ethers.formatUnits(internalUsdc, 6)),
        proof: parseFloat(ethers.formatEther(internalProof))
      });
    } catch (e) { setInternalBalances({ usdc: 0, proof: 0 }); }
    setLoadingBalances(false);
  }, [walletAddress]);

  useEffect(() => {
    if (walletConnected && walletAddress) {
      loadUserTrustScore();
      loadInternalBalances();
    }
  }, [walletConnected, walletAddress, loadUserTrustScore, loadInternalBalances]);

  const totalStakeUsd = (bet.total_yes_stake_usd || 0) + (bet.total_no_stake_usd || 0);
  const yesStakeUsd = bet.total_yes_stake_usd || 0;
  const noStakeUsd = bet.total_no_stake_usd || 0;
  const yesPercentage = totalStakeUsd > 0 ? (yesStakeUsd / totalStakeUsd) * 100 : 50;

  const meetsMinimumTrustScore = !walletConnected || !bet.minimum_trust_score || (userTrustScore && userTrustScore.overall_score >= bet.minimum_trust_score);
  
  const isBettor = walletAddress && participants.some(p => p.participant_address.toLowerCase() === walletAddress.toLowerCase());
  const hasVoted = walletAddress && votes.some(v => v.address.toLowerCase() === walletAddress.toLowerCase());

  const hasSufficientUsdcForBet = internalBalances.usdc >= betAmount;
  const voteStakeAmount = appSettings?.vote_stake_amount_proof || 10;
  const hasSufficientProofForVote = internalBalances.proof >= voteStakeAmount;

  const handlePlaceBet = async (side) => { // FIX: Added side parameter
    setError(null);
    if (!meetsMinimumTrustScore) {
      setError(`Your trust score (${Math.round(userTrustScore?.overall_score || 0)}) is below the minimum required (${bet.minimum_trust_score}).`);
      return;
    }
    setIsLocalProcessing(true);
    try {
      const betContract = getBetContract(bet.address, true);
      const sideEnum = side === 'yes' ? 1 : 2; // FIX: Use passed side parameter
      const amountInSmallestUnit = ethers.parseUnits(betAmount.toString(), 6);
      const tx = await betContract.placeBet(sideEnum, amountInSmallestUnit);
      await tx.wait();
      loadBetDetails();
      loadInternalBalances();
      loadUserTrustScore();
    } catch (err) {
      setError(err.reason || "Failed to place bet.");
    } finally {
      setIsLocalProcessing(false);
    }
  };

  const handleVote = async (choice) => {
    setError(null);
    if (isBettor) {
      setError("You cannot vote on a market you have bet on.");
      return;
    }
    if (hasVoted) {
      setError("You have already voted on this market.");
      return;
    }
    setIsLocalProcessing(true);
    try {
      const betContract = getBetContract(bet.address, true);
      const voteSideEnum = choice === 'yes' ? 1 : 2;
      const tx = await betContract.vote(voteSideEnum);
      await tx.wait();
      loadBetDetails();
      loadInternalBalances();
      loadUserTrustScore();
    } catch (err) {
      setError(err.reason || "Failed to cast vote.");
    } finally {
      setIsLocalProcessing(false);
    }
  };

  if (bet.effectiveStatus !== 'open_for_bets' && bet.effectiveStatus !== 'voting') {
    const getEndReason = () => {
      switch(bet.effectiveStatus) {
        case 'completed': return 'Market Resolved';
        case 'cancelled': return 'Market Cancelled';
        case 'betting_closed': return 'Betting Closed - Awaiting Proof';
        case 'awaiting_cancellation_no_proof': return 'Awaiting Cancellation';
        case 'awaiting_resolution': return 'Voting Ended - Awaiting Resolution';
        default: return 'Market Not Active';
      }
    };
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Market Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border-blue-500/20">
            <Info className="w-5 h-5 text-blue-400" />
            <p className="font-semibold text-blue-300">{getEndReason()}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Betting UI
  if (bet.effectiveStatus === 'open_for_bets') {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" /> Place Your Bet
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="betAmount" className="text-gray-300">Bet Amount (USDC)</Label>
            <Input id="betAmount" type="number" step="0.01" min={bet.minimum_bet_amount} value={betAmount} onChange={(e) => setBetAmount(parseFloat(e.target.value))} className="bg-gray-700 border-gray-600 text-white" />
          </div>

          {!walletConnected ? (
            <Button onClick={onRequestWalletConnect} className="w-full bg-cyan-600 hover:bg-cyan-700">
              <Wallet className="w-4 h-4 mr-2" />
              Connect Wallet to Bet
            </Button>
          ) : !hasSufficientUsdcForBet ? (
            <div className="space-y-2 text-center">
              <p className="text-sm text-yellow-400">
                You need at least {betAmount.toFixed(2)} USDC to place this bet. Your balance is {internalBalances.usdc.toFixed(2)} USDC.
              </p>
              <Button onClick={() => navigate(createPageUrl("Dashboard") + "?tab=wallet")} className="w-full bg-yellow-600 hover:bg-yellow-700 text-black">
                <Plus className="w-4 h-4 mr-2" />
                Deposit USDC
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => handlePlaceBet('yes')} disabled={isProcessing} className="bg-green-600 hover:bg-green-700">
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin"/> : "Bet YES"}
              </Button>
              <Button onClick={() => handlePlaceBet('no')} disabled={isProcessing} className="bg-red-600 hover:bg-red-700">
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin"/> : "Bet NO"}
              </Button>
            </div>
          )}
          
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 pt-2">
                <AlertCircle className="w-4 h-4" />
                <p>{error}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Voting UI
  if (bet.effectiveStatus === 'voting') {
     const handleVoteButtonClick = (side) => {
      if (!walletConnected) { onRequestWalletConnect(); return; }
      if (!hasSufficientProofForVote) { navigate(createPageUrl("Dashboard") + "?tab=wallet"); return; }
      handleVote(side);
    };
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" /> Stake to Vote & Earn
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isBettor || hasVoted ? (
            <p>{isBettor ? "You cannot vote on this market." : "You have already voted."}</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => handleVoteButtonClick('yes')} disabled={isProcessing} className="bg-green-600">Vote YES</Button>
                <Button onClick={() => handleVoteButtonClick('no')} disabled={isProcessing} className="bg-red-600">Vote NO</Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return null;
}
