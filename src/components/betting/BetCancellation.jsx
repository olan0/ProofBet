import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, User } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function BetCancellation({ bet, participants }) {
  if (bet.status !== 'cancelled') return null;

  const totalStake = (bet.total_yes_stake || 0) + (bet.total_no_stake || 0);

  const getCancellationReason = () => {
    const yesMet = (bet.total_yes_stake || 0) >= (bet.minimum_side_stake || 0);
    const noMet = (bet.total_no_stake || 0) >= (bet.minimum_side_stake || 0);
    const totalMet = totalStake >= (bet.minimum_total_stake || 0);
    
    const wasInVotingPhase = bet.proof_submitted === true;

    if (wasInVotingPhase) {
      return `The minimum number of ${bet.minimum_votes || 3} public votes was not reached by the voting deadline.`;
    }
    
    if (!yesMet || !noMet) {
      return `The minimum stake of ${bet.minimum_side_stake} ETH was not met on both the YES and NO sides by the betting deadline.`;
    }
    if (!totalMet) {
      return `The minimum total stake of ${bet.minimum_total_stake} ETH was not reached by the betting deadline.`;
    }
    return "The bet did not meet the minimum requirements before the deadline.";
  };

  return (
    <Card className="bg-red-900/20 border-red-500/30">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-400" />
          Bet Cancelled & Stakes Refundable
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 bg-red-900/30 rounded-lg">
          <h3 className="font-semibold text-red-200 mb-2">Reason for Cancellation</h3>
          <p className="text-red-300">{getCancellationReason()}</p>
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-cyan-400" />
            Stake Refunds Issued
          </h3>
          <p className="text-sm text-gray-400">
            All participants can now claim a full refund of their original stake from the "My Rewards" tab.
          </p>
          <Link to={createPageUrl("Dashboard", {tab: "my-rewards"})}>
            <Button variant="outline" className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10">
              Go to My Claims
            </Button>
          </Link>
        </div>

        <div className="text-xs text-gray-400 bg-blue-500/10 border border-blue-500/20 rounded p-3">
          💰 To protect users, stakes from cancelled bets are made available for you to claim back. This ensures your funds are safe when a bet does not proceed.
        </div>
      </CardContent>
    </Card>
  );
}