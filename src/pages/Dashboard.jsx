import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LayoutGrid, List, Loader2, Wallet, Plus, ChevronRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ethers } from "ethers";

import BetCard from '../components/betting/BetCard';
import BetRow from "../components/betting/BetRow";
import InternalWalletPanel from "../components/wallet/InternalWalletPanel";
import { getBetFactoryContract, getBetContract, connectWallet, getConnectedAddress } from "../components/blockchain/contracts";

// Contract enums - must match Solidity
const STATUS_ENUM = { OPEN_FOR_BETS: 0, AWAITING_PROOF: 1, VOTING: 2, COMPLETED: 3, CANCELLED: 4, NONE: 5 };
const ACTIVITY_ENUM = { PARTICIPATED: 1, VOTED: 2, NONE: 0 };
const ON_CHAIN_STATUS_MAP = {
  0: "open_for_bets",
  1: "awaiting_proof",
  2: "voting",
  3: "completed",
  4: "cancelled",
};

// Map tab names to contract filter params
const TAB_FILTERS = {
  "open-for-betting": { status: STATUS_ENUM.OPEN_FOR_BETS, activity: ACTIVITY_ENUM.NONE },
  "awaiting-proof": { status: STATUS_ENUM.AWAITING_PROOF, activity: ACTIVITY_ENUM.NONE },
  "open-for-voting": { status: STATUS_ENUM.VOTING, activity: ACTIVITY_ENUM.NONE },
  "completed": { status: STATUS_ENUM.COMPLETED, activity: ACTIVITY_ENUM.NONE },
  "cancelled": { status: STATUS_ENUM.CANCELLED, activity: ACTIVITY_ENUM.NONE },
  "my-activity": { status: STATUS_ENUM.NONE, activity: ACTIVITY_ENUM.PARTICIPATED },
};

// Helper: Prioritizes the on-chain status as the source of truth.
const getEffectiveStatus = (bet) => {
  if (!bet) return null;

  const { onChainStatus, proofUrl, bettingDeadline, proofDeadline, votingDeadline } = bet;

  if (onChainStatus === 'completed' || onChainStatus === 'cancelled') {
    return onChainStatus;
  }

  const now = Date.now();
  const bettingEnds = Number(bettingDeadline) * 1000;
  const proofEnds = Number(proofDeadline) * 1000;
  const votingEnds = Number(votingDeadline) * 1000;

  switch (onChainStatus) {
    case 'open_for_bets':
      if (now > bettingEnds) return 'betting_closed';
      return 'open_for_bets';
    case 'awaiting_proof':
      if (proofUrl) return 'voting';
      if (now > proofEnds) return 'awaiting_cancellation_no_proof';
      return 'betting_closed';
    case 'voting':
      if (now > votingEnds) return 'awaiting_resolution';
      return 'voting';
    default:
      return onChainStatus;
  }
};

