
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Clock, Users, DollarSign, ArrowRight } from "lucide-react";
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

export default function BetRow({ bet }) {
  const navigate = useNavigate();

  if (!bet || !bet.id) {
    return null;
  }
  
  const totalStake = (bet.total_yes_stake_usd || 0) + (bet.total_no_stake_usd || 0);

  const timeUntilDeadline = () => {
    const deadline = bet.status === 'open_for_bets' ? bet.betting_deadline : (bet.status === 'voting' ? bet.voting_deadline : null);
    if (!deadline) return "Concluded";
    const deadlineDate = new Date(deadline);
    if (deadlineDate < new Date()) return "Deadline Passed";
    return formatDistanceToNow(deadlineDate, { addSuffix: true });
  };
  
  const handleActionClick = () => {
    try {
      navigate(createPageUrl(`BetDetails?id=${bet.id}`));
    } catch (error) {
      console.error("Error navigating to bet details:", error);
      window.location.reload();
    }
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 hover:bg-gray-700/50 hover:border-gray-600 transition-all duration-200">
      <div className="flex-1 min-w-0 w-full">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Badge className={categoryColors[bet.category] || categoryColors.other}>{bet.category}</Badge>
          <Badge className={statusColors[bet.status] || statusColors.open_for_bets}>{bet.status.replace(/_/g, ' ')}</Badge>
        </div>
        <h3 className="text-white font-semibold text-lg truncate" title={bet.title}>
          {bet.title}
        </h3>
      </div>

      <div className="flex-shrink-0 flex items-center gap-6 text-sm text-gray-400 w-full md:w-auto justify-between">
        <div className="flex items-center gap-2" title="Total Staked">
          <DollarSign className="w-4 h-4 text-purple-400" />
          <span>${(totalStake || 0).toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-2" title="Participants">
          <Users className="w-4 h-4 text-cyan-400" />
          <span>{bet.participants_count || 0}</span>
        </div>
        <div className="flex items-center gap-2" title="Time Remaining">
          <Clock className="w-4 h-4 text-yellow-400" />
          <span className="text-xs capitalize">{timeUntilDeadline()}</span>
        </div>
      </div>

      <div className="flex-shrink-0 w-full md:w-auto">
        <Button 
          onClick={handleActionClick}
          variant="outline"
          className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white w-full"
        >
          View Bet <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
