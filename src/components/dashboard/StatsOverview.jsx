import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, DollarSign, Users, Clock } from "lucide-react";

export default function StatsOverview({ bets = [], votes = [], tokenStats }) {
  const stats = {
    totalBets: bets.length,
    totalVolume: bets.reduce((sum, bet) => {
      const yesStake = bet?.total_yes_stake_usd || 0;
      const noStake = bet?.total_no_stake_usd || 0;
      return sum + yesStake + noStake;
    }, 0),
    activeBets: bets.filter(bet => bet?.status === 'open_for_bets' || bet?.status === 'voting').length,
    totalParticipants: bets.reduce((sum, bet) => (bet?.participants_count || 0) + sum, 0)
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card className="bg-white border-cyan-500/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-500">Total Markets</CardTitle>
            <TrendingUp className="w-4 h-4 text-cyan-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-cyan-700">{stats.totalBets}</div>
          <p className="text-xs text-gray-500 mt-1">All prediction markets</p>
        </CardContent>
      </Card>

      <Card className="bg-white border-purple-500/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-500">Total Volume</CardTitle>
            <DollarSign className="w-4 h-4 text-purple-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-purple-700">
            ${(stats.totalVolume || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-gray-500 mt-1">Total value locked in markets</p>
        </CardContent>
      </Card>

      <Card className="bg-white border-green-500/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-500">Active Markets</CardTitle>
            <Clock className="w-4 h-4 text-green-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-700">{stats.activeBets}</div>
          <p className="text-xs text-gray-500 mt-1">Open for betting/voting</p>
        </CardContent>
      </Card>

      <Card className="bg-white border-orange-500/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-500">PROOF Supply</CardTitle>
            <Users className="w-4 h-4 text-orange-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-orange-700">
            {tokenStats ? `${((tokenStats.totalSupply || 0) / 1e18).toFixed(0)}M` : stats.totalParticipants}
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {tokenStats ? `${((tokenStats.totalBurned || 0) / 1e18).toFixed(1)}M burned` : 'Community participation'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}