
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, Clock, CheckCircle, Info, Vote, XCircle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

export default function BetStats({ bet, votes = [] }) {
  const totalStake = (bet.total_yes_stake_usd || 0) + (bet.total_no_stake_usd || 0);
  const minimumVotes = bet.minimum_votes || 3;

  // Use the voter count from the blockchain instead of the votes array length
  const blockchainVoterCount = bet.voters_count || 0;

  const DeadlineInfo = () => {
    switch (bet.status) {
      case 'open_for_bets':
        return (
          <div className="flex items-center justify-between text-gray-300">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>Betting Ends</span>
            </div>
            <span className="font-semibold text-sm">
              {bet.betting_deadline ? formatDistanceToNow(new Date(bet.betting_deadline), { addSuffix: true }) : 'N/A'}
            </span>
          </div>
        );
      case 'betting_closed':
      case 'proof_submitted':
        return (
          <div className="flex items-center justify-between text-gray-300">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-400" />
              <span>Proof Deadline</span>
            </div>
            <span className="font-semibold text-sm">
              {bet.proof_deadline ? formatDistanceToNow(new Date(bet.proof_deadline), { addSuffix: true }) : 'N/A'}
            </span>
          </div>
        );
      case 'voting':
        return (
          <div className="flex items-center justify-between text-gray-300">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-400" />
              <span>Voting Ends</span>
            </div>
            <span className="font-semibold text-sm">
              {bet.voting_deadline ? formatDistanceToNow(new Date(bet.voting_deadline), { addSuffix: true }) : 'N/A'}
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
              {format(new Date(bet.updated_date), 'MMM d, yyyy')}
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
              {format(new Date(bet.updated_date), 'MMM d, yyyy')}
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
          <span className="font-semibold">{bet.participants_count || 0}</span>
        </div>
        
        {/* NEW: Show voter count from blockchain */}
        <div className="flex items-center justify-between text-gray-300">
          <div className="flex items-center gap-2">
            <Vote className="w-4 h-4 text-orange-400" />
            <span>Voters</span>
          </div>
          <span className="font-semibold">{blockchainVoterCount}</span>
        </div>
        
        {bet.status === 'voting' && (
          <>
            <div className="flex items-center justify-between text-gray-300">
              <div className="flex items-center gap-2">
                <Vote className="w-4 h-4 text-green-400" />
                <span>Votes Needed</span>
              </div>
              <span className={`font-semibold ${blockchainVoterCount >= minimumVotes ? 'text-green-400' : 'text-yellow-400'}`}>
                {blockchainVoterCount} / {minimumVotes}
              </span>
            </div>
          </>
        )}
        
        <DeadlineInfo />
        
        {blockchainVoterCount < minimumVotes && bet.status === 'voting' && (
          <div className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded p-2">
            ⚠️ Need {minimumVotes - blockchainVoterCount} more votes to resolve this bet
          </div>
        )}
        <div className="text-xs text-gray-400 bg-blue-500/10 border border-blue-500/20 rounded p-2">
          ℹ️ Only people without financial stake can vote on outcome
        </div>
      </CardContent>
    </Card>
  );
}
