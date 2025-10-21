
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LayoutGrid, List, Loader2, Wallet, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ethers } from "ethers";

import BetCard from '../components/betting/BetCard';
import BetRow from "../components/betting/BetRow";
import InternalWalletPanel from "../components/wallet/InternalWalletPanel";
import { getBetFactoryContract, getBetContract, connectWallet, getConnectedAddress, formatAddress } from "../components/blockchain/contracts";

const STATUS_ENUM = { OPEN_FOR_BETS: 0, AWAITING_PROOF: 1, VOTING: 2, COMPLETED: 3, CANCELLED: 4 };
const ON_CHAIN_STATUS_MAP = {
  0: "open_for_bets",
  1: "awaiting_proof",
  2: "voting",
  3: "completed",
  4: "cancelled",
};


// REVISED HELPER: Prioritizes the on-chain status as the source of truth.
const getEffectiveStatus = (bet) => {
    if (!bet) return null;

    const { onChainStatus, proofUrl, bettingDeadline, proofDeadline, votingDeadline } = bet;

    // Terminal states are final and should always be trusted.
    if (onChainStatus === 'completed' || onChainStatus === 'cancelled') {
        return onChainStatus;
    }

    const now = Date.now();
    const bettingEnds = Number(bettingDeadline) * 1000;
    const proofEnds = Number(proofDeadline) * 1000;
    const votingEnds = Number(votingDeadline) * 1000;

    // The on-chain status is our "floor". We can only display a sub-state of it.
    switch (onChainStatus) {
        case 'open_for_bets':
            // If time is past betting deadline but status is still open, it's effectively closed pending keeper action.
            if (now > bettingEnds) return 'betting_closed';
            return 'open_for_bets';

        case 'awaiting_proof':
            // If proof is submitted, we can show it as 'voting' even before the keeper updates the on-chain status.
            if (proofUrl) return 'voting'; 
            // If proof deadline passes without proof, it's awaiting cancellation.
            if (now > proofEnds) return 'awaiting_cancellation_no_proof';
            return 'betting_closed'; // A more generic term for this phase

        case 'voting':
             // If voting deadline passes, it's awaiting final resolution by a keeper.
            if (now > votingEnds) return 'awaiting_resolution';
            return 'voting';
        
        default:
            // Fallback to the on-chain status if we don't have special logic for it.
            return onChainStatus;
    }
};


