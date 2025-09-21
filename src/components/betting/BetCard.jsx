
import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Clock, Users, DollarSign, Video, Camera, Image } from "lucide-react";
import TrustScoreDisplay from "../trust/TrustScoreDisplay";
import { formatDistanceToNow } from 'date-fns';

const categoryColors = {
  sports: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  politics: "bg-red-500/20 text-red-400 border-red-500/30",
  entertainment: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  crypto: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  personal: "bg-green-500/20 text-green-400 border-green-500/30",
  other: "bg-gray-500/20 text-gray-400 border-gray-500/30"
};

const statusColors = {
  open_for_bets: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  betting_closed: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  proof_submitted: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  voting: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  completed: "bg-green-500/20 text-green-400 border-green-500/30",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30"
};

const proofIcons = {
  video: Video,
  live_stream: Camera,
  photo: Image
};

export default function BetCard({ bet, walletConnected, onRequestWalletConnect, userTrustScore }) {
  const navigate = useNavigate();

  // Add safety check to prevent rendering cards with invalid data
  if (!bet || !bet.id) {
    console.warn("BetCard received invalid bet data, not rendering.");
    return null;
  }
  
  const totalStake = (bet.total_yes_stake_usd || 0) + (bet.total_no_stake_usd || 0);
  const yesPercentage = totalStake > 0 ? ((bet.total_yes_stake_usd || 0) / totalStake) * 100 : 50;
  const ProofIcon = proofIcons[bet.proof_type] || Video;

  const isBettingOrVoting = bet.status === 'open_for_bets' || bet.status === 'voting';
  
  // Refined logic for meetsMinimumTrustScore
  const meetsMinimumTrustScore = 
    !walletConnected || 
    (bet.minimum_trust_score === undefined || bet.minimum_trust_score === null || bet.minimum_trust_score === 0) || 
    (userTrustScore && (userTrustScore.overall_score || 0) >= (bet.minimum_trust_score || 0));

  const timeUntilDeadline = () => {
    const deadline = bet.status === 'open_for_bets' ? bet.betting_deadline : bet.voting_deadline;
    if (!deadline) return "No deadline";
    const deadlineDate = new Date(deadline);
    if (deadlineDate < new Date()) return "Deadline passed";
    return formatDistanceToNow(deadlineDate, { addSuffix: true });
  };
  
  const getButtonText = () => {
    if (bet.status === 'open_for_bets' && new Date(bet.betting_deadline) < new Date()) {
        return 'Deadline Passed';
    }
    switch(bet.status) {
      case 'open_for_bets': return 'Place Bet';
      case 'voting': return 'Cast Vote';
      case 'completed': return 'View Results';
      default: return 'View Details';
    }
  };

  const handleActionClick = () => {
    const actionRequired = isBettingOrVoting;
    
    if (actionRequired && !walletConnected) {
      onRequestWalletConnect();
    } else {
      // Add error handling for navigation to prevent crashes from missing bets
      try {
        navigate(createPageUrl(`BetDetails?id=${bet.id}`));
      } catch (error) {
        console.error("Error navigating to bet details:", error);
        // Fallback: try to reload the current page to refresh data
        window.location.reload();
      }
    }
  };

  return (
    <Card className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-all duration-200 group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={categoryColors[bet.category] || categoryColors.other}>
              {bet.category}
            </Badge>
            <Badge className={statusColors[bet.status] || statusColors.open_for_bets}>
              {bet.status.replace(/_/g, ' ')}
            </Badge>
            {(bet.minimum_trust_score || 0) > 0 && (
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                Trust: {bet.minimum_trust_score || 0}+
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 text-gray-400">
            <ProofIcon className="w-4 h-4" />
            <span className="text-xs">{bet.proof_type?.replace('_', ' ')}</span>
          </div>
        </div>
        
        <h3 className="text-white font-semibold text-lg leading-tight group-hover:text-cyan-400 transition-colors">
          {bet.title}
        </h3>
        
        <p className="text-gray-400 text-sm line-clamp-2">
          {bet.description}
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Trust Score Requirement Display */}
        {walletConnected && (bet.minimum_trust_score || 0) > 0 && userTrustScore !== null && (
          <div className="flex items-center justify-between text-xs p-2 bg-gray-700/50 rounded">
            <span className="text-gray-400">Your Trust Score:</span>
            <div className="flex items-center gap-2">
              <TrustScoreDisplay score={userTrustScore.overall_score || 0} compact={true} />
              <span className={`font-medium ${meetsMinimumTrustScore ? 'text-green-400' : 'text-red-400'}`}>
                {meetsMinimumTrustScore ? '✓ Eligible' : '✗ Too Low'}
              </span>
            </div>
          </div>
        )}

        {/* Stakes Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-green-400">YES (${(bet.total_yes_stake_usd || 0).toFixed(2)})</span>
            <span className="text-red-400">NO (${(bet.total_no_stake_usd || 0).toFixed(2)})</span>
          </div>
          <Progress 
            value={yesPercentage} 
            className="h-2 bg-gray-700"
          />
          <div className="flex justify-between text-xs text-gray-500">
            <span>{(yesPercentage || 0).toFixed(1)}%</span>
            <span>{(100 - (yesPercentage || 0)).toFixed(1)}%</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-sm text-gray-400">
          <div className="flex items-center gap-1">
            <DollarSign className="w-4 h-4" />
            <span>${(totalStake || 0).toFixed(2)} total</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>{bet.participants_count || 0} participants</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs capitalize">{timeUntilDeadline()}</span>
          </div>
        </div>

        {/* Action Button */}
        <Button 
          onClick={handleActionClick}
          disabled={(walletConnected && !meetsMinimumTrustScore && isBettingOrVoting) || (bet.status === 'open_for_bets' && new Date(bet.betting_deadline) < new Date())}
          className="w-full bg-gradient-to-r from-cyan-600 to-purple-700 hover:from-cyan-700 hover:to-purple-800 border border-cyan-600/50 hover:border-cyan-600/70 text-white font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          variant="default"
        >
          {walletConnected && !meetsMinimumTrustScore && isBettingOrVoting
            ? `Trust Score Too Low (${Math.round((userTrustScore?.overall_score || 0))}/${bet.minimum_trust_score || 0})`
            : getButtonText()
          }
        </Button>
      </CardContent>
    </Card>
  );
}
