import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, User, Vote } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function BetCancellation({ bet, participants }) {
  if (bet.status !== 'cancelled') return null;

  const getCancellationReason = () => {
    // Check if cancellation was due to voting failure
    const votingDeadline = new Date(bet.voting_deadline);
    const now = new Date();
    // A bit of a proxy: if we are past the voting deadline and status is cancelled, it was likely a vote failure
    if (now > votingDeadline && bet.proof_submitted) {
        const minimumVotes = bet.minimum_votes || 3;
        if (bet.voters_count < minimumVotes) {
            return `The minimum of ${minimumVotes} public votes was not reached by the voting deadline.`;
        }
        return `The vote resulted in a tie, so the bet could not be resolved.`;
    }
    
    // Check if cancellation was due to proof failure
    const proofDeadline = new Date(bet.proof_deadline);
    if (now > proofDeadline && !bet.proof_submitted) {
        return `The creator did not submit proof of the outcome before the deadline.`;
    }

    // Default to stake failure
    const minSideStake = bet.minimum_side_stake || 0;
    return `The minimum stake of ${minSideStake} USDC was not met on both the YES and NO sides by the betting deadline.`;
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
            All participants can now claim a full refund of their original stake from their internal wallet on the Dashboard Wallet tab.
          </p>
          <Link to={createPageUrl("Dashboard?tab=wallet")}>
            <Button variant="outline" className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10">
              Go to Wallet
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}