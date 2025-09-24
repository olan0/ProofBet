import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, Wallet } from "lucide-react";
import { ethers } from "ethers";

import CategoryFilter from "../components/betting/CategoryFilter";
import BetCard from "../components/betting/BetCard";
import { getBetFactoryContract, getBetContract, connectWallet, getConnectedAddress, formatAddress } from "../components/blockchain/contracts";

export default function Dashboard() {
  const [bets, setBets] = useState([]);
  const [filteredBets, setFilteredBets] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [walletAddress, setWalletAddress] = useState(null);
  const [connecting, setConnecting] = useState(false);

  const handleConnectWallet = async () => {
    setConnecting(true);
    setError(null);
    try {
      const address = await connectWallet();
      if (address) {
        setWalletAddress(address);
        // loadBets will be called by the useEffect hook watching walletAddress
      } else {
        setError("Failed to connect wallet. Please try again.");
      }
    } catch (err) {
      setError("Error connecting to wallet: " + err.message);
    }
    setConnecting(false);
  };

  const loadBets = useCallback(async () => {
    if (!walletAddress) {
        setLoading(false);
        return;
    }
    setLoading(true);
    setError(null);
    
    try {
      const factory = getBetFactoryContract();
      const betAddresses = await factory.getAllBets();

      if (betAddresses.length === 0) {
        setBets([]);
        setLoading(false);
        return;
      }

      const betPromises = betAddresses.map(async (address) => {
        try {
            const betContract = getBetContract(address);
            const details = await betContract.getBetDetails();
            
            // Convert contract data to a more JS-friendly format
            return {
                address: address,
                title: details.title,
                description: details.description,
                creator: details.creator,
                creationTimestamp: Number(details.creationTimestamp),
                category: Number(details.category),
                status: Number(details.status),
                totalYesStake: ethers.formatUnits(details.totalYesStake, 6), // Assuming USDC has 6 decimals
                totalNoStake: ethers.formatUnits(details.totalNoStake, 6),
            };
        } catch (e) {
            console.error(`Failed to fetch details for bet at ${address}:`, e);
            return null; // Return null for failed fetches
        }
      });

      const allBets = (await Promise.all(betPromises)).filter(b => b !== null); // Filter out failed ones
      setBets(allBets.reverse()); // Show newest first
    } catch (err) {
      console.error("Error loading bets from blockchain:", err);
      setError("Could not load markets. Ensure your wallet is on the correct network and contract addresses are set.");
    }
    
    setLoading(false);
  }, [walletAddress]);

  // Check for an already connected wallet on mount
  useEffect(() => {
    const checkForConnectedWallet = async () => {
        const address = await getConnectedAddress();
        if (address) {
            setWalletAddress(address);
        } else {
            setLoading(false); // Not connected, so stop loading
        }
    };
    checkForConnectedWallet();
  }, []);
  
  // Load bets when wallet address is available
  useEffect(() => {
      if(walletAddress) {
          loadBets();
      }
  }, [walletAddress, loadBets]);

  useEffect(() => {
    if (selectedCategory === "all") {
      setFilteredBets(bets);
    } else {
      const categoryMap = { 
        "sports": 1, // Corresponds to enum in Bet.sol
        "politics": 0, 
        "entertainment": 2, 
        "tech": 2, // Map tech to entertainment for now
        "crypto": 3, 
        "other": 4
      };
      const categoryIndex = categoryMap[selectedCategory];
      if (categoryIndex !== undefined) {
        setFilteredBets(bets.filter(bet => bet.category === categoryIndex));
      } else {
        setFilteredBets(bets);
      }
    }
  }, [selectedCategory, bets]);

  return (
    <div className="container mx-auto p-4 md:p-6">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Live Prediction Markets
          </h1>
          <p className="text-gray-400 mt-1">
            Decentralized betting powered by blockchain technology
          </p>
        </div>
        
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          {walletAddress ? (
            <>
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg border border-gray-700">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-gray-300 text-sm">{formatAddress(walletAddress)}</span>
              </div>
              <Link to={createPageUrl("CreateBet")}>
                <Button className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700">
                  Create Market
                </Button>
              </Link>
            </>
          ) : (
            <Button 
              onClick={handleConnectWallet} 
              disabled={connecting}
              className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700"
            >
              {connecting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Wallet className="mr-2 h-4 w-4" />
                  Connect Wallet
                </>
              )}
            </Button>
          )}
        </div>
      </header>

      <div className="mb-6">
        <CategoryFilter
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
      </div>

      {loading && (
        <div className="flex justify-center items-center py-16">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-500 mx-auto mb-4" />
            <p className="text-gray-400">Loading markets from blockchain...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 text-red-200 p-4 rounded-lg mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
            <div>
              <p className="font-semibold">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && (
        <>
          {walletAddress && filteredBets.length > 0 && (
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredBets.map((bet) => (
                <BetCard key={bet.address} bet={bet} />
              ))}
            </div>
          )}

          {walletAddress && filteredBets.length === 0 && (
            <div className="text-center py-16 bg-gray-800/50 rounded-lg">
              <h3 className="text-xl font-semibold text-gray-300 mb-2">No Markets Found</h3>
              <p className="text-gray-400 mb-6">
                {selectedCategory === "all" 
                  ? "No prediction markets are currently active." 
                  : `No markets found in the ${selectedCategory} category.`}
              </p>
              <Link to={createPageUrl("CreateBet")}>
                <Button className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700">
                  Create the First Market
                </Button>
              </Link>
            </div>
          )}

          {!walletAddress && !loading && (
            <div className="text-center py-16 bg-gray-800/50 rounded-lg">
              <Wallet className="w-16 h-16 text-gray-600 mx-auto mb-6" />
              <h3 className="text-2xl font-semibold text-gray-300 mb-4">Connect Your Wallet</h3>
              <p className="text-gray-400 mb-8 max-w-md mx-auto">
                Connect your Web3 wallet to view and participate in prediction markets. 
              </p>
              <Button 
                onClick={handleConnectWallet}
                className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 px-8 py-3"
              >
                <Wallet className="mr-2 h-5 w-5" />
                Connect Wallet
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}