export default function Dashboard() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("open-for-betting");
  const [bets, setBets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [nextCursor, setNextCursor] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 12;

  const handleConnectWallet = async () => {
    const address = await connectWallet();
    setWalletAddress(address);
  };

  const loadBetDetails = async (address) => {
    try {
      const betContract = getBetContract(address);
      
      const [onChainStatusRaw, info] = await Promise.all([
        betContract.currentStatus(),
        betContract.getBetInfo()
      ]);
      
      const [title, description, totalYes, totalNo, bettingDeadline, proofDeadline, votingDeadline, proofUrl, participantCount, voterCount] = info;
      const onChainStatus = ON_CHAIN_STATUS_MAP[Number(onChainStatusRaw)];

      return {
        address: address,
        title: title,
        description: description,
        total_yes_stake_usd: parseFloat(ethers.formatUnits(totalYes, 6)),
        total_no_stake_usd: parseFloat(ethers.formatUnits(totalNo, 6)),
        bettingDeadline: Number(bettingDeadline),
        proofDeadline: Number(proofDeadline),
        votingDeadline: Number(votingDeadline),
        proofUrl,
        participants_count: parseInt(participantCount.toString(), 10),
        voters_count: parseInt(voterCount.toString(), 10),
        onChainStatus: onChainStatus,
        category: 0,
      };
    } catch (e) {
      console.error(`Failed to load bet ${address}:`, e);
      return null;
    }
  };

  const loadBets = useCallback(async (cursorVal = 0, append = false) => {
    setIsLoading(true);
    try {
      const factory = getBetFactoryContract();
      const connectedAddr = await getConnectedAddress();
      
      // Get filter params for current tab
      const filter = TAB_FILTERS[activeTab] || TAB_FILTERS["open-for-betting"];
      const userAddr = filter.activity !== ACTIVITY_ENUM.NONE ? connectedAddr : ethers.ZeroAddress;
      
      // Call the new getBetsRange with filters
      const [betAddresses, newNextCursor] = await factory.getBetsRange(
        cursorVal,
        ITEMS_PER_PAGE,
        filter.status,
        filter.activity,
        userAddr || ethers.ZeroAddress
      );
      
      setNextCursor(Number(newNextCursor));
      setHasMore(betAddresses.length === ITEMS_PER_PAGE && Number(newNextCursor) > 0);
      
      if (betAddresses.length === 0) {
        if (!append) setBets([]);
        setIsLoading(false);
        return;
      }
      
      // Load details for this page's bets
      const betPromises = betAddresses.map(addr => loadBetDetails(addr));
      const loadedBets = (await Promise.all(betPromises)).filter(b => b !== null);
      
      if (append) {
        setBets(prev => [...prev, ...loadedBets]);
      } else {
        setBets(loadedBets);
      }
    } catch (e) {
      console.error("Could not load bets from factory:", e);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  // Reset and reload when tab changes
  useEffect(() => {
    setNextCursor(0);
    setHasMore(true);
    setBets([]);
    loadBets(0, false);
  }, [activeTab, walletAddress, loadBets]);

  useEffect(() => {
    getConnectedAddress().then(setWalletAddress);

    // Set up BetFactory event listeners for real-time updates
    const factory = getBetFactoryContract();

    const handleBetCreated = (betAddress, creator, event) => {
      console.log("New bet created:", betAddress);
      // Reload bets to show new market
      loadBets(0, false);
    };

    const handleBetStatusChanged = (betAddress, newStatus, reason, event) => {
      console.log("Bet status changed:", betAddress, newStatus);
      // Update the specific bet in the list
      setBets(prev => prev.map(bet => 
        bet.address.toLowerCase() === betAddress.toLowerCase()
          ? { ...bet, onChainStatus: ON_CHAIN_STATUS_MAP[Number(newStatus)] }
          : bet
      ));
    };

    const handleBetParticipation = (betAddress, participant, position, amountUsdc, event) => {
      console.log("Bet participation:", betAddress, participant);
      // Reload the specific bet details
      loadBetDetails(betAddress).then(updatedBet => {
        if (updatedBet) {
          setBets(prev => prev.map(bet =>
            bet.address.toLowerCase() === betAddress.toLowerCase() ? updatedBet : bet
          ));
        }
      });
    };

    const handleBetVote = (betAddress, voter, vote, event) => {
      console.log("Bet vote cast:", betAddress, voter);
      // Reload the specific bet details
      loadBetDetails(betAddress).then(updatedBet => {
        if (updatedBet) {
          setBets(prev => prev.map(bet =>
            bet.address.toLowerCase() === betAddress.toLowerCase() ? updatedBet : bet
          ));
        }
      });
    };

    factory.on("BetCreated", handleBetCreated);
    factory.on("BetStatusChanged", handleBetStatusChanged);
    factory.on("BetParticipation", handleBetParticipation);
    factory.on("BetVote", handleBetVote);

    return () => {
      factory.off("BetCreated", handleBetCreated);
      factory.off("BetStatusChanged", handleBetStatusChanged);
      factory.off("BetParticipation", handleBetParticipation);
      factory.off("BetVote", handleBetVote);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [location.search]);

  const handleLoadMore = () => {
    if (hasMore && !isLoading) {
      loadBets(nextCursor, true);
    }
  };

  const renderBetList = () => {
    const listWithStatus = bets.map(bet => ({ ...bet, effectiveStatus: getEffectiveStatus(bet) }));

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
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ChevronRight className="w-4 h-4 mr-2" />
              )}
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
          <TabsList className="bg-gray-800 border border-gray-700 grid w-full grid-cols-4 sm:grid-cols-7">
            <TabsTrigger value="open-for-betting" className="data-[state=active]:bg-cyan-600">Open</TabsTrigger>
            <TabsTrigger value="my-activity" className="data-[state=active]:bg-purple-600">My Activity</TabsTrigger>
            <TabsTrigger value="awaiting-proof" className="data-[state=active]:bg-cyan-600">Awaiting Proof</TabsTrigger>
            <TabsTrigger value="open-for-voting" className="data-[state=active]:bg-cyan-600">Voting</TabsTrigger>
            <TabsTrigger value="completed" className="data-[state=active]:bg-cyan-600">Resolved</TabsTrigger>
            <TabsTrigger value="cancelled" className="data-[state=active]:bg-cyan-600">Cancelled</TabsTrigger>
            <TabsTrigger value="wallet" className="data-[state=active]:bg-cyan-600">Wallet</TabsTrigger>
          </TabsList>
          
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

          <TabsContent value="open-for-betting">{renderBetList()}</TabsContent>
          <TabsContent value="my-activity">{renderBetList()}</TabsContent>
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