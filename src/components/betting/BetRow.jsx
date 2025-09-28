import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Users, Clock, ArrowRight } from 'lucide-react';
import { formatDistanceToNow } from "date-fns";

const STATUS_MAP = ["Open", "Voting", "Resolved", "Cancelled"];
const CATEGORY_MAP = ["Politics", "Sports", "Tech", "Crypto", "Other"];

const getStatusInfo = (status) => {
  switch (status) {
    case 0: // Open
      return { text: "Open", className: "bg-green-500/20 text-green-300 border-green-500/30" };
    case 1: // Voting
      return { text: "Voting", className: "bg-blue-500/20 text-blue-300 border-blue-500/30" };
    case 2: // Resolved
      return { text: "Resolved", className: "bg-purple-500/20 text-purple-300 border-purple-500/30" };
    case 3: // Cancelled
      return { text: "Cancelled", className: "bg-gray-500/20 text-gray-300 border-gray-500/30" };
    default:
      return { text: "Unknown", className: "bg-gray-500/20 text-gray-300 border-gray-500/30" };
  }
};

export default function BetRow({ bet }) {
  const status = getStatusInfo(bet.status);
  const categoryName = CATEGORY_MAP[bet.category] || "Other";
  const totalStake = parseFloat(bet.totalYesStake) + parseFloat(bet.totalNoStake);
  const creationDate = new Date(Number(bet.creationTimestamp) * 1000);
  const timeAgo = formatDistanceToNow(creationDate, { addSuffix: true });

  return (
    <Card className="bg-gray-800/60 border-gray-700 hover:border-cyan-500/50 transition-colors duration-300">
      <div className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
             <Badge className={status.className}>{status.text}</Badge>
             <Badge variant="outline" className="border-gray-600 text-gray-400">{categoryName}</Badge>
          </div>
          <Link to={createPageUrl(`BetDetails?address=${bet.address}`)} className="group">
             <h3 className="text-lg font-semibold text-white truncate group-hover:text-cyan-400 transition-colors">
              {bet.title}
             </h3>
          </Link>
        </div>

        <div className="flex items-center gap-4 md:gap-6 text-sm text-gray-300 w-full md:w-auto">
          <div className="flex items-center gap-2" title="Total Staked">
            <DollarSign className="w-4 h-4 text-purple-400" />
            <span>${totalStake.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-2" title="Participants">
            <Users className="w-4 h-4 text-cyan-400" />
            <span>{bet.participants_count}</span>
          </div>
          <div className="flex items-center gap-2" title="Created">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="hidden md:inline">{timeAgo}</span>
          </div>
        </div>

        <div className="w-full md:w-auto flex justify-end">
          <Link to={createPageUrl(`BetDetails?address=${bet.address}`)}>
            <Button variant="outline" size="sm" className="border-gray-600 hover:bg-gray-700 hover:text-white">
              View
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </Card>
  );
}