
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, Clock, CheckCircle, Info, Vote, XCircle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

export default function BetStats({ bet, votes = [] }) {
  const totalStake = (bet.total_yes_stake_usd || 0) + (bet.total_no_stake_usd || 0);
  const minimumVotes = bet.minimum_votes || 3;

  // Use the participant and voter counts from the bet object (now refreshed from blockchain)
  const participantCount = bet.participants_count || 0;
  const voterCount = bet.voters_count || 0;

  const DeadlineInfo = () => {
    switch (bet.effectiveStatus) {
      case 'open_for_bets':
        return (
          <div className="flex items-center justify-between text-gray-300">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Betting Ends</span>
            </div>
            <span className="font-semibold text-sm">
              {bet.bettingDeadline ? formatDistanceToNow(new Date(bet.bettingDeadline * 1000), { addSuffix: true }) : 'N/A'}
            </span>
          </div>
        );
      case 'betting_closed':
      case 'awaiting_cancellation_no_proof':
        return (
          <div className="flex items-center justify-between text-gray-300">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-400" />
              <span>Proof Deadline</span>
            </div>
            <span className="font-semibold text-sm">
              {bet.proofDeadline ? formatDistanceToNow(new Date(bet.proofDeadline * 1000), { addSuffix: true }) : 'N/A'}
            </span>
          </div>
        );
      case 'voting':
      case 'awaiting_resolution':
        return (
          <div className="flex items-center justify-between text-gray-300">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-400" />
              <span>Voting Ends</span>
            </div>
            <span className="font-semibold text-sm">
              {bet.votingDeadline ? formatDistanceToNow(new Date(bet.votingDeadline * 1000), { addSuffix: true }) : 'N/A'}
            </span>
          </div>
        );
      case 'completed':
        return (
          <div className="flex items-center justify-between text-gray-300">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span>Resolved</span>
            </div>
            <span className="font-semibold text-sm">
               {/* No on-chain resolution date, so we leave this static */}
               Awaiting claims
            </span>
          </div>
        );
      case 'cancelled':
        return (
          <div className="flex items-center justify-between text-gray-300">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-400" />
              <span>Cancelled</span>
            </div>
             <span className="font-semibold text-sm">
               Awaiting refunds
            </span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white">Market Data</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-gray-300">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-purple-400" />
            <span>Total Stakes</span>
          </div>
          <span className="font-semibold">${totalStake.toFixed(2)}</span>
        </div>
        <div className="flex items-center justify-between text-gray-300">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-400" />
            <span>Participants</span>
          </div>
          <span className="font-semibold">{participantCount}</span>
        </div>
        
        <div className="flex items-center justify-between text-gray-300">
          <div className="flex items-center gap-2">
            <Vote className="w-4 h-4 text-orange-400" />
            <span>Voters</span>
          </div>
          <span className="font-semibold">{voterCount}</span>
        </div>
        
        {bet.effectiveStatus === 'voting' && (
          <>
            <div className="flex items-center justify-between text-gray-300">
              <div className="flex items-center gap-2">
                <Vote className="w-4 h-4 text-green-400" />
                <span>Votes Needed</span>
              </div>
              <span className={`font-semibold ${voterCount >= minimumVotes ? 'text-green-400' : 'text-yellow-400'}`}>
                {voterCount} / {minimumVotes}
              </span>
            </div>
          </>
        )}
        
        <DeadlineInfo />
        
        {voterCount < minimumVotes && bet.effectiveStatus === 'voting' && (
          <div className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded p-2">
            ⚠️ Need {minimumVotes - voterCount} more votes to resolve this bet
          </div>
        )}
        <div className="text-xs text-gray-400 bg-blue-500/10 border border-blue-500/20 rounded p-2">
          ℹ️ Only people without financial stake can vote on outcome
        </div>
      </CardContent>
    </Card>
  );
}
