import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Calendar as CalendarIcon, AlertCircle, Info, Wallet, Plus, Loader2, Lock, Copy, Check, Link } from "lucide-react";
import { format } from "date-fns";
import { ethers } from "ethers";

import {
  generateBetKey,
  hexKeyToBytes32,
  buildInviteLink,
  savePrivateKey,
} from "../utils/betCrypto";

// Import contract utilities
import {
  getBetFactoryContract,
  getTrustScoreContract,
  connectWallet,
  getConnectedAddress,
  formatAddress,
  getBlockTimestamp,
} from "../components/blockchain/contracts";

export default function CreateBet() {
  const navigate = useNavigate();
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    minimumBetAmount: "10",
    minimumSideStake: "50",
    minimumTotalStake: "100", // This field is collected but not sent to the contract in the current betDetails struct.
    minimumVotes: "5", // This field is collected but not sent to the contract in the current betDetails struct.
    minimumTrustScore: "0",
    proofType: "", // This field is collected but not sent to the contract in the current betDetails struct.
    category: "", // This field is collected but not sent to the contract in the current betDetails struct.
    bettingDeadline: null,
    proofDeadline: null,
    votingDeadline: null,
    bettingTime: "23:59",
    proofTime: "23:59",
    votingTime: "23:59",
  });

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [dateErrors, setDateErrors] = useState({ bettingDeadline: "", proofDeadline: "", votingDeadline: "" });
  const [contractSettings, setContractSettings] = useState({
    creationFeeProof: 0,
    voteStakeAmountProof: 0,
    defaultVoterRewardPercentage: 0,
    defaultPlatformFeePercentage: 0,
    proofCollateralUsdc: 0
  });
  const [userBalances, setUserBalances] = useState({
    usdc: 0,
    proof: 0
  });
  const [dynamicFeeProof, setDynamicFeeProof] = useState(0); // State for dynamic PROOF fee
  const [calculatingFee, setCalculatingFee] = useState(false); // State for fee calculation loading
  const [isBanned, setIsBanned] = useState(false);
  const [userTrustScore, setUserTrustScore] = useState(null);
  const [banThreshold, setBanThreshold] = useState(-20);

  // Block timestamp (may differ from wall-clock on local Hardhat after evm_increaseTime)
  const [blockTime, setBlockTime] = useState(null);

  // Private bet
  const [isPrivate, setIsPrivate] = useState(false);
  const [inviteKey, setInviteKey] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  // Check for wallet connection on mount AND listen for account changes
  useEffect(() => {
    const checkWallet = async () => {
      const address = await getConnectedAddress();
      if (address) {
        setWalletAddress(address);
        setWalletConnected(true);
        await loadContractData(address);
        await checkBannedStatus(address);
      }
      const bt = await getBlockTimestamp();
      setBlockTime(bt);
      setLoading(false);
    };
    checkWallet();
    
    // Add listener for account changes
    if (window.ethereum) {
        const handleAccountsChanged = (accounts) => {
            if (accounts.length > 0) {
                // If account changes, re-load everything for the new account
                // A full reload is often simpler for complex state management on account changes
                window.location.reload(); 
            } else {
                // If user disconnects all accounts
                setWalletConnected(false);
                setWalletAddress("");
                setUserBalances({ usdc: 0, proof: 0 });
            }
        };

        window.ethereum.on('accountsChanged', handleAccountsChanged);

        // Cleanup listener on component unmount
        return () => {
            window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        };
    }
  }, []);

  // Calculate dynamic fee whenever form data changes that impact the fee
  useEffect(() => {
    if (walletConnected && walletAddress) {
      calculateDynamicFee();
    }
  }, [formData, walletConnected, walletAddress, contractSettings]);

  // Check if user is banned and fetch trust score + ban threshold
  const checkBannedStatus = async (address) => {
    try {
      const factory = getBetFactoryContract();
      const ts = getTrustScoreContract();
      const [banned, score, threshold] = await Promise.all([
        factory.isBanned(address),
        ts.getScore(address),
        ts.banThreshold(),
      ]);
      setIsBanned(banned);
      setUserTrustScore(Number(score));
      setBanThreshold(Number(threshold));
    } catch (error) {
      console.error("Error checking banned status:", error);
      setIsBanned(false);
    }
  };

  // Load settings and balances from contracts
  const loadContractData = async (address) => {
    try {
      // Get BetFactory contract settings
      const factory = getBetFactoryContract();
      
      // Get creation fee, vote stake amount, default percentages and collateral from BetFactory
      const [creationFee, voteStake, defaultVoterReward, defaultPlatformFee, proofCollateral, internalBalances] = await Promise.all([
        factory.creationFeeProof(),
        factory.voteStakeAmountProof(),
        factory.defaultVoterRewardPercentage(),
        factory.defaultPlatformFeePercentage(),
        factory.proofCollateralUsdc(),
        factory.getInternalBalances(address),
      ]);

      const [internalUsdc, internalProof] = internalBalances;

      setContractSettings({
        creationFeeProof: parseFloat(ethers.formatEther(creationFee)),
        voteStakeAmountProof: parseFloat(ethers.formatEther(voteStake)),
        defaultVoterRewardPercentage: Number(defaultVoterReward),
        defaultPlatformFeePercentage: Number(defaultPlatformFee),
        proofCollateralUsdc: parseFloat(ethers.formatUnits(proofCollateral, 6))
      });

      // Get user's INTERNAL token balances
      setUserBalances({
        proof: parseFloat(ethers.formatEther(internalProof)),
        usdc: parseFloat(ethers.formatUnits(internalUsdc, 6)) // USDC typically has 6 decimals
      });

    } catch (error) {
      console.error("Error loading contract data:", error);
      setError("Failed to load contract settings. Please ensure your contracts are deployed correctly.");
    }
  };

  const calculateDynamicFee = async () => {
    if (!formData.bettingDeadline || !formData.proofDeadline || !formData.votingDeadline) {
      setDynamicFeeProof(0);
      return;
    }

    setCalculatingFee(true);
    try {
      const factory = getBetFactoryContract();
      
      const bettingDeadlineTimestamp = Math.floor(formData.bettingDeadline.getTime() / 1000);
      const proofDeadlineTimestamp = Math.floor(formData.proofDeadline.getTime() / 1000);
      const votingDeadlineTimestamp = Math.floor(formData.votingDeadline.getTime() / 1000);

      const categoryMap = {
        'crypto': 1, 'sports': 2, 'politics': 3, 'finance': 4,
        'entertainment': 5, 'personal': 6, 'other': 7
      };
      const proofTypeMap = {
        'video': 1, 'livestream': 2, 'document': 3, 'oracle': 4, 'other': 5
      };

      const betDetails = {
        creator: walletAddress,
        title: formData.title || "Temporary",
        description: formData.description || "Temporary",
        bettingDeadline: bettingDeadlineTimestamp,
        proofDeadline: proofDeadlineTimestamp,
        votingDeadline: votingDeadlineTimestamp,
        minimumBetAmount: ethers.parseUnits(formData.minimumBetAmount || "10", 6),
        minimumSideStake: ethers.parseUnits(formData.minimumSideStake || "50", 6),
        minimumTrustScore: parseInt(formData.minimumTrustScore || "0"),
        minimumVotes: parseInt(formData.minimumVotes || "3"),
        category: categoryMap[formData.category] || 5,
        proofType: proofTypeMap[formData.proofType] || 5
      };

      const feeInProof = await factory.calculateDynamicCreationFee(betDetails);
      setDynamicFeeProof(parseFloat(ethers.formatEther(feeInProof)));
    } catch (error) {
      console.error("Error calculating dynamic fee:", error);
      setDynamicFeeProof(0);
    } finally {
      setCalculatingFee(false);
    }
  };

  const handlePrivateToggle = (checked) => {
    setIsPrivate(checked);
    if (checked && !inviteKey) {
      const key = generateBetKey();
      setInviteKey(key);
    }
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleConnectWallet = async () => {
    const address = await connectWallet();
    if (address) {
      setWalletAddress(address);
      setWalletConnected(true);
      await loadContractData(address);
    } else {
      setError("Failed to connect wallet. Please try again.");
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError("");
  };

  const combineDateAndTime = (date, timeStr) => {
    if (!date) return null;
    const parts = (timeStr || "23:59").split(':').map(Number);
    const hours = Number.isFinite(parts[0]) ? parts[0] : 23;
    const minutes = Number.isFinite(parts[1]) ? parts[1] : 59;
    const result = new Date(date);
    result.setHours(hours, minutes, 0, 0);
    return isNaN(result.getTime()) ? null : result;
  };

  const handleDeadlineDateChange = (dateField, timeField, date) => {
    setFormData(prev => {
      const updated = { ...prev, [dateField]: combineDateAndTime(date, prev[timeField]) };
      setDateErrors(validateDates(updated));
      return updated;
    });
    setError("");
  };

  const handleDeadlineTimeChange = (dateField, timeField, timeStr) => {
    setFormData(prev => {
      const updated = {
        ...prev,
        [timeField]: timeStr,
        [dateField]: combineDateAndTime(prev[dateField], timeStr),
      };
      setDateErrors(validateDates(updated));
      return updated;
    });
    setError("");
  };

  // Parse yyyy-MM-dd from <input type="date"> and combine with existing time
  const handleDeadlineDirectInput = (dateField, timeField, rawValue) => {
    if (!rawValue) {
      setFormData(prev => {
        const updated = { ...prev, [dateField]: null };
        setDateErrors(validateDates(updated));
        return updated;
      });
      return;
    }
    const [y, m, d] = rawValue.split("-").map(Number);
    const parsed = new Date(y, m - 1, d);
    setFormData(prev => {
      const updated = { ...prev, [dateField]: combineDateAndTime(parsed, prev[timeField]) };
      setDateErrors(validateDates(updated));
      return updated;
    });
    setError("");
  };

  const validateDates = (data, refTime) => {
    const errors = { bettingDeadline: "", proofDeadline: "", votingDeadline: "" };
    const now = refTime || blockTime || new Date();
    const HOUR_MS = 60 * 60 * 1000;

    if (data.bettingDeadline && data.bettingDeadline <= now) {
      errors.bettingDeadline = "Betting deadline must be in the future.";
    }
    if (data.proofDeadline && data.proofDeadline <= now) {
      errors.proofDeadline = "Proof deadline must be in the future.";
    }
    if (data.votingDeadline && data.votingDeadline <= now) {
      errors.votingDeadline = "Voting deadline must be in the future.";
    }
    if (data.bettingDeadline && data.proofDeadline) {
      if (data.proofDeadline - data.bettingDeadline < HOUR_MS) {
        errors.proofDeadline = "Proof deadline must be at least 1 hour after betting deadline.";
      }
    }
    if (data.proofDeadline && data.votingDeadline) {
      if (data.votingDeadline - data.proofDeadline < HOUR_MS) {
        errors.votingDeadline = "Voting deadline must be at least 1 hour after proof deadline.";
      }
    }
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!walletConnected) {
      await handleConnectWallet();
      return;
    }

    // Check if user is banned or trust score is too low
    if (isBanned) {
      setError("You are banned from creating markets.");
      return;
    }
    if (userTrustScore !== null && userTrustScore <= banThreshold) {
      setError(`Your trust score (${userTrustScore}) is at or below the ban threshold (${banThreshold}). Creating markets is disabled.`);
      return;
    }

    // Check if user has sufficient USDC for collateral
    if (userBalances.usdc < contractSettings.proofCollateralUsdc) {
      const depositAmount = contractSettings.proofCollateralUsdc - userBalances.usdc;
      setError(`You need ${contractSettings.proofCollateralUsdc.toFixed(2)} USDC but only have ${userBalances.usdc.toFixed(2)} deposited. You need ${depositAmount.toFixed(2)} more USDC.`);
      return;
    }

    // Check PROOF for dynamic fee
    if (userBalances.proof < dynamicFeeProof) {
      const depositAmount = dynamicFeeProof - userBalances.proof;
      setError(`You need ${dynamicFeeProof.toFixed(2)} PROOF tokens but only have ${userBalances.proof.toFixed(2)} deposited. You need ${depositAmount.toFixed(2)} more PROOF tokens.`);
      return;
    }

    if (!formData.title || !formData.description || !formData.category || !formData.proofType || !formData.bettingDeadline || !formData.proofDeadline || !formData.votingDeadline) {
      setError("Please fill out all required fields.");
      return;
    }

    // Re-fetch block timestamp at submit time to catch local Hardhat time drift
    const freshBlockTime = await getBlockTimestamp();
    setBlockTime(freshBlockTime);
    const dErrors = validateDates(formData, freshBlockTime);
    if (Object.values(dErrors).some(Boolean)) {
      setDateErrors(dErrors);
      setError("Please fix the date errors before submitting.");
      return;
    }

    setCreating(true);
    setError("");

    try {
      const factory = getBetFactoryContract(true); // with signer for transactions

      const bettingDeadlineTimestamp = Math.floor(formData.bettingDeadline.getTime() / 1000);
      const proofDeadlineTimestamp = Math.floor(formData.proofDeadline.getTime() / 1000);
      const votingDeadlineTimestamp = Math.floor(formData.votingDeadline.getTime() / 1000);

      const categoryMap = {
        'crypto': 1, 'sports': 2, 'politics': 3, 'finance': 4,
        'entertainment': 5, 'personal': 6, 'other': 7
      };
      const proofTypeMap = {
        'video': 1, 'livestream': 2, 'document': 3, 'oracle': 4, 'other': 5
      };

      const betDetails = {
        creator: walletAddress,
        title: formData.title,
        description: formData.description,
        bettingDeadline: bettingDeadlineTimestamp,
        proofDeadline: proofDeadlineTimestamp,
        votingDeadline: votingDeadlineTimestamp,
        minimumBetAmount: ethers.parseUnits(formData.minimumBetAmount, 6),
        minimumSideStake: ethers.parseUnits(formData.minimumSideStake, 6),
        minimumTrustScore: parseInt(formData.minimumTrustScore),
        minimumVotes: parseInt(formData.minimumVotes) || 3,
        category: categoryMap[formData.category] || 5,
        proofType: proofTypeMap[formData.proofType] || 5
      };

      // Compute on-chain invite key hash (keccak256 of the raw 32-byte key)
      const inviteKeyHash = isPrivate
        ? ethers.keccak256(hexKeyToBytes32(inviteKey))
        : ethers.ZeroHash;

      const createTx = await factory.createBet(betDetails, isPrivate, inviteKeyHash);
      const receipt = await createTx.wait();

      // Extract new bet address from BetCreated event
      // betAddress is not indexed so it's in log.data, not topics — use interface.parseLog
      const factoryIface = getBetFactoryContract().interface;
      let newBetAddress = null;
      for (const log of receipt.logs) {
        try {
          const parsed = factoryIface.parseLog(log);
          if (parsed?.name === "BetCreated") {
            newBetAddress = parsed.args.betAddress;
            break;
          }
        } catch {}
      }

      if (isPrivate && newBetAddress) {
        savePrivateKey(newBetAddress, inviteKey, walletAddress);
        const link = buildInviteLink(newBetAddress, inviteKey);
        setInviteLink(link);
        setCreating(false);
        return; // stay on page to show invite link
      }

      if (newBetAddress) {
        navigate(`/BetDetails?address=${newBetAddress}`);
      } else {
        navigate(createPageUrl("Dashboard"));
      }

    } catch (error) {
      console.error("Error creating bet:", error);
      setError(`Failed to create bet: ${error.reason || error.message}`);
    }

    setCreating(false);
  };

  // Handle deposit redirect
  const handleGoToDeposit = () => {
    // Navigate to Dashboard's wallet tab
    navigate(createPageUrl("Dashboard") + "?tab=wallet");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (!walletConnected) {
    return (
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(createPageUrl("Dashboard"))}
              className="border-gray-700 bg-gray-800 hover:bg-gray-700 text-gray-300"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-white">Create Prediction Market</h1>
              <p className="text-gray-400 mt-1">Connect your wallet to start creating bets</p>
            </div>
          </div>

          <Card className="bg-gray-800 border-gray-700">
            <CardContent className="text-center py-16">
              <Wallet className="w-16 h-16 text-gray-600 mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-white mb-4">Wallet Connection Required</h2>
              <p className="text-gray-400 mb-8 max-w-md mx-auto">
                Connect your wallet to create prediction markets and pay fees directly on the blockchain.
              </p>
              <Button 
                onClick={handleConnectWallet} 
                className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white font-bold px-8 py-3"
              >
                <Wallet className="w-5 h-5 mr-2" />
                Connect Wallet
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const hasInsufficientFunds = userBalances.usdc < contractSettings.proofCollateralUsdc || userBalances.proof < dynamicFeeProof;

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(createPageUrl("Dashboard"))}
            className="border-gray-700 bg-gray-800 hover:bg-gray-700 text-gray-300"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-white">Create Prediction Market</h1>
            <p className="text-gray-400 mt-1">Create a decentralized bet on the blockchain</p>
          </div>
          <div className="flex items-center gap-3 p-2 bg-gray-800 rounded-lg border border-gray-700">
            <div className="w-8 h-8 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full flex items-center justify-center">
              <Wallet className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white text-sm">Connected</p>
              <p className="text-xs text-gray-400 truncate">{formatAddress(walletAddress)}</p>
            </div>
          </div>
        </div>

        {(isBanned || (userTrustScore !== null && userTrustScore <= banThreshold)) && (
          <Alert variant="destructive" className="mb-6 bg-red-900/20 border-red-500/50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-200">
              {isBanned
                ? "You are banned from creating markets. Please contact support if you believe this is an error."
                : `Your trust score (${userTrustScore}) is at or below the ban threshold (${banThreshold}). Creating markets is disabled.`}
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mb-6 bg-red-900/20 border-red-500/50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-200">{error}</AlertDescription>
          </Alert>
        )}

        {/* Block time warning — shown when local node time diverges from wall clock */}
        {blockTime && Math.abs(blockTime - new Date()) > 60_000 && (
          <Alert className="mb-6 bg-yellow-900/20 border-yellow-500/50">
            <AlertCircle className="h-4 w-4 text-yellow-400" />
            <AlertDescription className="text-yellow-200 text-sm">
              Local node time: <strong>{format(blockTime, 'yyyy-MM-dd HH:mm')}</strong> — deadlines must be after this time, not your system clock.
            </AlertDescription>
          </Alert>
        )}

        {/* Insufficient funds guidance for both PROOF and USDC */}
        {walletConnected && hasInsufficientFunds && (
          <Card className="bg-yellow-900/20 border-yellow-500/50 mb-6">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-yellow-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-yellow-300 mb-2">
                    Deposit Required
                  </h3>
                  {userBalances.usdc < contractSettings.proofCollateralUsdc && (
                    <p className="text-yellow-200 mb-2">
                      You need <strong>{contractSettings.proofCollateralUsdc.toFixed(2)} USDC</strong> for the proof collateral, 
                      but you only have <strong>{userBalances.usdc.toFixed(2)} USDC</strong> in your internal wallet.
                      You need <strong>{(contractSettings.proofCollateralUsdc - userBalances.usdc).toFixed(2)} more USDC</strong>.
                    </p>
                  )}
                  {userBalances.proof < dynamicFeeProof && (
                    <p className="text-yellow-200 mb-2">
                      You need <strong>{dynamicFeeProof.toFixed(2)} PROOF tokens</strong> for the creation fee, 
                      but you only have <strong>{userBalances.proof.toFixed(2)} PROOF</strong> in your internal wallet.
                      You need <strong>{(dynamicFeeProof - userBalances.proof).toFixed(2)} more PROOF</strong>.
                    </p>
                  )}
                  <Button 
                    onClick={handleGoToDeposit}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white mt-2"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Go to Wallet & Deposit Tokens
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Invite link — shown after private bet is created */}
        {inviteLink && (
          <Card className="bg-purple-900/30 border-purple-600 mb-6">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <Link className="w-6 h-6 text-purple-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-purple-200 mb-1">Private Bet Created!</h3>
                  <p className="text-sm text-purple-300 mb-3">
                    Share this invite link with people you want to participate. The key in the link is the only way to access the bet content — keep it safe.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={inviteLink}
                      className="bg-gray-900 border-purple-600 text-purple-200 text-sm font-mono"
                    />
                    <Button
                      onClick={copyInviteLink}
                      className="bg-purple-700 hover:bg-purple-600 text-white flex-shrink-0"
                    >
                      {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                  <Button
                    onClick={() => navigate(createPageUrl("Dashboard") + "?tab=private")}
                    className="mt-3 bg-gray-700 hover:bg-gray-600 text-white"
                  >
                    Go to Private Tab
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-gray-800 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white">Create Your Bet</CardTitle>
            <div className="flex items-center justify-between">
              <p className="text-gray-400">
                Propose a prediction for others to bet on
              </p>
              <div className="text-right space-y-2">
                <div>
                  <p className="text-sm text-gray-400">Internal USDC Balance:</p>
                  <p className={`text-lg font-bold ${userBalances.usdc >= contractSettings.proofCollateralUsdc ? 'text-green-400' : 'text-yellow-400'}`}>
                    {userBalances.usdc.toFixed(2)} USDC
                  </p>
                  {contractSettings.proofCollateralUsdc > 0 && userBalances.usdc < contractSettings.proofCollateralUsdc && (
                    <p className="text-xs text-yellow-400">
                      Needed: {contractSettings.proofCollateralUsdc.toFixed(2)} USDC
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-400">Internal PROOF Balance:</p>
                  <p className={`text-lg font-bold ${userBalances.proof >= dynamicFeeProof ? 'text-purple-400' : 'text-yellow-400'}`}>
                    {userBalances.proof.toFixed(2)} PROOF
                  </p>
                  {dynamicFeeProof > 0 && userBalances.proof < dynamicFeeProof && (
                    <p className="text-xs text-yellow-400">
                      Needed: {dynamicFeeProof.toFixed(2)} PROOF
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-2">
                <Label htmlFor="title" className="text-gray-300">What are you claiming will happen? *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="e.g., I will run a marathon in under 3 hours"
                  required
                  className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-gray-300">Details *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Provide clear details of what you're claiming and how you'll prove it..."
                  required
                  className="h-24 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                />
              </div>

              {/* Betting Parameters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6"> 
                <div className="space-y-2">
                  <Label htmlFor="min_bet" className="text-gray-300">Minimum Individual Bet (USDC) *</Label>
                  <Input
                    id="min_bet"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.minimumBetAmount}
                    onChange={(e) => handleInputChange('minimumBetAmount', e.target.value)}
                    placeholder="10"
                    required
                    className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="min_side" className="text-gray-300">Minimum Per Side (USDC) *</Label>
                  <Input
                    id="min_side"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.minimumSideStake}
                    onChange={(e) => handleInputChange('minimumSideStake', e.target.value)}
                    placeholder="50"
                    required
                    className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                  />
                  <p className="text-sm text-gray-400">
                    Both YES and NO sides must reach this amount
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="min_total" className="text-gray-300">Minimum Total Stakes (USDC) *</Label>
                  <Input
                    id="min_total"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.minimumTotalStake}
                    onChange={(e) => handleInputChange('minimumTotalStake', e.target.value)}
                    placeholder="100"
                    required
                    className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="min_votes" className="text-gray-300">Minimum Public Votes *</Label>
                  <Input
                    id="min_votes"
                    type="number"
                    min="1"
                    value={formData.minimumVotes}
                    onChange={(e) => handleInputChange('minimumVotes', e.target.value)}
                    placeholder="5"
                    required
                    className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="min_trust" className="text-gray-300">Minimum Trust Score (0-100)</Label>
                  <Input
                    id="min_trust"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.minimumTrustScore}
                    onChange={(e) => handleInputChange('minimumTrustScore', e.target.value)}
                    placeholder="0"
                    className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                  />
                </div>
              </div>

              {/* Category and Proof Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-gray-300">Category *</Label>
                  <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)} required>
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-700 border-gray-600">
                      <SelectItem value="crypto">Crypto</SelectItem>
                      <SelectItem value="sports">Sports</SelectItem>
                      <SelectItem value="politics">Politics</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                      <SelectItem value="entertainment">Entertainment</SelectItem>
                      <SelectItem value="personal">Personal</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300">Proof Type *</Label>
                  <Select value={formData.proofType} onValueChange={(value) => handleInputChange('proofType', value)} required>
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                      <SelectValue placeholder="How will you prove it?" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-700 border-gray-600">
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="livestream">Live Stream</SelectItem>
                      <SelectItem value="document">Document</SelectItem>
                      <SelectItem value="oracle">Oracle</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Private Bet Toggle */}
              <div className="flex items-start gap-4 p-4 bg-gray-750 border border-gray-600 rounded-lg">
                <Lock className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">Private Bet</p>
                      <p className="text-sm text-gray-400 mt-0.5">
                        Content encrypted end-to-end. Only people with your invite link can view details, bet, and vote.
                      </p>
                    </div>
                    <Switch
                      checked={isPrivate}
                      onCheckedChange={handlePrivateToggle}
                      className="ml-4"
                    />
                  </div>
                  {isPrivate && (
                    <div className="mt-3 p-3 bg-purple-900/30 border border-purple-700/50 rounded-md space-y-2">
                      <p className="text-xs text-purple-300 font-medium">
                        A unique invite key has been generated. Share the invite link after creating the bet.
                      </p>
                      <p className="text-xs text-gray-400 font-mono break-all">
                        Key: {inviteKey.slice(0, 16)}...{inviteKey.slice(-8)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Deadlines */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { label: 'Betting Closes', dateField: 'bettingDeadline', timeField: 'bettingTime' },
                  { label: 'Proof Deadline', dateField: 'proofDeadline',   timeField: 'proofTime'    },
                  { label: 'Voting Deadline', dateField: 'votingDeadline', timeField: 'votingTime'   },
                ].map(({ label, dateField, timeField }) => {
                  const today = new Date(); today.setHours(0, 0, 0, 0);
                  const dateVal = formData[dateField] && !isNaN(formData[dateField].getTime())
                    ? format(formData[dateField], 'yyyy-MM-dd')
                    : '';
                  return (
                    <div key={dateField} className="space-y-2">
                      <Label className="text-gray-300">{label} *</Label>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={dateVal}
                          min={format(today, 'yyyy-MM-dd')}
                          onChange={(e) => handleDeadlineDirectInput(dateField, timeField, e.target.value)}
                          className="flex-1 bg-gray-700 border border-gray-600 text-white rounded px-2 py-2 text-sm"
                        />
                        <input
                          type="time"
                          value={formData[timeField]}
                          onChange={(e) => handleDeadlineTimeChange(dateField, timeField, e.target.value)}
                          className="w-24 bg-gray-700 border border-gray-600 text-white rounded px-2 py-2 text-sm"
                        />
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600 flex-shrink-0"
                            >
                              <CalendarIcon className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0 bg-gray-700 border-gray-600" align="end">
                            <Calendar
                              mode="single"
                              selected={formData[dateField]}
                              onSelect={(date) => handleDeadlineDateChange(dateField, timeField, date)}
                              disabled={(date) => date < today}
                              className="text-white"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      {dateErrors[dateField] && (
                        <p className="text-red-400 text-xs">{dateErrors[dateField]}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Submit Button */}
              <div className="space-y-4">
                <Alert className="bg-blue-900/20 border-blue-500/50">
                    <Info className="h-4 w-4 text-blue-300" />
                    <AlertDescription className="text-blue-200">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span>Dynamic creation fee: </span>
                            {calculatingFee ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <strong>{dynamicFeeProof > 0 ? `${dynamicFeeProof.toFixed(2)} PROOF` : 'Fill form to calculate'}</strong>
                            )}
                          </div>
                          <div>Proof collateral (returned after providing proof): <strong>{contractSettings.proofCollateralUsdc.toFixed(2)} USDC</strong></div>
                        </div>
                    </AlertDescription>
                </Alert>

                <Button
                  type="submit"
                  disabled={creating || hasInsufficientFunds || calculatingFee || isBanned || (userTrustScore !== null && userTrustScore <= banThreshold)}
                  className={`w-full font-semibold py-3 ${
                    hasInsufficientFunds || calculatingFee || isBanned || (userTrustScore !== null && userTrustScore <= banThreshold)
                      ? 'bg-gray-600 cursor-not-allowed'
                      : 'bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700'
                  } text-white`}
                >
                  {isBanned ? 'You Are Banned From Creating Markets' :
                   (userTrustScore !== null && userTrustScore <= banThreshold) ? 'Trust Score Too Low' :
                   creating ? 'Creating Market...' :
                   calculatingFee ? 'Calculating Fees...' :
                   hasInsufficientFunds ?
                   'Insufficient Funds - Deposit Required' :
                   `Create Market (${dynamicFeeProof.toFixed(2)} PROOF + ${contractSettings.proofCollateralUsdc.toFixed(2)} USDC)`}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}