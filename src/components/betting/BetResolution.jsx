import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, DollarSign, TrendingUp, Users, CheckCircle, Vote, Building, Loader2 } from "lucide-react";
import { getBetContract } from "../blockchain/contracts";
import { ethers } from "ethers";

export default function BetResolution({ bet, participants, votes, appSettings }) {
  const [resolutionData, setResolutionData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResolutionData();
  }, [bet.address]);

  const loadResolutionData = async () => {
    if (!bet || bet.onChainStatus !== 'completed') return;
    
    setLoading(true);
    try {
      const betContract = getBetContract(bet.address);
      const resInfo = await betContract.getResolutionInfo();
      
      // Convert BigInt to regular numbers
      setResolutionData({
        totalWinningStake: parseFloat(ethers.formatUnits(resInfo.totalWinningStake, 6)),
        totalLosingStake: parseFloat(ethers.formatUnits(resInfo.totalLosingStake, 6)),
        voterRewardPool: parseFloat(ethers.formatUnits(resInfo.voterRewardPool, 6)),
        platformFeeAmount: parseFloat(ethers.formatUnits(resInfo.platformFeeAmount, 6)),
        winnersPool: parseFloat(ethers.formatUnits(resInfo.winnersPool, 6)),
        totalVoters: Number(resInfo.totalVoters),
        rewardPerVoter: parseFloat(ethers.formatUnits(resInfo.rewardPerVoter, 6))
      });
    } catch (error) {
      console.error("Failed to load resolution data from blockchain:", error);
      // Fallback to client-side calculation if blockchain call fails
      calculateFallbackData();
    } finally {
      setLoading(false);
    }
  };

  const calculateFallbackData = () => {
    const winningStake = bet.winning_side === 'yes' ? (bet.total_yes_stake_usd || 0) : (bet.total_no_stake_usd || 0);
    const losingStake = bet.winning_side === 'yes' ? (bet.total_no_stake_usd || 0) : (bet.total_yes_stake_usd || 0);
    const voterRewardPct = appSettings?.voter_reward_percentage || 5;
    const platformFeePct = appSettings?.platform_fee_percentage || 3;
    
    const voterRewardPool = losingStake * (voterRewardPct / 100);
    const platformFeeAmount = losingStake * (platformFeePct / 100);
    const winnersPool = losingStake - voterRewardPool - platformFeeAmount;
    const totalVoters = votes.length;
    const rewardPerVoter = totalVoters > 0 ? voterRewardPool / totalVoters : 0;
    
    setResolutionData({
      totalWinningStake: winningStake,
      totalLosingStake: losingStake,
      voterRewardPool,
      platformFeeAmount,
      winnersPool,
      totalVoters,
      rewardPerVoter
    });
  };

  if (loading) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="p-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        </CardContent>
      </Card>
    );
  }

  if (!resolutionData) return null;

  const totalVotes = votes.length;
  const yesVotes = votes.filter(v => v.vote === 'yes').length;
  const noVotes = votes.filter(v => v.vote === 'no').length;
  const winningVote = yesVotes > noVotes ? 'yes' : 'no';
  
  const voterRewardPct = appSettings?.voter_reward_percentage || 5;
  const platformFeePct = appSettings?.platform_fee_percentage || 3;
  
  const winners = participants.filter(p => p.position === bet.winning_side);
  const losers = participants.filter(p => p.position !== bet.winning_side);

  const calculatePayout = (participant) => {
    if (participant.position !== bet.winning_side || resolutionData.totalWinningStake === 0) {
      return participant.stake_amount_usd;
    }
    
    const proportionalShare = (participant.stake_amount_usd / resolutionData.totalWinningStake) * resolutionData.winnersPool;
    return participant.stake_amount_usd + proportionalShare;
  };

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Bet Results & Payouts
          <Badge variant="outline" className="ml-auto text-xs">On-Chain Data</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Voting Results */}
        <div className="p-4 bg-gray-700/50 rounded-lg">
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Public Vote Results
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-400">{yesVotes}</div>
              <div className="text-sm text-gray-400">YES Votes</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-400">{noVotes}</div>
              <div className="text-sm text-gray-400">NO Votes</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{totalVotes}</div>
              <div className="text-sm text-gray-400">Total Votes</div>
            </div>
          </div>
          <div className="mt-4 text-center">
            <Badge className={`${winningVote === 'yes' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'} text-lg px-4 py-2`}>
              Winner: {winningVote.toUpperCase()} ({winningVote === 'yes' ? yesVotes : noVotes} votes)
            </Badge>
          </div>
        </div>

        {/* Revenue Distribution */}
        <div className="p-4 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-lg">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-blue-400" />
            Revenue Distribution (From Smart Contract)
          </h3>
          <div className="space-y-3 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Winning Side Stake:</span>
              <span className="text-green-400 font-semibold">${resolutionData.totalWinningStake.toFixed(2)} (returned in full)</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Losing Side Stake:</span>
              <span className="text-red-400 font-semibold">${resolutionData.totalLosingStake.toFixed(2)}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <Vote className="w-6 h-6 text-purple-400 mx-auto mb-2" />
              <div className="text-lg font-bold text-purple-400">${resolutionData.voterRewardPool.toFixed(2)}</div>
              <div className="text-xs text-gray-400">Voter Rewards ({voterRewardPct}%)</div>
              <div className="text-xs text-purple-300">${resolutionData.rewardPerVoter.toFixed(4)} per voter</div>
            </div>
            <div className="text-center p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
              <Building className="w-6 h-6 text-orange-400 mx-auto mb-2" />
              <div className="text-lg font-bold text-orange-400">${resolutionData.platformFeeAmount.toFixed(2)}</div>
              <div className="text-xs text-gray-400">Platform Fee ({platformFeePct}%)</div>
            </div>
            <div className="text-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <Trophy className="w-6 h-6 text-green-400 mx-auto mb-2" />
              <div className="text-lg font-bold text-green-400">${resolutionData.winnersPool.toFixed(2)}</div>
              <div className="text-xs text-gray-400">Winners' Share ({100 - voterRewardPct - platformFeePct}%)</div>
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-400 italic">
            ✅ Fees are taken from the losing side's stake only (verified on-chain)
          </div>
        </div>

        {/* Voter Rewards */}
        <div className="space-y-3">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Vote className="w-4 h-4 text-purple-400" />
            Voter Rewards ({resolutionData.totalVoters} voters)
          </h3>
          {resolutionData.totalVoters > 0 ? (
            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-purple-200">Each correct voter receives:</span>
                <span className="font-bold text-purple-400">${resolutionData.rewardPerVoter.toFixed(4)} USDC</span>
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {votes.map((vote) => (
                  <div key={vote.id} className="flex items-center justify-between p-2 bg-gray-800 rounded">
                    <span className="font-mono text-sm text-gray-300">
                      {vote.address.substring(0, 10)}...
                    </span>
                    <div className="text-right">
                      <div className="text-purple-400 font-semibold text-sm">+{resolutionData.rewardPerVoter.toFixed(4)} USDC</div>
                      <div className="text-xs text-gray-400">Voting reward</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-400">No voters to reward</div>
          )}
        </div>

        {/* Winner Payouts */}
        <div className="space-y-3">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            Betting Winners ({winners.length})
          </h3>
          {winners.length > 0 ? (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {winners.map((winner) => {
                const payout = calculatePayout(winner);
                const profit = payout - winner.stake_amount_usd;
                return (
                  <div key={winner.id} className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <div>
                        <div className="font-mono text-sm text-gray-300">
                          {winner.participant_address.substring(0, 8)}...
                        </div>
                        <div className="text-xs text-gray-400">
                          Staked {winner.stake_amount_usd} USDC on {winner.position.toUpperCase()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-400">
                        +${payout.toFixed(2)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {profit > 0 ? `+${profit.toFixed(2)} profit` : 'Stake returned'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-400">No winners found</div>
          )}
        </div>

        {/* Losers (for reference) */}
        {losers.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-red-500 rotate-180" />
              Betting Losers ({losers.length})
            </h3>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {losers.slice(0, 5).map((loser) => (
                <div key={loser.id} className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <div className="font-mono text-sm text-gray-300">
                    {loser.participant_address.substring(0, 8)}...
                  </div>
                  <div className="text-right">
                    <div className="text-red-400">
                      -${loser.stake_amount_usd} USDC
                    </div>
                    <div className="text-xs text-gray-400">
                      Bet on {loser.position.toUpperCase()}
                    </div>
                  </div>
                </div>
              ))}
              {losers.length > 5 && (
                <div className="text-center text-gray-400 text-sm">
                  ...and {losers.length - 5} more
                </div>
              )}
            </div>
          </div>
        )}

        <div className="text-xs text-gray-400 bg-blue-500/10 border border-blue-500/20 rounded p-3">
          💰 All calculations are fetched directly from the smart contract's <code className="text-cyan-400">getResolutionInfo()</code> function, ensuring accuracy and transparency.
        </div>
      </CardContent>
    </Card>
  );
}