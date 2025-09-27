import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Calendar, TrendingUp, TrendingDown, CheckCircle, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const STATUS_MAP = ["Open", "Voting", "Resolved", "Cancelled"];

export default function BetRow({ bet, walletAddress }) {
  const statusName = STATUS_MAP[bet.status] || "Unknown";

  const getStatusColor = () => {
    switch (statusName) {
      case "Open":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "Voting":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "Resolved":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300";
      case "Cancelled":
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  const getPositionColor = (position) => {
    if (position === 'yes') {
      return "text-green-400";
    } else if (position === 'no') {
      return "text-red-400";
    }
    return "text-gray-400";
  };

  const getPositionIcon = (position) => {
    if (position === 'yes') {
      return <TrendingUp className="w-4 h-4" />;
    } else if (position === 'no') {
      return <TrendingDown className="w-4 h-4" />;
    }
    return null;
  };

  const isCreator = bet.creator.toLowerCase() === walletAddress.toLowerCase();
  const creationDate = new Date(Number(bet.creationTimestamp) * 1000);
  const timeAgo = formatDistanceToNow(creationDate, { addSuffix: true });

  return (
    <Card className="bg-gray-800 border-gray-700 hover:bg-gray-750 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor()}>{statusName}</Badge>
            {isCreator && (
              <Badge variant="outline" className="border-cyan-500 text-cyan-400">
                Creator
              </Badge>
            )}
          </div>
          <span className="text-xs text-gray-400">{timeAgo}</span>
        </div>
        <CardTitle className="text-white text-lg leading-tight">{bet.title}</CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-1">YES Stakes</p>
            <p className="text-sm font-bold text-green-400">
              ${bet.totalYesStake} USDC
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400 mb-1">NO Stakes</p>
            <p className="text-sm font-bold text-red-400">
              ${bet.totalNoStake} USDC
            </p>
          </div>
        </div>

        {/* User's position (if they have one) */}
        {bet.userStake && bet.userStake > 0 && (
          <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg border border-gray-600">
            <span className="text-gray-300 text-sm">Your Position:</span>
            <div className={`flex items-center gap-2 font-bold text-sm ${getPositionColor(bet.userPosition)}`}>
              {getPositionIcon(bet.userPosition)}
              <span className="uppercase">{bet.userPosition}</span>
              <span className="text-gray-400">•</span>
              <span>${bet.userStake} USDC</span>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Link to={createPageUrl(`BetDetails?address=${bet.address}`)}>
            <Button variant="outline" size="sm" className="border-gray-600 hover:bg-gray-700 text-gray-300">
              View Details
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}