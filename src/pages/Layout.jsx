
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Wallet, TrendingUp, Settings, BookOpen, Code, ChevronDown, LogOut, DollarSign, ShieldCheck, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { getConnectedAddress, disconnectWallet, formatAddress, connectWallet, getUsdcTokenContract, getProofTokenContract, getBetFactoryContract } from "@/components/blockchain/contracts";
import { TrustScoreManager } from "@/components/trust/TrustScoreManager";
import { ethers } from "ethers";
import axios from "axios";


const apiBaseUrl =import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

export default function Layout({ children }) {
  const [walletAddress, setWalletAddress] = useState("");
  const [walletConnected, setWalletConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState("0");
  const [proofBalance, setProofBalance] = useState("0");
  const [trustScore, setTrustScore] = useState(null);
  const [userAlias, setUserAlias] = useState(null);

  const fetchBalances = async (address) => {
      if(!address) return;
      try {
          const factory = getBetFactoryContract();
          const [internalUsdc, internalProof] = await factory.getInternalBalances(address);
          
          setUsdcBalance(ethers.formatUnits(internalUsdc, 6));
          setProofBalance(ethers.formatEther(internalProof));
      } catch (error) {
          console.error("Failed to fetch internal balances:", error);
          setUsdcBalance("0");
          setProofBalance("0");
      }
  };

  const fetchTrustScore = async (address) => {
      if(!address) return;
      try {
          const score = await TrustScoreManager.getTrustScore(address);
          setTrustScore(score);
      } catch (error) {
          console.error("Failed to fetch trust score:", error);
          setTrustScore({ overall_score: 0 });
      }
  };

  const fetchUserAlias = async (address) => {
      if(!address) return;
      try {
        const res = await axios.get(`${apiBaseUrl.replace("/api", "")}/api/users/${address.toUpperCase()}`);
        setUserAlias(res.data.alias);
         
      } catch (error) {
          console.error("Failed to fetch user alias:", error);
          setUserAlias(null);
      }
  };

  useEffect(() => {
    const checkWallet = async () => {
      const address = await getConnectedAddress();
      if (address) {
        setWalletAddress(address);
        setWalletConnected(true);
        fetchBalances(address);
        fetchTrustScore(address);
        fetchUserAlias(address);
      }
    };
    checkWallet();
  }, []);
  
  useEffect(() => {
      if(window.ethereum) {
          const handleAccountsChanged = (accounts) => {
              if (accounts.length > 0) {
                  const newAddress = accounts[0];
                  setWalletAddress(newAddress);
                  setWalletConnected(true);
                  fetchBalances(newAddress);
                  fetchTrustScore(newAddress);
                  fetchUserAlias(newAddress);
              } else {
                  handleDisconnectWallet();
              }
          };
          window.ethereum.on('accountsChanged', handleAccountsChanged);
          return () => {
              window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          };
      }
  }, []);

  const handleConnectWallet = async () => {
    setConnecting(true);
    try {
      const address = await connectWallet();
      if (address) {
        setWalletAddress(address);
        setWalletConnected(true);
        fetchBalances(address);
        fetchTrustScore(address);
        fetchUserAlias(address);
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    }
    setConnecting(false);
  };

  const handleDisconnectWallet = async () => {
    try {
      await disconnectWallet();
      setWalletAddress("");
      setWalletConnected(false);
      setUsdcBalance("0");
      setProofBalance("0");
      setTrustScore(null);
      setUserAlias(null);
      window.location.reload();
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
    }
  };

  const getTrustScoreColor = (score) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-blue-400';
    if (score >= 40) return 'text-yellow-400';
    if (score >= 20) return 'text-orange-400';
    return 'text-red-400';
  };

  return (
    <div className="min-h-screen bg-gray-900">
      <style jsx>{`
        :root {
          --bg-primary: #0F172A;
          --bg-secondary: #1E293B;
          --accent-primary: #06B6D4;
          --accent-secondary: #8B5CF6;
          --text-primary: #F1F5F9;
          --text-secondary: #94A3B8;
        }
      `}</style>
      
      <header className="bg-gray-900/80 backdrop-blur-lg border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to={createPageUrl("Dashboard")} className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-xl text-white">ProofBet</h2>
              <p className="text-xs text-gray-400">Decentralized Betting</p>
            </div>
          </Link>
          
          {/* Navigation Links */}
          <nav className="flex items-center gap-4">
            <Link to={createPageUrl("Dashboard")}>
              <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-gray-800">
                Markets
              </Button>
            </Link>
            
            {walletConnected && (
              <Link to={createPageUrl("CreateBet")}>
                <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-gray-800">
                  Create Market
                </Button>
              </Link>
            )}

            <Link to={createPageUrl("Statistics")}>
              <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-gray-800">
                Statistics
              </Button>
            </Link>
            
            <Link to={createPageUrl("Documentation")}>
              <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-gray-800">
                <BookOpen className="w-4 h-4 mr-2" />
                Docs
              </Button>
            </Link>
            
            <Link to={createPageUrl("SmartContracts")}>
              <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-gray-800">
                <Code className="w-4 h-4 mr-2" />
                Contracts
              </Button>
            </Link>
            
            <Link to={createPageUrl("Admin")}>
              <Button variant="ghost" className="text-gray-300 hover:text-white hover:bg-gray-800">
                <Settings className="w-4 h-4 mr-2" />
                Admin
              </Button>
            </Link>

            {/* Wallet Connection */}
            {walletConnected ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="border-gray-600 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <span className="hidden sm:inline">{userAlias || formatAddress(walletAddress)}</span>
                      <Wallet className="w-4 h-4 sm:hidden" />
                      <ChevronDown className="w-4 h-4 ml-1" />
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700 text-white w-64">
                  <DropdownMenuLabel className="font-normal">
                    <p className="text-xs text-gray-400">Connected wallet</p>
                    {userAlias ? (
                      <>
                        <p className="text-sm font-semibold">{userAlias}</p>
                        <p className="text-xs font-mono text-gray-500">{formatAddress(walletAddress)}</p>
                      </>
                    ) : (
                      <p className="text-sm font-mono">{formatAddress(walletAddress)}</p>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-gray-700" />
                  
                  <DropdownMenuLabel className="font-normal text-xs text-gray-400">Trust Score</DropdownMenuLabel>
                  <DropdownMenuItem className="focus:bg-gray-700/50 cursor-default">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-cyan-400" />
                        <span>Reputation</span>
                      </div>
                      <span className={`font-bold text-lg ${getTrustScoreColor(trustScore?.overall_score || 0)}`}>
                        {trustScore ? Math.round(trustScore.overall_score) : 0}
                      </span>
                    </div>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator className="bg-gray-700" />
                  <DropdownMenuLabel className="font-normal text-xs text-gray-400">Internal Balances</DropdownMenuLabel>
                  <DropdownMenuItem className="focus:bg-gray-700/50 cursor-default">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-green-400" />
                        <span>USDC</span>
                      </div>
                      <span className="font-mono">{parseFloat(usdcBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="focus:bg-gray-700/50 cursor-default">
                     <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-purple-400" />
                        <span>PROOF</span>
                      </div>
                      <span className="font-mono">{parseFloat(proofBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-gray-700" />
                  <DropdownMenuItem 
                    onClick={handleDisconnectWallet}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 focus:text-red-300 focus:bg-red-500/10 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Disconnect Wallet
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button 
                onClick={handleConnectWallet} 
                disabled={connecting}
                className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white"
              >
                {connecting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wallet className="w-4 h-4 mr-2" />
                    Connect Wallet
                  </>
                )}
              </Button>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
