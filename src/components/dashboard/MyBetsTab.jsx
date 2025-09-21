
import React, { useState, useEffect, useCallback } from "react";
import { Bet } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { TrendingUp, DollarSign, Users } from "lucide-react";
import { format } from "date-fns";

export default function MyBetsTab({ walletAddress }) {
  const [myBets, setMyBets] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadMyBets = useCallback(async () => {
    if (!walletAddress) {
      setMyBets([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      // Use the provided wallet address to filter bets
      const allBets = await Bet.list("-created_date");
      const filtered = allBets.filter(bet => bet.creator_address === walletAddress);
      setMyBets(filtered);
    } catch (error) {
      console.error("Error loading my bets:", error);
    }
    setLoading(false);
  }, [walletAddress]);

  useEffect(() => {
    loadMyBets();
  }, [loadMyBets]);

  const getBetsByStatus = (status) => {
    return myBets.filter(bet => bet.status === status);
  };
  
  const getTotalStakedOnMyBets = () => {
    return myBets.reduce((sum, bet) => sum + (bet.total_yes_stake_usd || 0) + (bet.total_no_stake_usd || 0), 0);
  }

  return (
    <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-white border-gray-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-500">Total Created</CardTitle>
                <TrendingUp className="w-4 h-4 text-cyan-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-cyan-700">{myBets.length}</div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-500">Total Staked</CardTitle>
                <DollarSign className="w-4 h-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-700">
                ${getTotalStakedOnMyBets().toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-gray-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-500">Participants</CardTitle>
                <Users className="w-4 h-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-700">
                {myBets.reduce((sum, bet) => sum + (bet.participants_count || 0), 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="bg-gray-100">
            <TabsTrigger value="all">All ({myBets.length})</TabsTrigger>
            <TabsTrigger value="open_for_bets">Open ({getBetsByStatus('open_for_bets').length})</TabsTrigger>
            <TabsTrigger value="voting">Voting ({getBetsByStatus('voting').length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({getBetsByStatus('completed').length})</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {loading ? <LoadingSkeleton /> : <BetList bets={myBets} />}
          </TabsContent>

          {['open_for_bets', 'voting', 'completed'].map(status => (
            <TabsContent key={status} value={status}>
              {getBetsByStatus(status).length > 0 ? (
                <BetList bets={getBetsByStatus(status)} />
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-400">No {status.replace(/_/g, ' ')} bets found</p>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
    </div>
  );
}

const LoadingSkeleton = () => (
    <div className="space-y-4">
      {Array(3).fill(0).map((_, i) => (
        <Card key={i} className="bg-gray-800 border-gray-700 animate-pulse">
          <CardContent className="p-6">
            <div className="h-4 bg-gray-700 rounded mb-2 w-1/2"></div>
            <div className="h-3 bg-gray-700 rounded w-1/3"></div>
          </CardContent>
        </Card>
      ))}
    </div>
);

const BetList = ({ bets }) => (
    <div className="space-y-4">
        {bets.map((bet) => (
          <Card key={bet.id} className="bg-gray-800 border-gray-700 hover:border-gray-600 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 capitalize">
                      {bet.category}
                    </Badge>
                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 capitalize">
                      {bet.status.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <h3 className="text-white font-semibold text-lg mb-2">{bet.title}</h3>
                  <div className="flex items-center gap-6 text-sm text-gray-400">
                    <div>Stake: ${((bet.total_yes_stake_usd || 0) + (bet.total_no_stake_usd || 0)).toFixed(2)}</div>
                    <div>Participants: {bet.participants_count || 0}</div>
                    <div>Created: {format(new Date(bet.created_date), 'MMM d, yyyy')}</div>
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
