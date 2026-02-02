import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { TrendingUp, Vote, Users, Clock, DollarSign, ShieldCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ethers } from "ethers";

const ACTIVITY_TYPE_MAP = {
  1: { label: "Created Market", icon: Users, color: "text-green-400" },
  2: { label: "Placed Bet", icon: TrendingUp, color: "text-cyan-400" },
  3: { label: "Cast Vote", icon: Vote, color: "text-purple-400" },
};

const ACTOR_ROLE_MAP = {
  1: "Creator",
  2: "Participant", 
  3: "Voter",
};

const SIDE_MAP = {
  1: "YES",
  2: "NO",
  3: "INVALID",
};

export default function ActivityCard({ activity }) {
  const activityType = ACTIVITY_TYPE_MAP[activity.type] || { label: "Activity", icon: Clock, color: "text-gray-400" };
  const Icon = activityType.icon;

  return (
    <Link to={createPageUrl("BetDetails") + `?address=${activity.betId}`}>
      <Card className="bg-gray-800 border-gray-700 hover:border-cyan-500/50 transition-all cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className={`w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center ${activityType.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={`${activityType.color} bg-gray-700/50 border-gray-600 font-semibold text-sm px-3 py-1`}>
                    {activityType.label}
                  </Badge>
                  {activity.currentUserRole && (
                    <Badge variant="secondary" className="bg-gray-700 border-gray-600 text-white font-semibold">
                      {ACTOR_ROLE_MAP[activity.currentUserRole]}
                    </Badge>
                  )}
                </div>
                
                <h3 className="text-white font-semibold mb-1 line-clamp-2">
                  {activity.betTitle}
                </h3>
                
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {activity.timestamp ? formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true }) : 'Recently'}
                  </div>
                  
                  {activity.side && (
                    <Badge variant={activity.side === 1 ? "default" : "destructive"} className="text-xs">
                      {SIDE_MAP[activity.side]}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            <div className="text-right space-y-1">
              {activity.amountUsdc && activity.amountUsdc !== "0" && (
                <div className="flex items-center gap-1 text-green-400">
                  <DollarSign className="w-4 h-4" />
                  <span className="font-mono text-sm">
                    {parseFloat(ethers.formatUnits(activity.amountUsdc, 6)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              
              {activity.amountProof && activity.amountProof !== "0" && (
                <div className="flex items-center gap-1 text-purple-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="font-mono text-sm">
                    {parseFloat(ethers.formatEther(activity.amountProof)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}