// Main Component
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("open-for-betting");
  const [bets, setBets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [walletAddress, setWalletAddress] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'list'

  const { openBets, awaitingProofBets, votingBets, resolvedBets, cancelledBets, myActivity } = useMemo(() => {
    const categorizedBets = {
      openBets: [],
      awaitingProofBets: [],
      votingBets: [],
      resolvedBets: [],
      cancelledBets: [],
      myActivity: [],
    };

    bets.forEach(bet => {
        // This ensures a bet the user participated in or voted on appears in "My Activity".
        if (bet.currentUserHasActivity) {
            categorizedBets.myActivity.push(bet);
        }

        // The bet is ALSO added to the appropriate status-based tab for general platform viewing.
        const effectiveStatus = getEffectiveStatus(bet);
        switch (effectiveStatus) {
            case 'open_for_bets':
                categorizedBets.openBets.push(bet);
                break;
            case 'betting_closed':
            case 'awaiting_cancellation_no_proof':
                categorizedBets.awaitingProofBets.push(bet);
                break;
            case 'voting':
                categorizedBets.votingBets.push(bet);
                break;
            case 'completed':
            case 'awaiting_resolution':
                categorizedBets.resolvedBets.push(bet);
                break;
            case 'cancelled':
                categorizedBets.cancelledBets.push(bet);
                break;
            default:
                break;
        }
    });

    return categorizedBets;
  }, [bets]);

  const handleConnectWallet = async () => {
    const address = await connectWallet();
    setWalletAddress(address);
  };

  const handleDisconnectWallet = () => {
    setWalletAddress(null);
  };

  const loadBets = useCallback(async () => {
    setIsLoading(true);
    try {
      const factory = getBetFactoryContract();
      const betAddresses = await factory.getBets();
      const connectedAddr = await getConnectedAddress();

      const betPromises = betAddresses.map(async (address) => {
        try {
            const betContract = getBetContract(address);
            
            const [
                onChainStatusRaw,
                info
            ] = await Promise.all([
                betContract.currentStatus(),
                betContract.getBetInfo()
            ]);

            let currentUserHasActivity = false;
            if (connectedAddr) {
                // Check for both betting and voting activity
                const [participantData, voteEvents] = await Promise.all([
                    betContract.participants(connectedAddr),
                    // Query for VoteCast events specifically from the connected user
                    betContract.queryFilter(betContract.filters.VoteCast(connectedAddr))
                ]);
                
                const hasStaked = participantData.yesStake > 0n || participantData.noStake > 0n;
                // The reliable way to check for past votes is to see if any VoteCast events exist
                const hasVoted = voteEvents.length > 0;
                
                if (hasStaked || hasVoted) {
                    currentUserHasActivity = true;
                }
            }
            
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

            const betData = {
                address: address,
                title: title,
                description: description,
                total_yes_stake_usd: parseFloat(ethers.formatUnits(totalYes, 6)),
                total_no_stake_usd: parseFloat(ethers.formatUnits(totalNo, 6)),
                bettingDeadline: Number(bettingDeadline),
                proofDeadline: Number(proofDeadline),
                votingDeadline: Number(votingDeadline),
                proofUrl,
                // Fix: Safely convert BigInt participantCount to Number for display
                participants_count: parseInt(participantCount.toString(), 10),
                voters_count: parseInt(voterCount.toString(), 10),
                onChainStatus: onChainStatus,
                category: 0, // Placeholder
                currentUserHasActivity,
            };
            
            return betData;

        } catch (e) {
            console.error(`Failed to load bet ${address}:`, e);
            return null;
        }
      });

      const loadedBets = (await Promise.all(betPromises)).filter(b => b !== null).reverse();
      setBets(loadedBets);
    } catch (e) {
      console.error("Could not load bets from factory:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBets();
    getConnectedAddress().then(setWalletAddress);
  }, [loadBets]);

  const renderBetList = (betList) => {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        </div>
      );
    }
    if (betList.length === 0) {
      return <p className="text-gray-400 text-center py-8">No markets in this category.</p>;
    }
    const listWithStatus = betList.map(bet => ({ ...bet, effectiveStatus: getEffectiveStatus(bet) }));
    if (viewMode === 'grid') {
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listWithStatus.map((bet) => (
            <BetCard key={bet.address} bet={bet} />
          ))}
        </div>
      );
    } else {
      return (
        <div className="space-y-4">
          {listWithStatus.map((bet) => (
            <BetRow key={bet.address} bet={bet} />
          ))}
        </div>
      );
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <h1 className="text-4xl font-bold text-white mb-4 md:mb-0">Markets</h1>
        <div className="flex gap-2 items-center">
            {walletAddress ? (
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400 bg-gray-800 px-3 py-2 rounded-md border border-gray-700">{formatAddress(walletAddress)}</span>
                    <Button variant="ghost" size="icon" onClick={handleDisconnectWallet}>
                        <LogOut className="w-5 h-5 text-gray-400" />
                    </Button>
                </div>
            ) : (
                <Button onClick={handleConnectWallet} className="bg-cyan-600 hover:bg-cyan-700">
                  <Wallet className="w-4 h-4 mr-2" />
                  Connect Wallet
                </Button>
            )}
            <Link to={createPageUrl("CreateBet")}>
              <Button className="bg-purple-600 hover:bg-purple-700">Create Bet</Button>
            </Link>
        </div>
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

          <TabsContent value="open-for-betting">
            {renderBetList(openBets)}
          </TabsContent>
          <TabsContent value="my-activity">
            {renderBetList(myActivity)}
          </TabsContent>
          <TabsContent value="awaiting-proof">
            {renderBetList(awaitingProofBets)}
          </TabsContent>
          <TabsContent value="open-for-voting">
            {renderBetList(votingBets)}
          </TabsContent>
          <TabsContent value="completed">
            {renderBetList(resolvedBets)}
          </TabsContent>
           <TabsContent value="cancelled">
            {renderBetList(cancelledBets)}
          </TabsContent>
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
