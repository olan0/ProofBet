import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LayoutGrid, List, Loader2, Wallet, Plus, ChevronRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ethers } from "ethers";

import BetCard from '../components/betting/BetCard';
import BetRow from "../components/betting/BetRow";
import ActivityCard from "../components/betting/ActivityCard";
import InternalWalletPanel from "../components/wallet/InternalWalletPanel";
import SearchBar from "../components/betting/SearchBar";
import { getBetFactoryContract, connectWallet, getConnectedAddress } from "../components/blockchain/contracts";
import { fetchBets, fetchActivity } from "../api/apiClient";

const ON_CHAIN_STATUS_MAP = {
  0: "open_for_bets",
  1: "awaiting_proof",
  2: "voting",
  3: "completed",
  4: "cancelled",
};

const STATUS_ENUM = { OPEN_FOR_BETS: 0, AWAITING_PROOF: 1, VOTING: 2, COMPLETED: 3, CANCELLED: 4, NONE: 5 };

const TAB_STATUS = {
  "all": undefined,
  "open-for-betting": STATUS_ENUM.OPEN_FOR_BETS,
  "awaiting-proof": STATUS_ENUM.AWAITING_PROOF,
  "open-for-voting": STATUS_ENUM.VOTING,
  "completed": STATUS_ENUM.COMPLETED,
  "cancelled": STATUS_ENUM.CANCELLED,
};


const getEffectiveStatus = (bet) => {
  if (!bet) return null;
  const { onChainStatus, proofUrl, bettingDeadline, proofDeadline, votingDeadline } = bet;

  if (onChainStatus === 'completed' || onChainStatus === 'cancelled') return onChainStatus;

  const now = Date.now();
  switch (onChainStatus) {
    case 'open_for_bets':
      return now > Number(bettingDeadline) * 1000 ? 'betting_closed' : 'open_for_bets';
    case 'awaiting_proof':
      if (proofUrl) return 'voting';
      return now > Number(proofDeadline) * 1000 ? 'awaiting_cancellation_no_proof' : 'betting_closed';
    case 'voting':
      return now > Number(votingDeadline) * 1000 ? 'awaiting_resolution' : 'voting';
    default:
      return onChainStatus;
  }
};

