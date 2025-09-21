
import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, TrendingUp, Shield, Vote, Wallet, CheckCircle } from "lucide-react";
import { TrustScoreManager } from "../trust/TrustScoreManager";
import TrustScoreDisplay from "../trust/TrustScoreDisplay";
import { formatDistanceToNow } from 'date-fns';

export default function VotingPanel({ bet, participants, onPlaceBet, onVote, votes, appSettings, walletConnected, walletAddress, onRequestWalletConnect }) {
  // Initialize betAmount with minimum_bet_amount, assumed to be in USDC now
  const [betAmount, setBetAmount] = useState(bet.minimum_bet_amount || 0.01);
  const [selectedSide, setSelectedSide] = useState('yes');
  const [isPlacingBet, setIsPlacingBet] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const [userTrustScore, setUserTrustScore] = useState(null);
  const [loadingTrustScore, setLoadingTrustScore] = useState(false);

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

  useEffect(() => {
    if (walletConnected && walletAddress) {
      loadUserTrustScore();
    } else {
      setUserTrustScore(null);
    }
  }, [walletConnected, walletAddress, loadUserTrustScore]);
  
  // Use USD values for stakes for display and reward pool calculation
  const totalStakeUsd = (bet.total_yes_stake_usd || 0) + (bet.total_no_stake_usd || 0);
  const yesStakeUsd = bet.total_yes_stake_usd || 0;
  const noStakeUsd = bet.total_no_stake_usd || 0;
  const yesPercentage = totalStakeUsd > 0 ? (yesStakeUsd / totalStakeUsd) * 100 : 50;
  
  // Check trust score eligibility
  const meetsMinimumTrustScore = !walletConnected || !bet.minimum_trust_score || (userTrustScore && userTrustScore.overall_score >= bet.minimum_trust_score);
  
  // DEADLINE and STATUS checks
  const now = new Date();
  const bettingDeadline = new Date(bet.betting_deadline);
  const votingDeadline = bet.voting_deadline ? new Date(bet.voting_deadline) : null;
  
  const bettingPeriodOver = now >= bettingDeadline;
  const votingPeriodOver = votingDeadline && now >= votingDeadline;

  // Determine which UI to show based on status
  const canAcceptBets = bet.status === 'open_for_bets' && !bettingPeriodOver;
  const canAcceptVotes = bet.status === 'voting' && !votingPeriodOver;
  
  // Check if both sides meet minimum requirements (assuming minimum_side_stake and minimum_total_stake are in USDC)
  const yesMetMinimum = yesStakeUsd >= (bet.minimum_side_stake || 0);
  const noMetMinimum = noStakeUsd >= (bet.minimum_side_stake || 0);
  const totalMetMinimum = totalStakeUsd >= (bet.minimum_total_stake || 0);
  const bothSidesReady = yesMetMinimum && noMetMinimum && totalMetMinimum;
  
  const currentUserAddress = walletAddress;
  const isParticipant = participants.some(p => p.participant_address === currentUserAddress);
  const isCreator = bet.creator_address === currentUserAddress;
  const hasFinancialStake = isParticipant || isCreator;

  // NEW: Check if the current user has already voted
  const hasVoted = walletAddress && votes.some(v => v.voter_address === walletAddress);

  const handlePlaceBet = async () => {
    if (!walletConnected) {
      onRequestWalletConnect();
      return;
    }

    if (!meetsMinimumTrustScore) {
      alert(`Your trust score (${Math.round(userTrustScore?.overall_score || 0)}) is below the minimum required (${bet.minimum_trust_score}) for this bet.`);
      return;
    }
    
    setIsPlacingBet(true);
    try {
      // onPlaceBet will receive betAmount which is now expected to be in USDC based on UI changes.
      await onPlaceBet(selectedSide, betAmount);
      if (walletAddress) {
        // Trust score is now calculated with a cache to prevent rate limits
        loadUserTrustScore();
      }
    } catch (error) {
      console.error("Error placing bet:", error);
    }
    setIsPlacingBet(false);
  };

  const handleVoteClick = async (choice) => {
    if (!walletConnected) {
      onRequestWalletConnect();
      return;
    }

    if (hasFinancialStake) {
      alert("You cannot vote on this bet because you have money at stake or created it. Only neutral observers can vote.");
      return;
    }

    if (!meetsMinimumTrustScore) {
      alert(`Your trust score (${Math.round(userTrustScore?.overall_score || 0)}) is below the minimum required (${bet.minimum_trust_score}) for this bet.`);
      return;
    }

    if (hasVoted) {
      alert("You have already voted on this bet.");
      return;
    }
    
    setIsVoting(true);
    try {
      await onVote(choice);
      if (walletAddress) {
        // Trust score is now calculated with a cache to prevent rate limits
        loadUserTrustScore();
      }
    } catch (error) {
      console.error("Error voting:", error);
    }
    setIsVoting(false);
  };

  // Show expired/ended message if no actions are possible
  if (!canAcceptBets && !canAcceptVotes) {
    const getEndReason = () => {
      if (bet.status === 'completed') return 'Betting Complete';
      if (bet.status === 'cancelled') return 'Bet Cancelled';
      if (bet.status === 'betting_closed') return 'Betting Closed - Awaiting Proof';
      if (votingPeriodOver) return 'Voting Period Ended';
      if (bettingPeriodOver && bet.status === 'open_for_bets') return 'Betting Period Ended';
      return 'Bet No Longer Active';
    };

    const getEndDescription = () => {
      if (bet.status === 'completed') return `Winner: ${bet.winning_side?.toUpperCase() || 'TBD'}`;
      if (bet.status === 'cancelled') return 'Minimum requirements not met or deadline missed. Stakes will be refunded.';
      if (bet.status === 'betting_closed') return 'The creator must submit proof before the public voting phase can begin.';
      if (votingPeriodOver) return 'The voting period has now finished. Results will be processed shortly.';
      if (bettingPeriodOver && bet.status === 'open_for_bets') return 'The betting window has closed. The bet will be updated shortly.';
      return 'No more interactions are allowed on this bet.';
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
              {votingPeriodOver && votingDeadline && (
                <p className="text-xs text-gray-400 mt-1">
                  Voting ended {formatDistanceToNow(votingDeadline, { addSuffix: true })}
                </p>
              )}
              {bettingPeriodOver && !votingPeriodOver && bettingDeadline && (
                <p className="text-xs text-gray-400 mt-1">
                  Betting ended {formatDistanceToNow(bettingDeadline, { addSuffix: true })}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (canAcceptBets) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-cyan-400" />
            Place Your Bet
          </CardTitle>
          <p className="text-gray-400 text-sm">
            Both sides need minimum stakes to activate
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
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
                    ${yesStakeUsd.toFixed(2)} / ${bet.minimum_side_stake?.toFixed(2)} USDC
                  </span>
                </div>
                <Progress 
                  value={(yesStakeUsd / (bet.minimum_side_stake || 1)) * 100} 
                  className="h-2 bg-gray-700"
                />
                {!yesMetMinimum && (
                  <p className="text-xs text-gray-400">
                    Need ${(bet.minimum_side_stake - yesStakeUsd).toFixed(2)} more USDC
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-red-400">NO Side</span>
                  <span className={`font-medium ${noMetMinimum ? 'text-green-400' : 'text-yellow-400'}`}>
                    ${noStakeUsd.toFixed(2)} / ${bet.minimum_side_stake?.toFixed(2)} USDC
                  </span>
                </div>
                <Progress 
                  value={(noStakeUsd / (bet.minimum_side_stake || 1)) * 100} 
                  className="h-2 bg-gray-700"
                />
                {!noMetMinimum && (
                  <p className="text-xs text-gray-400">
                    Need ${(bet.minimum_side_stake - noStakeUsd).toFixed(2)} more USDC
                  </p>
                )}
              </div>
            </div>

            {/* Overall Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total Stakes</span>
                <span className={`font-medium ${bothSidesReady ? 'text-green-400' : 'text-yellow-400'}`}>
                  ${totalStakeUsd.toFixed(2)} / ${bet.minimum_total_stake?.toFixed(2)} USDC
                </span>
              </div>
              <Progress 
                value={(totalStakeUsd / (bet.minimum_total_stake || 1)) * 100} 
                className="h-2 bg-gray-700"
              />
              {!bothSidesReady && (
                <div className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded p-2">
                  ⚠️ Both YES and NO sides must reach minimum stakes before bet can proceed
                </div>
              )}
            </div>
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
            onClick={handlePlaceBet} 
            disabled={isPlacingBet || (walletConnected && (betAmount < (bet.minimum_bet_amount || 0.01) || !meetsMinimumTrustScore))}
            className="w-full bg-gradient-to-r from-cyan-600 to-purple-700 hover:from-cyan-700 hover:to-purple-800 text-white font-bold py-3"
          >
            {!walletConnected ? (
              <>
                <Wallet className="w-5 h-5 mr-2" />
                Connect Wallet to Bet
              </>
            ) : !meetsMinimumTrustScore && (bet.minimum_trust_score || 0) > 0 ? (
              `Trust Score Too Low (${Math.round(userTrustScore?.overall_score || 0)}/${bet.minimum_trust_score || 0})`
            ) : isPlacingBet ? 'Placing Bet...' : `Bet $${(betAmount || 0).toFixed(2)} USDC on ${selectedSide.toUpperCase()}`}
          </Button>
          
          <div className="text-xs text-gray-400 bg-yellow-500/10 border border-yellow-500/20 rounded p-2">
            ⚠️ Note: Once you bet, you cannot vote on the outcome. Only neutral observers can vote.
          </div>
        </CardContent>
      </Card>
    );
  }

  if (canAcceptVotes) {
    const totalVotes = votes?.length || 0;
    const minimumVotes = bet.minimum_votes || 3;
    const votesNeeded = Math.max(0, minimumVotes - totalVotes);
    const timeUntilDeadline = votingDeadline && votingDeadline > now ? 
      formatDistanceToNow(votingDeadline, { addSuffix: true }) : 
      "Deadline passed";

    // Calculate voting incentives with staking
    const voteStakeAmount = appSettings.vote_stake_amount_proof || 10; // Use appSettings
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
            Stake {voteStakeAmount} PROOF to vote • Honest voters get stake back + share of rewards
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
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

          {/* Voting Progress with Deadline Warning */}
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

          <div className="space-y-2">
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
                        onClick={() => handleVoteClick('yes')} 
                        disabled={isVoting || !walletConnected || !meetsMinimumTrustScore}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-6 text-lg flex flex-col gap-1"
                      >
                        {!walletConnected ? (
                          <>
                            <Wallet className="w-4 h-4" />
                            <span className="text-sm">Connect</span>
                          </>
                        ) : (
                          <>
                            <span>Vote YES</span>
                            <span className="text-xs opacity-80">{voteStakeAmount} PROOF</span>
                          </>
                        )}
                      </Button>
                      <Button 
                        onClick={() => handleVoteClick('no')} 
                        disabled={isVoting || !walletConnected || !meetsMinimumTrustScore}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-6 text-lg flex flex-col gap-1"
                      >
                        {!walletConnected ? (
                          <>
                            <Wallet className="w-4 h-4" />
                            <span className="text-sm">Connect</span>
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
            Winner determined by staked votes • Honest voters earn rewards • {timeUntilDeadline}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Fallback - should not be reached
  return null;
}
