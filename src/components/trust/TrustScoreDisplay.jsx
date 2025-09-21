import React from "react";
import { Badge } from "@/components/ui/badge";
import { Shield, TrendingUp, Users, CheckCircle } from "lucide-react";

const getTrustScoreBadge = (score) => {
  if (score >= 80) return { color: "bg-green-500/20 text-green-400 border-green-500/30", label: "Highly Trusted", icon: Shield };
  if (score >= 60) return { color: "bg-blue-500/20 text-blue-400 border-blue-500/30", label: "Trusted", icon: CheckCircle };
  if (score >= 40) return { color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", label: "Building Trust", icon: TrendingUp };
  if (score >= 20) return { color: "bg-orange-500/20 text-orange-400 border-orange-500/30", label: "New User", icon: Users };
  return { color: "bg-red-500/20 text-red-400 border-red-500/30", label: "Unverified", icon: Users };
};

export default function TrustScoreDisplay({ score, showDetails = false, compact = false }) {
  const { color, label, icon: Icon } = getTrustScoreBadge(score);

  if (compact) {
    return (
      <Badge className={`${color} text-xs`}>
        <Icon className="w-3 h-3 mr-1" />
        {Math.round(score)}
      </Badge>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge className={color}>
        <Icon className="w-3 h-3 mr-1" />
        {label}
      </Badge>
      <span className="text-sm text-gray-400">({Math.round(score)}/100)</span>
      {showDetails && (
        <span className="text-xs text-gray-500">
          Trust Score
        </span>
      )}
    </div>
  );
}