export default function Dashboard() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("my-activity");
  const [bets, setBets] = useState([]);
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [hasMore, setHasMore] = useState(false);
  const [apiCursor, setApiCursor] = useState(null);
  const [searchFilters, setSearchFilters] = useState({});
  const [activityTypeFilter, setActivityTypeFilter] = useState('all');
  const ITEMS_PER_PAGE = 12;

  const handleConnectWallet = async () => {
    const address = await connectWallet();
    setWalletAddress(address);
  };

  const loadActivityFromApi = useCallback(async (cursor = null, append = false) => {
    setIsLoading(true);
    try {
      const params = {
        user: walletAddress,
        limit: ITEMS_PER_PAGE,
        ...(cursor && { cursor }),
        ...(activityTypeFilter !== 'all' && { type: activityTypeFilter }),
      };

      const response = await fetchActivity(params);

      if (response.items && response.items.length > 0) {
        if (append) {
          setActivities(prev => [...prev, ...response.items]);
        } else {
          setActivities(response.items);
        }
        setApiCursor(response.pageInfo?.nextCursor || null);
        setHasMore(response.pageInfo?.hasNext || false);
      } else {
        if (!append) setActivities([]);
        setApiCursor(null);
        setHasMore(false);
      }
    } catch (e) {
      console.error("Could not load activity from API:", e);
      if (!append) setActivities([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [walletAddress, ITEMS_PER_PAGE, activityTypeFilter]);

  const loadBetsFromApi = useCallback(async (cursor = null, filters = {}, append = false) => {
    setIsLoading(true);
    try {
      const tabStatus = TAB_STATUS[activeTab];

      const params = {
        limit: ITEMS_PER_PAGE,
        ...(cursor && { cursor }),
        ...filters,
        status: filters.status !== undefined ? filters.status : tabStatus,
      };

      const response = await fetchBets(params);

      if (response.data && response.data.length > 0) {
        const mappedBets = response.data.map(bet => ({
          address: bet.betId,
          title: bet.title,
          description: bet.description,
          total_yes_stake_usd: parseFloat(ethers.formatUnits(bet.totalYesStake, 6)),
          total_no_stake_usd: parseFloat(ethers.formatUnits(bet.totalNoStake, 6)),
          bettingDeadline: Number(bet.bettingDeadline),
          proofDeadline: Number(bet.proofDeadline),
          votingDeadline: Number(bet.votingDeadline),
          proofUrl: bet.proofUrl,
          participants_count: Number(bet.totalParticipants),
          voters_count: Number(bet.totalVotes),
          onChainStatus: ON_CHAIN_STATUS_MAP[bet.status] || 'open_for_bets',
          category: bet.category || 0,
        }));

        if (append) {
          setBets(prev => [...prev, ...mappedBets]);
        } else {
          setBets(mappedBets);
        }
        setApiCursor(response.pagination?.nextCursor || null);
        setHasMore(response.pagination?.hasNext || false);
      } else {
        if (!append) setBets([]);
        setApiCursor(null);
        setHasMore(false);
      }
    } catch (e) {
      console.error("Could not load bets from API:", e);
      if (!append) setBets([]);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [ITEMS_PER_PAGE, activeTab]);

  const loadData = useCallback(() => {
    if (activeTab === 'my-activity') {
      if (walletAddress) loadActivityFromApi(null, false);
      return;
    }
    loadBetsFromApi(null, searchFilters, false);
  }, [activeTab, walletAddress, searchFilters, loadBetsFromApi, loadActivityFromApi]);

  // Reset and reload when tab, wallet, or activity filter changes
  useEffect(() => {
    setApiCursor(null);
    setHasMore(false);
    setBets([]);
    setActivities([]);
    loadData();
  }, [activeTab, walletAddress, loadData, activityTypeFilter]);

  useEffect(() => {
    getConnectedAddress().then(setWalletAddress);

    const factory = getBetFactoryContract();

    const handleBetCreated = () => loadData();

    const handleBetStatusChanged = (betAddress, newStatus) => {
      setBets(prev => prev.map(bet =>
        bet.address.toLowerCase() === betAddress.toLowerCase()
          ? { ...bet, onChainStatus: ON_CHAIN_STATUS_MAP[Number(newStatus)] }
          : bet
      ));
    };

    factory.on("BetCreated", handleBetCreated);
    factory.on("BetStatusChanged", handleBetStatusChanged);

    return () => {
      factory.off("BetCreated", handleBetCreated);
      factory.off("BetStatusChanged", handleBetStatusChanged);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab) setActiveTab(tab);
  }, [location.search]);

  const handleLoadMore = () => {
    if (!hasMore || isLoading) return;
    if (activeTab === 'my-activity' && walletAddress) {
      loadActivityFromApi(apiCursor, true);
    } else {
      loadBetsFromApi(apiCursor, searchFilters, true);
    }
  };

  const handleSearch = (filters) => {
    setSearchFilters(filters);
    setApiCursor(null);
    loadBetsFromApi(null, filters, false);
  };

  const handleSearchReset = () => {
    setSearchFilters({});
    setApiCursor(null);
    loadBetsFromApi(null, {}, false);
  };


  const renderBetList = () => {
    if (isLoading && bets.length === 0) {
      return (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        </div>
      );
    }

    if (bets.length === 0) {
      return <p className="text-gray-400 text-center py-8">No markets in this category.</p>;
    }

    const listWithStatus = bets.map(bet => ({ ...bet, effectiveStatus: getEffectiveStatus(bet) }));

    return (
      <>
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listWithStatus.map((bet) => (
              <BetCard key={bet.address} bet={bet} />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {listWithStatus.map((bet) => (
              <BetRow key={bet.address} bet={bet} />
            ))}
          </div>
        )}

        {hasMore && (
          <div className="flex justify-center mt-6">
            <Button
              variant="outline"
              onClick={handleLoadMore}
              disabled={isLoading}
              className="border-gray-600 text-gray-300"
            >
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ChevronRight className="w-4 h-4 mr-2" />}
              Load More
            </Button>
          </div>
        )}
      </>
    );
  };

  const renderActivityList = () => {
    if (isLoading && activities.length === 0) {
      return (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        </div>
      );
    }

    if (activities.length === 0) {
      return <p className="text-gray-400 text-center py-8">No activity yet. Start by placing a bet or creating a market!</p>;
    }

    return (
      <>
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activities.map((activity, idx) => (
              <ActivityCard key={`${activity.betId}-${activity.timestamp}-${idx}`} activity={activity} />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity, idx) => (
              <ActivityCard key={`${activity.betId}-${activity.timestamp}-${idx}`} activity={activity} />
            ))}
          </div>
        )}

        {hasMore && (
          <div className="flex justify-center mt-6">
            <Button
              variant="outline"
              onClick={handleLoadMore}
              disabled={isLoading}
              className="border-gray-600 text-gray-300"
            >
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ChevronRight className="w-4 h-4 mr-2" />}
              Load More
            </Button>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="container mx-auto p-4 md:p-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h1 className="text-4xl font-bold text-white mb-4 md:mb-0">Markets</h1>
        {walletAddress && (
          <Link to={createPageUrl("CreateBet")}>
            <Button className="bg-cyan-600 hover:bg-cyan-700">
              <Plus className="w-4 h-4 mr-2" />
              Create Market
            </Button>
          </Link>
        )}
      </header>

      {walletAddress ? (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-gray-800 border border-gray-700 grid w-full grid-cols-4 sm:grid-cols-8">
            <TabsTrigger value="my-activity" className="data-[state=active]:bg-purple-600">My Activity</TabsTrigger>
            <TabsTrigger value="all" className="data-[state=active]:bg-cyan-600">All</TabsTrigger>
            <TabsTrigger value="open-for-betting" className="data-[state=active]:bg-cyan-600">Open</TabsTrigger>
            <TabsTrigger value="awaiting-proof" className="data-[state=active]:bg-cyan-600">Awaiting Proof</TabsTrigger>
            <TabsTrigger value="open-for-voting" className="data-[state=active]:bg-cyan-600">Voting</TabsTrigger>
            <TabsTrigger value="completed" className="data-[state=active]:bg-cyan-600">Resolved</TabsTrigger>
            <TabsTrigger value="cancelled" className="data-[state=active]:bg-cyan-600">Cancelled</TabsTrigger>
            <TabsTrigger value="wallet" className="data-[state=active]:bg-cyan-600">Wallet</TabsTrigger>
          </TabsList>

          {activeTab === 'my-activity' ? (
            <div className="flex justify-between items-center">
              <Select value={activityTypeFilter} onValueChange={setActivityTypeFilter}>
                <SelectTrigger className="w-[200px] bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent className="bg-gray-700 border-gray-600 text-white">
                  <SelectItem value="all">All Activities</SelectItem>
                  <SelectItem value="1">Created Markets</SelectItem>
                  <SelectItem value="2">Placed Bets</SelectItem>
                  <SelectItem value="3">Cast Votes</SelectItem>
                </SelectContent>
              </Select>

              <div className="inline-flex items-center rounded-md bg-gray-800 p-1 border border-gray-700">
                <Button variant="ghost" size="sm" onClick={() => setViewMode('grid')} className={`px-3 ${viewMode === 'grid' ? 'bg-cyan-600' : ''}`}>
                  <LayoutGrid className="w-5 h-5"/>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setViewMode('list')} className={`px-3 ${viewMode === 'list' ? 'bg-cyan-600' : ''}`}>
                  <List className="w-5 h-5"/>
                </Button>
              </div>
            </div>
          ) : activeTab !== 'wallet' && (
            <div className="space-y-4">
              <SearchBar onSearch={handleSearch} onReset={handleSearchReset} />
              <div className="flex justify-end">
                <div className="inline-flex items-center rounded-md bg-gray-800 p-1 border border-gray-700">
                  <Button variant="ghost" size="sm" onClick={() => setViewMode('grid')} className={`px-3 ${viewMode === 'grid' ? 'bg-cyan-600' : ''}`}>
                    <LayoutGrid className="w-5 h-5"/>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setViewMode('list')} className={`px-3 ${viewMode === 'list' ? 'bg-cyan-600' : ''}`}>
                    <List className="w-5 h-5"/>
                  </Button>
                </div>
              </div>
            </div>
          )}

          <TabsContent value="my-activity">{renderActivityList()}</TabsContent>
          <TabsContent value="all">{renderBetList()}</TabsContent>
          <TabsContent value="open-for-betting">{renderBetList()}</TabsContent>
          <TabsContent value="awaiting-proof">{renderBetList()}</TabsContent>
          <TabsContent value="open-for-voting">{renderBetList()}</TabsContent>
          <TabsContent value="completed">{renderBetList()}</TabsContent>
          <TabsContent value="cancelled">{renderBetList()}</TabsContent>
          <TabsContent value="wallet">
            <InternalWalletPanel walletAddress={walletAddress} />
          </TabsContent>
        </Tabs>
      ) : (
        <Card className="bg-gray-800 border-gray-700 mt-10">
          <CardContent className="p-10 flex flex-col items-center text-center">
            <Wallet className="w-12 h-12 text-cyan-400 mb-4"/>
            <h3 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h3>
            <p className="text-gray-400 mb-6">Connect your wallet to view markets, place bets, and manage your funds.</p>
            <Button onClick={handleConnectWallet} className="bg-cyan-600 hover:bg-cyan-700">
              Connect Wallet
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
