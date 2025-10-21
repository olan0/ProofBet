
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, DollarSign, TrendingUp, Users, CheckCircle, Vote, Building } from "lucide-react";

export default function BetResolution({ bet, participants, votes, appSettings }) {
  // Removed: if (bet.status !== 'completed') return null;

  const totalVotes = votes.length;
  const yesVotes = votes.filter(v => v.vote === 'yes').length;
  const noVotes = votes.filter(v => v.vote === 'no').length;
  const winningVote = yesVotes > noVotes ? 'yes' : 'no';
  
  const totalStake = (bet.total_yes_stake_usd || 0) + (bet.total_no_stake_usd || 0);
  const winningStake = bet.winning_side === 'yes' ? (bet.total_yes_stake_usd || 0) : (bet.total_no_stake_usd || 0);
  const losingStake = bet.winning_side === 'yes' ? (bet.total_no_stake_usd || 0) : (bet.total_yes_stake_usd || 0);
  
  // Calculate distribution percentages
  const voterRewardPct = appSettings?.voter_reward_percentage || 5;
  const platformFeePct = appSettings?.platform_fee_percentage || 3;
  const totalFeePct = voterRewardPct + platformFeePct;
  
  // Calculate amounts
  const voterRewardPool = totalStake * (voterRewardPct / 100);
  const platformFee = totalStake * (platformFeePct / 100);
  const remainingForWinners = totalStake - voterRewardPool - platformFee;
  const voterRewardPerVoter = totalVotes > 0 ? voterRewardPool / totalVotes : 0;
  
  const winners = participants.filter(p => p.position === bet.winning_side);
  const losers = participants.filter(p => p.position !== bet.winning_side);

  const calculatePayout = (participant) => {
    // This function is called for winners only in the rendering logic below.
    // The 'participant.position !== bet.winning_side' part of the condition will therefore never be true.
    // It simplifies to: if (winningStake === 0) return participant.stake_amount_usd;
    // This handles an edge case where no one staked on the winning side, or there's a data anomaly,
    // in which case the winner (if any) gets their original stake back.
    if (participant.position !== bet.winning_side || winningStake === 0) return participant.stake_amount_usd;
    
    // Proportional share of the entire pot (original stake + winnings)
    // This calculates the winner's share of the *gross* total stake (winning + losing sides combined),
    // based on their proportional contribution to the winning side's stake.
    const totalPayout = (participant.stake_amount_usd / winningStake) * (winningStake + losingStake);
    
    // After platform and voter fees
    // This specific formula is provided in the outline.
    // It implies that the `totalPayout` is first reduced by `totalFeePct`,
    // and then a portion of the participant's original stake (equal to the fee percentage) is added back.
    const finalPayout = totalPayout * ((100 - totalFeePct) / 100) + participant.stake_amount_usd * (totalFeePct / 100);
    return finalPayout;
  };

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Bet Results & Payouts
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
            Revenue Distribution (${totalStake.toFixed(2)} USDC Total)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <Vote className="w-6 h-6 text-purple-400 mx-auto mb-2" />
              <div className="text-lg font-bold text-purple-400">${voterRewardPool.toFixed(2)}</div>
              <div className="text-xs text-gray-400">Voter Rewards ({voterRewardPct}%)</div>
              <div className="text-xs text-purple-300">${voterRewardPerVoter.toFixed(4)} per voter</div>
            </div>
            <div className="text-center p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
              <Building className="w-6 h-6 text-orange-400 mx-auto mb-2" />
              <div className="text-lg font-bold text-orange-400">${platformFee.toFixed(2)}</div>
              <div className="text-xs text-gray-400">Platform Fee ({platformFeePct}%)</div>
            </div>
            <div className="text-center p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <Trophy className="w-6 h-6 text-green-400 mx-auto mb-2" />
              <div className="text-lg font-bold text-green-400">${remainingForWinners.toFixed(2)}</div>
              <div className="text-xs text-gray-400">Winner Pool ({(100 - totalFeePct)}%)</div>
            </div>
          </div>
        </div>

        {/* Voter Rewards */}
        <div className="space-y-3">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Vote className="w-4 h-4 text-purple-400" />
            Voter Rewards ({totalVotes} voters)
          </h3>
          {totalVotes > 0 ? (
            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-purple-200">Each voter receives:</span>
                <span className="font-bold text-purple-400">${voterRewardPerVoter.toFixed(4)} USDC</span>
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {votes.map((vote, index) => (
                  <div key={vote.id} className="flex items-center justify-between p-2 bg-gray-800 rounded">
                    <span className="font-mono text-sm text-gray-300">
                      {vote.address.substring(0, 10)}...
                    </span>
                    <div className="text-right">
                      <div className="text-purple-400 font-semibold text-sm">+{voterRewardPerVoter.toFixed(4)} USDC</div>
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
          💰 Payouts are simulated. In a real implementation, smart contracts would automatically distribute all rewards: {voterRewardPct}% to voters, {platformFeePct}% to platform, and {100 - totalFeePct}% to winning bettors.
        </div>
      </CardContent>
    </Card>
  );
}
