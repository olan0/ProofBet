
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, TrendingUp, Shield, Vote, Wallet, CheckCircle, Plus } from "lucide-react";
import { TrustScoreManager } from "../trust/TrustScoreManager";
import TrustScoreDisplay from "../trust/TrustScoreDisplay";
import { formatDistanceToNow } from 'date-fns';
import { ethers } from "ethers";
import { getBetContract, getBetFactoryContract, getUsdcTokenContract, getProofTokenContract } from "../blockchain/contracts";
import { createPageUrl } from "@/utils"; // Import createPageUrl

export default function VotingPanel({
  bet,
  participants,
  votes,
  appSettings,
  walletConnected,
  walletAddress,
  onRequestWalletConnect,
  loadBetDetails
}) {
  const navigate = useNavigate(); // Initialize useNavigate hook
  const [betAmount, setBetAmount] = useState(bet.minimum_bet_amount || 0.01);
  const [selectedSide, setSelectedSide] = useState('yes');
  const [isBettingInProgress, setIsBettingInProgress] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [userTrustScore, setUserTrustScore] = useState(null);
  const [loadingTrustScore, setLoadingTrustScore] = useState(false);
  const [error, setError] = useState(null); // New state for displaying error messages

  // NEW: Internal wallet balances
  const [internalBalances, setInternalBalances] = useState({ usdc: 0, proof: 0 });
  const [loadingBalances, setLoadingBalances] = useState(false);
  // Removed: showDepositPrompt, as button click will now directly navigate

  const loadUserTrustScore = useCallback(async () => {
    if (!walletAddress) return;

    setLoadingTrustScore(true);
    try {
      const trustScore = await TrustScoreManager.getTrustScore(walletAddress);
      setUserTrustScore(trustScore);
    } catch (error) {
      console.error("Error loading trust score for voting panel:", error);
      setUserTrustScore({ overall_score: 0 });
    }
    setLoadingTrustScore(false);
  }, [walletAddress]);

  // NEW: Load internal wallet balances
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
    } catch (error) {
      console.error("Error loading internal balances:", error);
      setInternalBalances({ usdc: 0, proof: 0 });
    }
    setLoadingBalances(false);
  }, [walletAddress]);

  useEffect(() => {
    if (walletConnected && walletAddress) {
      loadUserTrustScore();
      loadInternalBalances();
    } else {
      setUserTrustScore(null);
      setInternalBalances({ usdc: 0, proof: 0 });
    }
  }, [walletConnected, walletAddress, loadUserTrustScore, loadInternalBalances]);

  // Use USD values for stakes for display and reward pool calculation
  const totalStakeUsd = (bet.total_yes_stake_usd || 0) + (bet.total_no_stake_usd || 0);
  const yesStakeUsd = bet.total_yes_stake_usd || 0;
  const noStakeUsd = bet.total_no_stake_usd || 0;
  const yesPercentage = totalStakeUsd > 0 ? (yesStakeUsd / totalStakeUsd) * 100 : 50;

  // Check trust score eligibility
  const meetsMinimumTrustScore = !walletConnected || !bet.minimum_trust_score || (userTrustScore && userTrustScore.overall_score >= bet.minimum_trust_score);

  // --- LOGIC FIX: REMOVED PREDICTIVE STATE LOGIC ---
  // The UI will now only show actions based on the confirmed 'bet.status' from the contract.
  const canAcceptBets = bet.status === 'open_for_bets';
  const canAcceptVotes = bet.status === 'voting';

  // Check if both sides meet minimum requirements (assuming minimum_side_stake in USDC)
  const yesMetMinimum = yesStakeUsd >= (bet.minimum_side_stake || 0);
  const noMetMinimum = noStakeUsd >= (bet.minimum_side_stake || 0);
  const bothSidesReady = yesMetMinimum && noMetMinimum;

  const currentUserAddress = walletAddress;
  const isParticipant = participants.some(p => p.participant_address === currentUserAddress);
  const isCreator = bet.creator_address === currentUserAddress;
  const hasFinancialStake = isParticipant || isCreator;

  // NEW: Check if the current user has already voted
  const hasVoted = walletAddress && votes.some(v => v.voter_address === walletAddress);

  // NEW: Check if user has sufficient internal balance
  const hasSufficientUsdcForBet = internalBalances.usdc >= betAmount;
  const voteStakeAmount = appSettings?.vote_stake_amount_proof || 10;
  const hasSufficientProofForVote = internalBalances.proof >= voteStakeAmount;

  const handlePlaceBet = async () => {
    setError(null); // Clear previous errors
    // Removed: setShowDepositPrompt(false); - no longer needed as the button's onClick handles navigation

    // The check for !walletConnected and !hasSufficientUsdcForBet is now handled by handleBetButtonClick
    // This function assumes these conditions are met if it's called.

    if (!meetsMinimumTrustScore) {
      setError(`Your trust score (${Math.round(userTrustScore?.overall_score || 0)}) is below the minimum required (${bet.minimum_trust_score}) for this bet.`);
      return;
    }

    setIsBettingInProgress(true); // Set local loading state
    try {
      const betContract = getBetContract(bet.address, true); // with signer
      // const usdcContract = getUsdcTokenContract(true); // with signer -- NO LONGER NEEDED FOR DIRECT BET PLACEMENT

      const sideEnum = selectedSide === 'yes' ? 1 : 2;
      const amountInSmallestUnit = ethers.parseUnits(betAmount.toString(), 6);

      console.log(`Attempting to place bet using internal balance:`, {
        side: selectedSide,
        sideEnum,
        amount: betAmount,
        amountInSmallestUnit: amountInSmallestUnit.toString(),
        betAddress: bet.address
      });

      // 1. Check user's USDC balance (already done via hasSufficientUsdcForBet)
      // 2. Check current allowance (no longer needed for internal balance transfer)

      // 3. Place the bet using internal balance
      console.log(`Placing bet of ${ethers.formatUnits(amountInSmallestUnit, 6)} USDC on side ${sideEnum}...`);
      const placeBetTx = await betContract.placeBet(sideEnum, amountInSmallestUnit);
      console.log(`Place bet transaction hash: ${placeBetTx.hash}`);
      await placeBetTx.wait(); // Wait for the transaction to be mined
      console.log("Bet placed successfully using internal balance!");

      // Refresh data immediately after transaction is confirmed
      if (loadBetDetails) {
        await loadBetDetails(bet.address);
      }
      loadInternalBalances(); // Refresh internal balances
      if (walletAddress) {
        loadUserTrustScore(); // Refresh trust score after successful bet
      }

    } catch (err) {
      console.error("Failed to place bet:", err);

      let errorMessage = "An error occurred while placing the bet.";

      // Check for common error patterns from ethers.js or contract reverts
      if (err.message?.includes("User denied transaction signature")) {
        errorMessage = "Transaction denied by user.";
      } else if (err.message?.includes("insufficient funds")) {
        errorMessage = "Insufficient funds for gas or USDC balance.";
      } else if (err.message?.includes("Trust score too low")) {
        errorMessage = "Your trust score is too low for this bet.";
      } else if (err.message?.includes("Betting has closed")) {
        errorMessage = "Betting period has ended for this market.";
      } else if (err.message?.includes("Stake is too low")) {
        errorMessage = `Minimum bet amount is ${bet.minimum_bet_amount} USDC.`;
      } else if (err.reason) { // Ethers v6 often uses err.reason for revert messages
        errorMessage = `Contract error: ${err.reason}`;
      } else if (err.data && typeof err.data === 'string') {
        // Fallback for generic revert data
        errorMessage = `Transaction failed with data: ${err.data.substring(0, 100)}...`;
      } else if (err.code === 4001) { // MetaMask user rejected error code
        errorMessage = "Transaction rejected by user.";
      } else if (err.code === "UNPREDICTABLE_GAS_LIMIT") {
        errorMessage = "Could not estimate gas. Check transaction parameters or network status.";
      }
      setError(errorMessage);
    } finally {
      setIsBettingInProgress(false); // Always reset loading state
    }
  };

  const handleVote = async (choice) => { // Renamed from handleVoteClick
    setError(null); // Clear previous errors
    // Removed: setShowDepositPrompt(false); - no longer needed

    // The check for !walletConnected and !hasSufficientProofForVote is now handled by the button's onClick
    // This function assumes these conditions are met if it's called.

    if (hasFinancialStake) {
      setError("You cannot vote on this bet because you have money at stake or created it. Only neutral observers can vote.");
      return;
    }

    if (!meetsMinimumTrustScore) {
      setError(`Your trust score (${Math.round(userTrustScore?.overall_score || 0)}) is below the minimum required (${bet.minimum_trust_score}) for this bet.`);
      return;
    }

    if (hasVoted) {
      setError("You have already voted on this bet.");
      return;
    }

    setIsVoting(true);
    try {
      const betContract = getBetContract(bet.address, true); // with signer
      const voteSideEnum = choice === 'yes' ? 1 : 2;

      const voteTx = await betContract.vote(voteSideEnum);
      await voteTx.wait(); // Wait for the transaction to be mined

      console.log("Vote cast successfully using internal balance!");

      // Refresh data immediately after transaction is confirmed
      if (loadBetDetails) {
        await loadBetDetails(bet.address);
      }
      loadInternalBalances(); // Refresh balances after vote
      if (walletAddress) {
        loadUserTrustScore();
      }

    } catch (error) {
      console.error("Error voting:", error);
      let errorMessage = "An error occurred while voting.";
      if (error.message?.includes("User denied transaction signature")) {
        errorMessage = "Transaction denied by user.";
      } else if (error.reason) { // Ethers v6 often uses err.reason for revert messages
        errorMessage = `Contract error: ${error.reason}`;
      } else if (error.code === 4001) { // MetaMask user rejected error code
        errorMessage = "Transaction rejected by user.";
      }
      setError(errorMessage); // Generic error for voting
    }
    setIsVoting(false);
  };

  // Removed: DepositPrompt component, as its functionality is now inline with the buttons

  // Show expired/ended message if no actions are possible
  if (!canAcceptBets && !canAcceptVotes) {
    const getEndReason = () => {
      if (bet.status === 'completed') return 'Betting Complete';
      if (bet.status === 'cancelled') return 'Bet Cancelled';
      if (bet.status === 'betting_closed') return 'Betting Closed - Awaiting Proof';
      // Fallback for states where actions are not available but aren't explicitly ended.
      return 'Bet Not Active for Betting/Voting';
    };

    const getEndDescription = () => {
      const now = new Date();
      if (bet.status === 'completed') return `Winner: ${bet.winning_side?.toUpperCase() || 'TBD'}`;
      if (bet.status === 'cancelled') return 'Minimum requirements not met or deadline missed. Stakes will be refunded.';
      if (bet.status === 'betting_closed') {
         const proofDeadline = new Date(bet.proof_deadline);
         if (now > proofDeadline) {
             return 'The creator missed the proof deadline. The market must be cancelled by a keeper.';
         }
         return 'The creator must submit proof before the public voting phase can begin.';
      }
      return 'No more interactions are allowed on this bet at this time.';
    };

    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Betting Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`flex items-center gap-3 p-3 rounded-lg ${bet.status === 'cancelled' ? 'bg-red-500/10 border-red-500/20' : 'bg-blue-500/10 border-blue-500/20'}`}>
            <AlertCircle className={`w-5 h-5 ${bet.status === 'cancelled' ? 'text-red-400' : 'text-blue-400'}`} />
            <div>
              <h4 className={`font-semibold ${bet.status === 'cancelled' ? 'text-red-300' : 'text-blue-300'}`}>
                {getEndReason()}
              </h4>
              <p className={`text-sm ${bet.status === 'cancelled' ? 'text-red-400/80' : 'text-blue-400/80'}`}>
                {getEndDescription()}
              </p>
              {bet.status === 'betting_closed' && bet.betting_deadline && (
                <p className="text-xs text-gray-400 mt-1">
                  Betting ended {formatDistanceToNow(new Date(bet.betting_deadline), { addSuffix: true })}
                </p>
              )}
              {bet.status === 'voting' && bet.voting_deadline && ( // If status is voting but no longer canAcceptVotes, it's over
                <p className="text-xs text-gray-400 mt-1">
                  Voting ended {formatDistanceToNow(new Date(bet.voting_deadline), { addSuffix: true })}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (canAcceptBets) {
    // New handler to encapsulate deposit logic or bet placement
    const handleBetButtonClick = () => {
      if (!walletConnected) {
        onRequestWalletConnect();
        return;
      }
      if (!hasSufficientUsdcForBet) {
        navigate(createPageUrl("Dashboard") + "?tab=wallet");
        return;
      }
      // If sufficient USDC, proceed to place bet
      handlePlaceBet();
    };

    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            Place Your Bet
          </CardTitle>
          <p className="text-gray-400 text-sm">
            Using your internal wallet balance for seamless betting
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Internal Balance Display */}
          {walletConnected && !loadingBalances && (
            <div className="p-3 bg-gray-700/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-300 text-sm">Your Internal USDC Balance:</span>
                <span className={`font-mono text-sm font-medium ${hasSufficientUsdcForBet ? 'text-green-400' : 'text-yellow-400'}`}>
                  ${internalBalances.usdc.toFixed(2)}
                </span>
              </div>
              {!hasSufficientUsdcForBet && (
                <p className="text-yellow-400 text-xs">
                  Need ${betAmount.toFixed(2)} USDC for this bet
                </p>
              )}
            </div>
          )}

          {/* Removed: DepositPrompt component */}

          {/* Trust Score Display */}
          {walletConnected && !loadingTrustScore && userTrustScore && (
            <div className="p-3 bg-gray-700/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-300 text-sm">Your Trust Score:</span>
                <TrustScoreDisplay score={userTrustScore.overall_score} compact={true} />
              </div>
              {bet.minimum_trust_score > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">Required:</span>
                  <span className={`text-xs font-medium ${meetsMinimumTrustScore ? 'text-green-400' : 'text-red-400'}`}>
                    {bet.minimum_trust_score}/100 {meetsMinimumTrustScore ? '✓' : '✗'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Trust Score Requirement Warning */}
          {walletConnected && !loadingTrustScore && bet.minimum_trust_score > 0 && !meetsMinimumTrustScore && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4 text-red-400" />
                <span className="font-semibold text-red-300 text-sm">Trust Score Too Low</span>
              </div>
              <p className="text-red-200 text-sm">
                You need a trust score of {bet.minimum_trust_score} to participate in this bet.
                Your current score is {Math.round(userTrustScore?.overall_score || 0)}.
              </p>
            </div>
          )}

          {/* Current Stakes Display */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-green-400">YES Side</span>
                  <span className={`font-medium ${yesMetMinimum ? 'text-green-400' : 'text-yellow-400'}`}>
                    ${yesStakeUsd.toFixed(2)} / ${(bet.minimum_side_stake || 0).toFixed(2)} USDC
                  </span>
                </div>
                <Progress
                  value={(yesStakeUsd / (bet.minimum_side_stake || 1)) * 100}
                  className="h-2 bg-gray-700"
                />
                {!yesMetMinimum && (
                  <p className="text-xs text-gray-400">
                    Need ${((bet.minimum_side_stake || 0) - yesStakeUsd).toFixed(2)} more USDC
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-red-400">NO Side</span>
                  <span className={`font-medium ${noMetMinimum ? 'text-green-400' : 'text-yellow-400'}`}>
                    ${noStakeUsd.toFixed(2)} / ${(bet.minimum_side_stake || 0).toFixed(2)} USDC
                  </span>
                </div>
                <Progress
                  value={(noStakeUsd / (bet.minimum_side_stake || 1)) * 100}
                  className="h-2 bg-gray-700"
                />
                {!noMetMinimum && (
                  <p className="text-xs text-gray-400">
                    Need ${((bet.minimum_side_stake || 0) - noStakeUsd).toFixed(2)} more USDC
                  </p>
                )}
              </div>
            </div>

            {!bothSidesReady && (
              <div className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded p-2">
                ⚠️ Both YES and NO sides must reach minimum stakes before bet can proceed
              </div>
            )}
          </div>

          {/* Position Selection */}
          <div className="space-y-2">
            <Label className="text-gray-300">Your Position</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={selectedSide === 'yes' ? 'default' : 'outline'}
                onClick={() => setSelectedSide('yes')}
                className={selectedSide === 'yes'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'border-green-500/50 text-green-400 hover:bg-green-500/10'}
              >
                YES - Will happen
              </Button>
              <Button
                variant={selectedSide === 'no' ? 'default' : 'outline'}
                onClick={() => setSelectedSide('no')}
                className={selectedSide === 'no'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'border-red-500/50 text-red-400 hover:bg-red-500/10'}
              >
                NO - Won't happen
              </Button>
            </div>
          </div>

          {!walletConnected && (
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-4 h-4 text-yellow-400" />
                <span className="font-semibold text-yellow-300">Wallet Required</span>
              </div>
              <p className="text-yellow-200 text-sm">
                Connect your wallet to place bets and participate in the market.
              </p>
            </div>
          )}

          {/* Bet Amount */}
          <div className="space-y-2">
            <Label htmlFor="betAmount" className="text-gray-300">Bet Amount (USDC)</Label>
            <Input
              id="betAmount"
              type="number"
              step="0.01"
              min={bet.minimum_bet_amount || 0.01}
              value={betAmount}
              onChange={(e) => setBetAmount(parseFloat(e.target.value))}
              className="bg-gray-700 border-gray-600 text-white"
            />
            <p className="text-xs text-gray-400">
              Minimum: ${(bet.minimum_bet_amount || 0.01).toFixed(2)} USDC
            </p>
          </div>

          <Button
            onClick={handleBetButtonClick}
            disabled={isBettingInProgress || (!walletConnected || (betAmount < (bet.minimum_bet_amount || 0.01)) || !meetsMinimumTrustScore)}
            className="w-full bg-gradient-to-r from-cyan-600 to-purple-700 hover:from-cyan-700 hover:to-purple-800 text-white font-bold py-3"
          >
            {!walletConnected ? (
              <>
                <Wallet className="w-5 h-5 mr-2" />
                Connect Wallet to Bet
              </>
            ) : !meetsMinimumTrustScore && (bet.minimum_trust_score || 0) > 0 ? (
              `Trust Score Too Low (${Math.round(userTrustScore?.overall_score || 0)}/${bet.minimum_trust_score || 0})`
            ) : !hasSufficientUsdcForBet ? (
              <>
                <Plus className="w-5 h-5 mr-2" />
                Deposit USDC to Bet
              </>
            ) : isBettingInProgress ? 'Placing Bet...' : `Bet $${(betAmount || 0).toFixed(2)} USDC on ${selectedSide.toUpperCase()}`}
          </Button>

          {error && ( // Display error message
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 inline mr-2" />
              {error}
            </div>
          )}

          <div className="text-xs text-gray-400 bg-blue-500/10 border border-blue-500/20 rounded p-2">
            💡 Using internal wallet - no token approvals needed for each bet!
          </div>
          
          <div className="text-xs text-gray-300 bg-yellow-500/10 border border-yellow-500/20 rounded p-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-400" />
            <span>⛽ Small ETH gas fee (~$0.50-$2) required to submit transaction</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (canAcceptVotes) {
    const now = new Date();
    const votingDeadline = bet.voting_deadline ? new Date(bet.voting_deadline) : null;
    const votingPeriodOver = votingDeadline && now >= votingDeadline;

    if (votingPeriodOver) {
        return (
             <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-white">Betting Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border-blue-500/20">
                    <AlertCircle className="w-5 h-5 text-blue-400" />
                    <div>
                      <h4 className="font-semibold text-blue-300">Voting Period Ended</h4>
                      <p className="text-sm text-blue-400/80">
                        The voting period has now finished. A keeper must trigger the final resolution.
                      </p>
                      {votingDeadline && (
                        <p className="text-xs text-gray-400 mt-1">
                          Voting ended {formatDistanceToNow(votingDeadline, { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
        )
    }
    
    const totalVotes = votes?.length || 0;
    const minimumVotes = bet.minimum_votes || 3;
    const votesNeeded = Math.max(0, minimumVotes - totalVotes);
    const timeUntilDeadline = votingDeadline && votingDeadline > now ?
      formatDistanceToNow(votingDeadline, { addSuffix: true }) :
      "Deadline passed";

    // Calculate voting incentives with staking
    // voteStakeAmount is defined earlier based on appSettings?.vote_stake_amount_proof || 10
    const voterRewardPct = appSettings?.voter_reward_percentage || 5;
    const voterRewardPool = totalStakeUsd * (voterRewardPct / 100); // Use totalStakeUsd for reward pool (in USDC)
    const estimatedVoterReward = minimumVotes > 0 ? voterRewardPool / minimumVotes : 0;

    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            Stake to Vote & Earn
          </CardTitle>
          <p className="text-gray-400 text-sm">
            Using your internal wallet • Stake {voteStakeAmount} PROOF to vote
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Internal PROOF Balance Display */}
          {walletConnected && !loadingBalances && (
            <div className="p-3 bg-gray-700/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-300 text-sm">Your Internal PROOF Balance:</span>
                <span className={`font-mono text-sm font-medium ${hasSufficientProofForVote ? 'text-green-400' : 'text-yellow-400'}`}>
                  {internalBalances.proof.toFixed(2)} PROOF
                </span>
              </div>
              {!hasSufficientProofForVote && (
                <p className="text-yellow-400 text-xs">
                  Need {voteStakeAmount} PROOF to vote
                </p>
              )}
            </div>
          )}

          {/* Removed: DepositPrompt component */}

          {/* Trust Score Display for Voting */}
          {walletConnected && !loadingTrustScore && userTrustScore && (
            <div className="p-3 bg-gray-700/50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-300 text-sm">Your Trust Score:</span>
                <TrustScoreDisplay score={userTrustScore.overall_score} compact={true} />
              </div>
              {bet.minimum_trust_score > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-xs">Required:</span>
                  <span className={`text-xs font-medium ${meetsMinimumTrustScore ? 'text-green-400' : 'text-red-400'}`}>
                    {bet.minimum_trust_score}/100 {meetsMinimumTrustScore ? '✓' : '✗'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Vote Staking Explanation */}
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-5 h-5 text-blue-400" />
              <span className="font-semibold text-blue-200">How Vote Staking Works</span>
            </div>
            <div className="text-sm text-blue-300 space-y-2">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full mt-1.5"></div>
                <p><strong>Deposit:</strong> Pay {voteStakeAmount} PROOF to cast your vote</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full mt-1.5"></div>
                <p><strong>Honest Voting:</strong> Vote with majority → Get stake back + bonus</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-red-400 rounded-full mt-1.5"></div>
                <p><strong>Dishonest Voting:</strong> Vote with minority → Lose your stake</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full mt-1.5"></div>
                <p><strong>Extra Rewards:</strong> {voterRewardPct}% of total bets (~${estimatedVoterReward.toFixed(4)} USDC per voter)</p>
              </div>
            </div>
          </div>

          {/* Voting Progress */}
          {votesNeeded > 0 && (
            <div className={`p-3 rounded-lg ${votingPeriodOver ? 'bg-red-500/10 border-red-500/20' : 'bg-yellow-500/10 border-yellow-500/20'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Vote className={`w-4 h-4 ${votingPeriodOver ? 'text-red-400' : 'text-yellow-400'}`} />
                <span className={`font-semibold text-sm ${votingPeriodOver ? 'text-red-300' : 'text-yellow-300'}`}>
                  {votingPeriodOver ? 'Voting Ended - Insufficient Votes' : 'Votes Needed'}
                </span>
              </div>
              <p className={`text-sm ${votingPeriodOver ? 'text-red-200' : 'text-yellow-200'}`}>
                {votingPeriodOver ?
                  `Only ${totalVotes} of ${minimumVotes} required votes were cast. Stakes will be refunded.` :
                  `${votesNeeded} more vote${votesNeeded !== 1 ? 's' : ''} needed (${totalVotes}/${minimumVotes})`
                }
              </p>
            </div>
          )}

          {!walletConnected && (
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-4 h-4 text-purple-400" />
                <span className="font-semibold text-purple-300">Wallet Required</span>
              </div>
              <p className="text-purple-200 text-sm">
                Connect your wallet to stake and vote.
              </p>
            </div>
          )}

          {error && ( // Display error message
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 inline mr-2" />
              {error}
            </div>
          )}

          <div className="space-y-3">
            <div className="flex justify-between text-lg">
              <span className="font-bold text-green-400">YES</span>
              <span className="font-bold text-red-400">NO</span>
            </div>
            <Progress value={yesPercentage} className="h-4 bg-red-500/30" />
            <div className="flex justify-between text-sm font-medium text-white">
              <span>${(bet.total_yes_stake_usd || 0).toFixed(2)} ({(yesPercentage || 0).toFixed(1)}%)</span>
              <span>${(bet.total_no_stake_usd || 0).toFixed(2)} ({(100 - (yesPercentage || 0)).toFixed(1)}%)</span>
            </div>
          </div>

          {hasFinancialStake ? (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <span className="font-semibold text-red-300">Cannot Vote</span>
              </div>
              <p className="text-red-200 text-sm">
                {isCreator
                  ? "You created this bet and cannot vote on the outcome."
                  : "You have money at stake and cannot vote on the outcome."}
              </p>
            </div>
          ) : !meetsMinimumTrustScore && bet.minimum_trust_score > 0 ? (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5 text-red-400" />
                <span className="font-semibold text-red-300">Trust Score Too Low to Vote</span>
              </div>
              <p className="text-red-200 text-sm">
                You need a trust score of {bet.minimum_trust_score} to vote on this bet.
                Your current score is {Math.round(userTrustScore?.overall_score || 0)}.
              </p>
            </div>
          ) : (
            <>
              {hasVoted ? (
                <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-purple-400" />
                    <span className="font-semibold text-purple-300">You have voted!</span>
                  </div>
                  <p className="text-purple-200 text-sm">
                    Your vote has been recorded. Thank you for participating.
                  </p>
                </div>
              ) : (
                <>
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="w-4 h-4 text-green-400" />
                      <span className="font-semibold text-green-300 text-sm">Eligible to Vote</span>
                    </div>
                    <p className="text-green-200 text-xs">
                      You can vote because you have no financial stake in this bet.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="text-center p-3 bg-gray-700/50 rounded-lg">
                      <p className="text-white text-lg font-bold">{voteStakeAmount} PROOF Required</p>
                      <p className="text-gray-400 text-sm">Stake amount to cast your vote</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <Button
                        onClick={() => {
                          if (!walletConnected) {
                            onRequestWalletConnect();
                          } else if (!hasSufficientProofForVote) {
                            navigate(createPageUrl("Dashboard") + "?tab=wallet");
                          } else {
                            handleVote('yes');
                          }
                        }}
                        disabled={isVoting || hasFinancialStake || !meetsMinimumTrustScore || hasVoted}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-6 text-lg flex flex-col gap-1"
                      >
                        {!walletConnected ? (
                          <>
                            <Wallet className="w-4 h-4" />
                            <span className="text-sm">Connect</span>
                          </>
                        ) : !hasSufficientProofForVote ? (
                          <>
                            <Plus className="w-4 h-4" />
                            <span className="text-sm">Deposit PROOF</span>
                          </>
                        ) : (
                          <>
                            <span>Vote YES</span>
                            <span className="text-xs opacity-80">{voteStakeAmount} PROOF</span>
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => {
                          if (!walletConnected) {
                            onRequestWalletConnect();
                          } else if (!hasSufficientProofForVote) {
                            navigate(createPageUrl("Dashboard") + "?tab=wallet");
                          } else {
                            handleVote('no');
                          }
                        }}
                        disabled={isVoting || hasFinancialStake || !meetsMinimumTrustScore || hasVoted}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-6 text-lg flex flex-col gap-1"
                      >
                        {!walletConnected ? (
                          <>
                            <Wallet className="w-4 h-4" />
                            <span className="text-sm">Connect</span>
                          </>
                        ) : !hasSufficientProofForVote ? (
                          <>
                            <Plus className="w-4 h-4" />
                            <span className="text-sm">Deposit PROOF</span>
                          </>
                        ) : (
                          <>
                            <span>Vote NO</span>
                            <span className="text-xs opacity-80">{voteStakeAmount} PROOF</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          <div className="text-xs text-gray-400 text-center">
            Using internal wallet • Winner determined by staked votes • {timeUntilDeadline}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Fallback - should not be reached
  return null;
}
