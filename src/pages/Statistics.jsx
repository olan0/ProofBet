import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, Users, DollarSign, Award, Clock, Flame, Activity, BarChart3, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { getBetFactoryContract, getBetContract, getConnectedAddress } from '../components/blockchain/contracts';
import { ethers } from 'ethers';
import AddressDisplay from '../components/common/AddressDisplay';
import moment from 'moment';

const ON_CHAIN_STATUS_MAP = {
  0: "open_for_bets",
  1: "awaiting_proof",
  2: "voting",
  3: "completed",
  4: "cancelled",
};

export default function Statistics() {
  const [loading, setLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState(null);
  const [platformStats, setPlatformStats] = useState({
    totalBets: 0,
    totalVolume: 0,
    totalParticipants: 0,
    activeBets: 0,
    completedBets: 0,
  });
  const [mostActiveBets, setMostActiveBets] = useState([]);
  const [highestVolumeBets, setHighestVolumeBets] = useState([]);
  const [recentBets, setRecentBets] = useState([]);
  const [topCreators, setTopCreators] = useState([]);
  const [userStats, setUserStats] = useState(null);

  useEffect(() => {
    loadStatistics();
    checkWallet();
  }, []);

  const checkWallet = async () => {
    const address = await getConnectedAddress();
    setWalletAddress(address);
  };

  const loadStatistics = async () => {
    setLoading(true);
    try {
      const factory = getBetFactoryContract();
      const betAddresses = await factory.getBets();

      const betPromises = betAddresses.map(async (address) => {
        try {
          const betContract = getBetContract(address);
          const [onChainStatusRaw, info, creatorAddress] = await Promise.all([
            betContract.currentStatus(),
            betContract.getBetInfo(),
            betContract.creator(),
          ]);

          const [
            title,
            description,
            totalYes,
            totalNo,
            bettingDeadline,
            proofDeadline,
            votingDeadline,
            proofUrl,
            participantCount,
            voterCount
          ] = info;

          const onChainStatus = ON_CHAIN_STATUS_MAP[Number(onChainStatusRaw)];

          return {
            address,
            title,
            creator: creatorAddress,
            status: onChainStatus,
            totalVolume: parseFloat(ethers.formatUnits(totalYes, 6)) + parseFloat(ethers.formatUnits(totalNo, 6)),
            participantCount: Number(participantCount),
            voterCount: Number(voterCount),
            totalActivity: Number(participantCount) + Number(voterCount),
            bettingDeadline: Number(bettingDeadline),
          };
        } catch (e) {
          console.error(`Failed to load bet ${address}:`, e);
          return null;
        }
      });

      const bets = (await Promise.all(betPromises)).filter(b => b !== null);

      const totalVolume = bets.reduce((sum, bet) => sum + bet.totalVolume, 0);
      const totalParticipants = bets.reduce((sum, bet) => sum + bet.participantCount, 0);
      const activeBets = bets.filter(b => b.status === 'open_for_bets' || b.status === 'voting').length;
      const completedBets = bets.filter(b => b.status === 'completed').length;

      setPlatformStats({
        totalBets: bets.length,
        totalVolume,
        totalParticipants,
        activeBets,
        completedBets,
      });

      const sortedByActivity = [...bets].sort((a, b) => b.totalActivity - a.totalActivity);
      setMostActiveBets(sortedByActivity.slice(0, 5));

      const sortedByVolume = [...bets].sort((a, b) => b.totalVolume - a.totalVolume);
      setHighestVolumeBets(sortedByVolume.slice(0, 5));

      const sortedByRecent = [...bets].sort((a, b) => b.bettingDeadline - a.bettingDeadline);
      setRecentBets(sortedByRecent.slice(0, 5));

      const creatorMap = {};
      bets.forEach(bet => {
        const creator = bet.creator.toLowerCase();
        if (!creatorMap[creator]) {
          creatorMap[creator] = { address: bet.creator, count: 0, totalVolume: 0 };
        }
        creatorMap[creator].count++;
        creatorMap[creator].totalVolume += bet.totalVolume;
      });
      const sortedCreators = Object.values(creatorMap).sort((a, b) => b.count - a.count);
      setTopCreators(sortedCreators.slice(0, 5));

      const connectedAddr = await getConnectedAddress();
      if (connectedAddr) {
        const userBets = bets.filter(b => b.creator.toLowerCase() === connectedAddr.toLowerCase());
        const userVolume = userBets.reduce((sum, bet) => sum + bet.totalVolume, 0);
        
        setUserStats({
          betsCreated: userBets.length,
          totalVolume: userVolume,
        });
      }

    } catch (error) {
      console.error("Error loading statistics:", error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon: Icon, title, value, subtitle, iconColor }) => (
    <Card className="bg-gray-800 border-gray-700">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-400 mb-1">{title}</p>
            <p className="text-3xl font-bold text-white">{value}</p>
            {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
          </div>
          <div className={`w-12 h-12 rounded-lg ${iconColor} flex items-center justify-center`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const BetListItem = ({ bet, showMetric, metricLabel, metricValue }) => (
    <Link to={createPageUrl(`BetDetails?address=${bet.address}`)}>
      <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors">
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium truncate">{bet.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <AddressDisplay address={bet.creator} />
            <span className="text-xs text-gray-500">•</span>
            <span className="text-xs text-gray-400">{moment.unix(bet.bettingDeadline).format('MMM D')}</span>
          </div>
        </div>
        {showMetric && (
          <div className="ml-4 text-right">
            <p className="text-sm text-gray-400">{metricLabel}</p>
            <p className="text-lg font-bold text-cyan-400">{metricValue}</p>
          </div>
        )}
      </div>
    </Link>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 p-6 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-cyan-400 mx-auto mb-4" />
          <p className="text-gray-400">Loading statistics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-white">Platform Statistics</h1>
            <p className="text-cyan-200 text-lg">Analytics and insights from the ProofBet ecosystem</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard icon={TrendingUp} title="Total Markets" value={platformStats.totalBets} iconColor="bg-cyan-600" />
          <StatCard icon={DollarSign} title="Total Volume" value={`$${platformStats.totalVolume.toFixed(2)}`} iconColor="bg-green-600" />
          <StatCard icon={Users} title="Total Participants" value={platformStats.totalParticipants} iconColor="bg-purple-600" />
          <StatCard icon={Flame} title="Active Markets" value={platformStats.activeBets} iconColor="bg-orange-600" />
          <StatCard icon={Award} title="Completed" value={platformStats.completedBets} iconColor="bg-blue-600" />
        </div>

        {walletAddress && userStats && (
          <Card className="bg-gradient-to-r from-purple-900/50 to-cyan-900/50 border-purple-500/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-400" />
                Your Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Markets Created</p>
                  <p className="text-2xl font-bold text-white">{userStats.betsCreated}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Total Volume</p>
                  <p className="text-2xl font-bold text-green-400">${userStats.totalVolume.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="active" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-gray-800 border-gray-700">
            <TabsTrigger value="active"><Flame className="w-4 h-4 mr-2" />Most Active</TabsTrigger>
            <TabsTrigger value="volume"><DollarSign className="w-4 h-4 mr-2" />Highest Volume</TabsTrigger>
            <TabsTrigger value="recent"><Clock className="w-4 h-4 mr-2" />Recent</TabsTrigger>
            <TabsTrigger value="creators"><Award className="w-4 h-4 mr-2" />Top Creators</TabsTrigger>
          </TabsList>

          <TabsContent value="active">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Most Active Markets</CardTitle>
                <CardDescription className="text-gray-400">Markets with the highest combined participants and voters</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {mostActiveBets.length === 0 ? <p className="text-gray-400 text-center py-8">No markets yet</p> : mostActiveBets.map(bet => <BetListItem key={bet.address} bet={bet} showMetric metricLabel="Activity" metricValue={bet.totalActivity} />)}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="volume">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Highest Volume Markets</CardTitle>
                <CardDescription className="text-gray-400">Markets with the most USDC staked</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {highestVolumeBets.length === 0 ? <p className="text-gray-400 text-center py-8">No markets yet</p> : highestVolumeBets.map(bet => <BetListItem key={bet.address} bet={bet} showMetric metricLabel="Volume" metricValue={`$${bet.totalVolume.toFixed(2)}`} />)}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recent">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Recently Created</CardTitle>
                <CardDescription className="text-gray-400">The latest markets on the platform</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentBets.length === 0 ? <p className="text-gray-400 text-center py-8">No markets yet</p> : recentBets.map(bet => <BetListItem key={bet.address} bet={bet} showMetric metricLabel="Volume" metricValue={`$${bet.totalVolume.toFixed(2)}`} />)}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="creators">
            <Card className="bg-gray-800 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Top Market Creators</CardTitle>
                <CardDescription className="text-gray-400">Users who have created the most markets</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {topCreators.length === 0 ? <p className="text-gray-400 text-center py-8">No creators yet</p> : topCreators.map((creator, index) => (
                  <div key={creator.address} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-purple-600 flex items-center justify-center font-bold text-white">{index + 1}</div>
                      <AddressDisplay address={creator.address} showFullOnHover />
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-white">{creator.count} markets</p>
                      <p className="text-xs text-gray-400">${creator.totalVolume.toFixed(2)} volume</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}