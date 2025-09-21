
import React, { useState, useEffect, useCallback } from "react";
import { Bet } from "@/api/entities";
import { Participant } from "@/api/entities";
import { StakeRefund } from "@/api/entities";
import { UserProfile } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus, TrendingUp, Wallet, User as UserIcon, Shield, Trophy, FileCheck, Grid, List } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import BetCard from "../components/betting/BetCard";
import BetRow from "../components/betting/BetRow"; // Added BetRow import
import StatsOverview from "../components/dashboard/StatsOverview";
import CategoryFilter from "../components/betting/CategoryFilter";
import MyBetsTab from "../components/dashboard/MyBetsTab";
import WalletTab from "../components/dashboard/WalletTab";
import TrustScoreTab from "../components/dashboard/TrustScoreTab";
import HistoryTab from "../components/dashboard/HistoryTab";
import WalletConnectionModal from "../components/wallet/WalletConnectionModal";
import { TrustScoreManager } from "../components/trust/TrustScoreManager";

export default function Dashboard() {
  const [bets, setBets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeTab, setActiveTab] = useState("markets");
  const [viewMode, setViewMode] = useState("grid"); // Added viewMode state
  
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [userTrustScore, setUserTrustScore] = useState(null);
  const [userProfile, setUserProfile] = useState(null); // Added userProfile state

  // Helper function to safely check if a bet exists
  const betExists = async (betId) => {
    try {
      const bet = await Bet.get(betId);
      return bet !== null;
    } catch (error) {
      const errorMessage = error.message || '';
      const isNotFoundError = 
        errorMessage.includes('not found') ||
        errorMessage.includes('404') ||
        errorMessage.includes('Request failed with status code 404') ||
        error.status === 404 ||
        error.code === 404;
      
      if (isNotFoundError) {
        return false; // Bet doesn't exist
      } else {
        console.error(`Error checking bet existence for ${betId}:`, error);
        return false; // Assume it doesn't exist to be safe
      }
    }
  };

  // Helper function to cancel bet and refund participants
  const cancelBetAndRefund = useCallback(async (bet) => {
    try {
      // First verify the bet still exists
      const exists = await betExists(bet.id);
      if (!exists) {
        console.warn(`Skipping refund processing for non-existent bet ${bet.id}`);
        return;
      }

      let participants = [];
      try {
        participants = await Participant.filter({ bet_id: bet.id });
      } catch (participantError) {
        console.error(`Error loading participants for bet ${bet.id} during refund:`, participantError);
        participants = []; // Continue with empty participants if fetch fails
      }

      for (const participant of participants) {
        try {
          const participantProfile = await UserProfile.filter({ wallet_address: participant.participant_address });
          if (participantProfile.length > 0) {
            await UserProfile.update(participantProfile[0].id, {
              internal_balance_usd: (participantProfile[0].internal_balance_usd || 0) + participant.stake_amount_usd
            });
          } else {
            console.warn(`UserProfile not found for participant address: ${participant.participant_address} linked to bet ID: ${bet.id}. Skipping refund for this participant.`);
          }
          
          await StakeRefund.create({
            participant_address: participant.participant_address,
            bet_id: bet.id,
            bet_title: bet.title,
            refund_amount_usd: participant.stake_amount_usd,
          });
        } catch (refundError) {
          console.error(`Failed to refund participant ${participant.participant_address} for bet ${bet.id}:`, refundError);
        }
      }
    } catch (error) {
      console.error(`Error processing refunds for bet ${bet.id}:`, error);
    }
  }, []);

  const loadBets = useCallback(async () => {
    setLoading(true);
    try {
      let data = [];
      try {
        data = await Bet.list("-created_date");
      } catch (error) {
        console.error("Error loading bets:", error);
        setBets([]);
        setLoading(false);
        return;
      }
      
      // Filter out any null or invalid bets first
      const validBets = data.filter(bet => bet && bet.id && bet.betting_deadline);
      
      // Process expired bets with comprehensive error handling
      const processedBets = [];
      
      for (const bet of validBets) {
        try {
          // Double-check that this bet still exists before processing
          const exists = await betExists(bet.id);
          if (!exists) {
            console.warn(`Skipping processing of deleted bet ${bet.id}`);
            continue; // Skip this bet entirely
          }

          let currentBet = { ...bet };
          let needsUpdate = false;
          let updatePayload = {};

          // Case 1: Betting deadline has passed for an 'open_for_bets' bet
          if (currentBet.status === 'open_for_bets' && new Date() > new Date(currentBet.betting_deadline)) {
            const minimumSideStake = currentBet.minimum_side_stake || 0.05;
            const yesMetMinimum = (currentBet.total_yes_stake || 0) >= minimumSideStake;
            const noMetMinimum = (currentBet.total_no_stake || 0) >= minimumSideStake;
            
            if (yesMetMinimum && noMetMinimum) {
              // Both sides met minimum - close betting and wait for proof
              currentBet.status = 'betting_closed';
              updatePayload.status = 'betting_closed';
              // Set proof deadline if not already set (for old bets)
              if (!currentBet.proof_deadline) {
                const bettingDeadline = new Date(currentBet.betting_deadline);
                currentBet.proof_deadline = new Date(bettingDeadline.getTime() + 24 * 60 * 60 * 1000).toISOString();
                updatePayload.proof_deadline = currentBet.proof_deadline;
              }
              needsUpdate = true;
            } else {
              // Minimum not met - cancel and refund
              await cancelBetAndRefund(currentBet);
              currentBet.status = 'cancelled';
              currentBet.cancellation_processed = true;
              updatePayload.status = 'cancelled';
              updatePayload.cancellation_processed = true;
              needsUpdate = true;
            }
          }

          // Case 2: Proof deadline has passed for a 'betting_closed' bet
          if (currentBet.status === 'betting_closed' && currentBet.proof_deadline && new Date() > new Date(currentBet.proof_deadline)) {
            // Creator failed to submit proof in time - cancel and refund
            await cancelBetAndRefund(currentBet);
            currentBet.status = 'cancelled';
            currentBet.cancellation_processed = true;
            updatePayload.status = 'cancelled';
            updatePayload.cancellation_processed = true;
            needsUpdate = true;
          }

          if (needsUpdate) {
            try {
              // Check once more that the bet exists before updating
              const stillExists = await betExists(bet.id);
              if (!stillExists) {
                console.warn(`Bet ${bet.id} was deleted during processing, skipping update.`);
                continue; // Skip this bet entirely
              }
              
              await Bet.update(bet.id, updatePayload);
            } catch (updateError) {
              console.error(`Failed to auto-update bet status for ${bet.id}:`, updateError);
              const errorMessage = updateError.message || '';
              const isNotFoundError = 
                errorMessage.includes('not found') ||
                errorMessage.includes('404') ||
                errorMessage.includes('Request failed with status code 404') ||
                updateError.status === 404 ||
                updateError.code === 404;
              
              if (isNotFoundError) {
                console.warn(`Bet ${bet.id} was deleted during update, skipping.`);
                continue; // Skip this bet entirely
              }
              // If update fails for other reasons, revert currentBet to original bet to prevent incorrect local state
              currentBet = { ...bet }; 
            }
          }

          processedBets.push(currentBet);
        } catch (error) {
          console.error(`Error processing bet ${bet?.id || 'unknown'}:`, error);
          const errorMessage = error.message || '';
          const isNotFoundError = 
            errorMessage.includes('not found') ||
            errorMessage.includes('404') ||
            errorMessage.includes('Request failed with status code 404') ||
            error.status === 404 ||
            error.code === 404;
          
          if (isNotFoundError) {
            console.warn(`Skipping bet ${bet?.id} as it appears to have been deleted.`);
            continue; // Skip this bet
          }
          // For other errors, still include the original bet to avoid losing data
          if (bet && bet.id) {
            processedBets.push(bet);
          }
        }
      }
      
      setBets(processedBets);
    } catch (error) {
      console.error("Error loading bets:", error);
      setBets([]);
    }
    setLoading(false);
  }, [cancelBetAndRefund]);

  useEffect(() => {
    // Check for a connected wallet in localStorage on initial load
    const storedWalletAddress = localStorage.getItem("walletAddress");
    if (storedWalletAddress) {
      setWalletAddress(storedWalletAddress);
      setWalletConnected(true);
    }
    loadBets();
  }, [loadBets]);

  useEffect(() => {
    const loadUserData = async () => {
      if (walletAddress) {
        try {
          // Fetch User Profile for Alias
          const profileData = await UserProfile.filter({ wallet_address: walletAddress });
          if (profileData.length > 0) {
            setUserProfile(profileData[0]);
          } else {
            setUserProfile(null);
          }

          // Fetch Trust Score
          const score = await TrustScoreManager.getTrustScore(walletAddress);
          setUserTrustScore(score);
        } catch (error) {
          console.error("Failed to load user data on dashboard", error);
          setUserTrustScore(null);
          setUserProfile(null);
        }
      } else {
        setUserTrustScore(null);
        setUserProfile(null);
      }
    };
    loadUserData();
  }, [walletAddress]);

  const handleWalletConnect = async (address) => {
    localStorage.setItem("walletAddress", address); // Save to localStorage
    setWalletAddress(address);
    setWalletConnected(true);
    setShowWalletModal(false);
  };
  
  const handleWalletDisconnect = () => {
    localStorage.removeItem("walletAddress"); // Remove from localStorage
    setWalletAddress("");
    setWalletConnected(false);
    setUserTrustScore(null); // Clear trust score on disconnect
    setUserProfile(null); // Clear profile on disconnect
  };

  const filteredBets = bets.filter(bet => {
    const categoryMatch = selectedCategory === "all" || bet.category === selectedCategory;
    return categoryMatch;
  });
  
  // Only show truly open bets (not expired) in the open section
  const openBets = filteredBets.filter(b => 
    b.status === 'open_for_bets' && new Date() < new Date(b.betting_deadline)
  );
  // New section for bets awaiting proof (betting closed, or proof submitted)
  const awaitingProofBets = filteredBets.filter(b => b.status === 'betting_closed' || b.status === 'proof_submitted');
  const votingBets = filteredBets.filter(b => b.status === 'voting');

  return (
    <>
      <div className="bg-gray-900 p-6 min-h-[calc(10vh-80px)]">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Prediction Markets</h1>
              <p className="text-gray-400">Bet on outcomes with proof-backed verification</p>
            </div>
            <div className="flex items-center gap-4">
              {walletConnected && (
                <Link to={createPageUrl("CreateBet")}>
                  <Button className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white font-semibold whitespace-nowrap">
                    <Plus className="w-5 h-5 mr-2" />
                    Create Bet
                  </Button>
                </Link>
              )}
              {!walletConnected ? (
                <Button onClick={() => setShowWalletModal(true)} className="bg-gray-700 hover:bg-gray-600 whitespace-nowrap">
                  <Wallet className="w-4 h-4 mr-2" />
                  Connect Wallet
                </Button>
              ) : (
                <div className="flex items-center gap-3 p-2 bg-gray-800 rounded-lg border border-gray-700">
                  <div className="w-8 h-8 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate" title={userProfile?.alias || walletAddress}>
                      {userProfile?.alias ? userProfile.alias : "Connected"}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{walletAddress}</p>
                  </div>
                   <Button onClick={handleWalletDisconnect} variant="ghost" size="sm" className="text-gray-400 hover:text-white hover:bg-gray-700">
                    Disconnect
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          <StatsOverview bets={bets} />

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-gray-800 border border-gray-700 grid w-full grid-cols-2 md:grid-cols-5">
              <TabsTrigger value="markets" className="data-[state=active]:bg-cyan-600"><TrendingUp className="w-4 h-4 mr-2" />Markets</TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-cyan-600"><Trophy className="w-4 h-4 mr-2" />History</TabsTrigger>
              {walletConnected && (
                <>
                  <TabsTrigger value="my-bets" className="data-[state=active]:bg-cyan-600"><UserIcon className="w-4 h-4 mr-2" />My Bets</TabsTrigger>
                  <TabsTrigger value="wallet" className="data-[state=active]:bg-cyan-600"><Wallet className="w-4 h-4 mr-2" />Wallet</TabsTrigger>
                  <TabsTrigger value="trust-score" className="data-[state=active]:bg-cyan-600"><Shield className="w-4 h-4 mr-2" />Trust Score</TabsTrigger>
                </>
              )}
            </TabsList>
            
            <TabsContent value="markets" className="mt-6 space-y-6">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <CategoryFilter 
                  selectedCategory={selectedCategory}
                  onCategoryChange={setSelectedCategory}
                />
                
                <div className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg p-1">
                  <Button 
                    onClick={() => setViewMode('grid')}
                    variant="ghost" 
                    size="sm"
                    className={`px-3 transition-colors ${viewMode === 'grid' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    <Grid className="w-4 h-4" />
                  </Button>
                  <Button 
                    onClick={() => setViewMode('list')}
                    variant="ghost" 
                    size="sm"
                    className={`px-3 transition-colors ${viewMode === 'list' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'}`}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              <div className="space-y-8">
                <MarketSection title="Open for Betting" bets={openBets} loading={loading} walletConnected={walletConnected} onRequestWalletConnect={() => setShowWalletModal(true)} userTrustScore={userTrustScore} viewMode={viewMode} />
                <MarketSection title="Awaiting Proof" icon={FileCheck} bets={awaitingProofBets} loading={loading} walletConnected={walletConnected} onRequestWalletConnect={() => setShowWalletModal(true)} userTrustScore={userTrustScore} viewMode={viewMode} />
                <MarketSection title="Voting Phase" bets={votingBets} loading={loading} walletConnected={walletConnected} onRequestWalletConnect={() => setShowWalletModal(true)} userTrustScore={userTrustScore} viewMode={viewMode} />
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              <HistoryTab />
            </TabsContent>
            
            {walletConnected && (
              <>
                <TabsContent value="my-bets" className="mt-6">
                  <MyBetsTab walletAddress={walletAddress} />
                </TabsContent>
                <TabsContent value="wallet" className="mt-6">
                  <WalletTab walletAddress={walletAddress} />
                </TabsContent>
                <TabsContent value="trust-score" className="mt-6">
                  <TrustScoreTab walletAddress={walletAddress} />
                </TabsContent>
              </>
            )}
          </Tabs>
        </div>
      </div>
      <WalletConnectionModal 
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        onConnect={handleWalletConnect}
      />
    </>
  );
}

const MarketSection = ({ title, bets, loading, take, walletConnected, onRequestWalletConnect, icon: Icon, userTrustScore, viewMode }) => {
  const displayBets = take ? bets.slice(0, take) : bets;

  const containerClasses = viewMode === 'grid'
    ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
    : "flex flex-col gap-4";

  return (
    <div>
      <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
        {Icon && <Icon className="w-6 h-6 text-cyan-400" />}
        {title} ({bets.length})
      </h2>
      {loading ? (
        <div className={containerClasses}>
          {Array(3).fill(0).map((_, i) => (
            viewMode === 'grid' ? (
              <div key={i} className="bg-gray-800 rounded-xl p-6 animate-pulse">
                <div className="h-4 bg-gray-700 rounded mb-4"></div>
                <div className="h-3 bg-gray-700 rounded mb-3"></div>
                <div className="h-3 bg-gray-700 rounded w-2/3"></div>
              </div>
            ) : (
              <div key={i} className="bg-gray-800 rounded-xl p-4 animate-pulse flex items-center gap-4">
                <div className="flex-1 h-8 bg-gray-700 rounded"></div>
                <div className="w-24 h-8 bg-gray-700 rounded"></div>
              </div>
            )
          ))}
        </div>
      ) : displayBets.length > 0 ? (
        <div className={containerClasses}>
          {displayBets.map((bet) => (
            viewMode === 'grid' ? (
              <BetCard key={bet.id} bet={bet} walletConnected={walletConnected} onRequestWalletConnect={onRequestWalletConnect} userTrustScore={userTrustScore} />
            ) : (
              <BetRow key={bet.id} bet={bet} walletConnected={walletConnected} onRequestWalletConnect={onRequestWalletConnect} userTrustScore={userTrustScore} />
            )
          ))}
        </div>
      ) : (
        <div className="bg-gray-800/50 border border-dashed border-gray-700 rounded-xl p-8 text-center text-gray-500">
          No bets in this section right now.
        </div>
      )}
    </div>
  );
};
