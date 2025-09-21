
import React, { useState, useEffect } from "react";
import { Bet } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Trophy, XCircle, DollarSign, Users, Clock, TrendingUp } from "lucide-react";
import { format } from "date-fns";

export default function HistoryTab() {
  const [historicalBets, setHistoricalBets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistoricalBets();
  }, []);

  const loadHistoricalBets = async () => {
    setLoading(true);
    try {
      const allBets = await Bet.list("-updated_date");
      const historical = allBets.filter(bet => 
        bet.status === 'completed' || bet.status === 'cancelled'
      );
      setHistoricalBets(historical);
    } catch (error) {
      console.error("Error loading historical bets:", error);
    }
    setLoading(false);
  };

  const completedBets = historicalBets.filter(bet => bet.status === 'completed');
  const cancelledBets = historicalBets.filter(bet => bet.status === 'cancelled');

  const getTotalVolume = (bets) => {
    return bets.reduce((sum, bet) => sum + (bet.total_yes_stake_usd || 0) + (bet.total_no_stake_usd || 0), 0);
  };

  return (
    <div className="space-y-8">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-300">Total Historical</CardTitle>
              <TrendingUp className="w-4 h-4 text-cyan-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{historicalBets.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-300">Completed</CardTitle>
              <Trophy className="w-4 h-4 text-green-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400">{completedBets.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-300">Cancelled</CardTitle>
              <XCircle className="w-4 h-4 text-red-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-400">{cancelledBets.length}</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-300">Total Volume</CardTitle>
              <DollarSign className="w-4 h-4 text-purple-400" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-400">
              ${getTotalVolume(historicalBets).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Historical Bets Tabs */}
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList className="bg-gray-800 border border-gray-700">
          <TabsTrigger value="all">All History ({historicalBets.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedBets.length})</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled ({cancelledBets.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {loading ? <LoadingSkeleton /> : <BetHistoryList bets={historicalBets} />}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {completedBets.length > 0 ? (
            <BetHistoryList bets={completedBets} />
          ) : (
            <div className="text-center py-12">
              <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No completed bets found</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="cancelled" className="space-y-4">
          {cancelledBets.length > 0 ? (
            <BetHistoryList bets={cancelledBets} />
          ) : (
            <div className="text-center py-12">
              <XCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No cancelled bets found</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

const LoadingSkeleton = () => (
  <div className="space-y-4">
    {Array(5).fill(0).map((_, i) => (
      <Card key={i} className="bg-gray-800 border-gray-700 animate-pulse">
        <CardContent className="p-6">
          <div className="h-4 bg-gray-700 rounded mb-2 w-3/4"></div>
          <div className="h-3 bg-gray-700 rounded w-1/2"></div>
        </CardContent>
      </Card>
    ))}
  </div>
);

const BetHistoryList = ({ bets }) => (
  <div className="space-y-4">
    {bets.map((bet) => (
      <Card key={bet.id} className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-colors">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <Badge className={
                  bet.category === 'sports' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                  bet.category === 'crypto' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                  bet.category === 'politics' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                  bet.category === 'entertainment' ? 'bg-pink-500/20 text-pink-400 border-pink-500/30' :
                  bet.category === 'personal' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                  'bg-gray-500/20 text-gray-400 border-gray-500/30'
                }>
                  {bet.category}
                </Badge>
                
                <Badge className={
                  bet.status === 'completed' 
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : 'bg-red-500/20 text-red-400 border-red-500/30'
                }>
                  <div className="flex items-center gap-1">
                    {bet.status === 'completed' ? <Trophy className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {bet.status === 'completed' ? 'Completed' : 'Cancelled'}
                  </div>
                </Badge>

                {bet.status === 'completed' && bet.winning_side && (
                  <Badge className={
                    bet.winning_side === 'yes' 
                      ? 'bg-green-600/30 text-green-300 border-green-600/50'
                      : 'bg-red-600/30 text-red-300 border-red-600/50'
                  }>
                    Winner: {bet.winning_side.toUpperCase()}
                  </Badge>
                )}
              </div>

              <h3 className="text-white font-semibold text-lg mb-2 line-clamp-2">{bet.title}</h3>
              <p className="text-gray-400 text-sm mb-4 line-clamp-2">{bet.description}</p>

              <div className="flex items-center gap-6 text-sm text-gray-400">
                <div className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  <span>${((bet.total_yes_stake_usd || 0) + (bet.total_no_stake_usd || 0)).toFixed(2)} volume</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{bet.participants_count || 0} participants</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>Ended {format(new Date(bet.updated_date), 'MMM d, yyyy')}</span>
                </div>
              </div>
            </div>

            <Link to={createPageUrl(`BetDetails?id=${bet.id}`)}>
              <Button variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
                View Details
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);
