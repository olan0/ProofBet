
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
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Calendar as CalendarIcon, Upload, Video, Camera, AlertCircle, Info, Wallet, Plus } from "lucide-react"; // Added Plus icon
import { format } from "date-fns";
import { ethers } from "ethers";

// Import contract utilities
import { 
  getBetFactoryContract, 
  // REMOVED: No longer need to interact with token contracts directly for this page
  connectWallet, 
  getConnectedAddress, 
  formatAddress 
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
    votingDeadline: null,
  });

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [contractSettings, setContractSettings] = useState({
    creationFeeProof: 0,
    voteStakeAmountProof: 0,
    defaultVoterRewardPercentage: 0, // Added for configurable percentages
    defaultPlatformFeePercentage: 0  // Added for configurable percentages
  });
  const [userBalances, setUserBalances] = useState({
    usdc: 0,
    proof: 0
  });

  // Check for wallet connection on mount AND listen for account changes
  useEffect(() => {
    const checkWallet = async () => {
      const address = await getConnectedAddress();
      if (address) {
        setWalletAddress(address);
        setWalletConnected(true);
        await loadContractData(address);
      }
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

  // Load settings and balances from contracts
  const loadContractData = async (address) => {
    try {
      // Get BetFactory contract settings
      const factory = getBetFactoryContract();
      
      // Get creation fee, vote stake amount, and default percentages from BetFactory
      const [creationFee, voteStake, defaultVoterReward, defaultPlatformFee, internalBalances] = await Promise.all([
        factory.creationFeeProof(),
        factory.voteStakeAmountProof(),
        factory.defaultVoterRewardPercentage(),
        factory.defaultPlatformFeePercentage(),
        factory.getInternalBalances(address) // FETCH INTERNAL BALANCES
      ]);

      const [internalUsdc, internalProof] = internalBalances;

      setContractSettings({
        creationFeeProof: parseFloat(ethers.formatEther(creationFee)),
        voteStakeAmountProof: parseFloat(ethers.formatEther(voteStake)),
        defaultVoterRewardPercentage: Number(defaultVoterReward), // Convert BigInt to Number
        defaultPlatformFeePercentage: Number(defaultPlatformFee)  // Convert BigInt to Number
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!walletConnected) {
      await handleConnectWallet();
      return;
    }

    // Check if user has sufficient INTERNAL PROOF tokens for creation fee
    if (userBalances.proof < contractSettings.creationFeeProof) {
      // Instead of just showing an error, guide them to deposit
      const depositAmount = contractSettings.creationFeeProof - userBalances.proof;
      setError(`You need ${contractSettings.creationFeeProof} PROOF tokens but only have ${userBalances.proof.toFixed(2)} deposited. You need ${depositAmount.toFixed(2)} more PROOF tokens.`);
      // The button itself will be disabled, preventing submission.
      // This error message will be shown at the top, and the dedicated Card below.
      return; // Prevent submission if funds are insufficient
    }

    // Note: formData.category and formData.proofType are collected but not passed to contract in betDetails struct.
    // However, they are kept in validation as required fields for UI/future use.
    if (!formData.title || !formData.description || !formData.category || !formData.proofType || !formData.bettingDeadline || !formData.votingDeadline) {
      setError("Please fill out all required fields.");
      return;
    }

    setCreating(true);
    setError("");

    try {
      const factory = getBetFactoryContract(true); // with signer for transactions
      
      // REMOVED: The approval is no longer needed. The factory contract will
      // deduct the fee from the user's internal balance directly.
      // const proofToken = getProofTokenContract(true);
      // const creationFeeWei = ethers.parseEther(contractSettings.creationFeeProof.toString());
      // const approveTx = await proofToken.approve(await factory.getAddress(), creationFeeWei);
      // await approveTx.wait();

      // Calculate proof deadline as 24 hours after betting deadline
      const bettingDeadlineTimestamp = Math.floor(formData.bettingDeadline.getTime() / 1000);
      const proofDeadlineTimestamp = bettingDeadlineTimestamp + 24 * 60 * 60; // 24 hours later
      const votingDeadlineTimestamp = Math.floor(formData.votingDeadline.getTime() / 1000);

      // Create the bet details struct with ALL required fields
      const betDetails = {
        creator: walletAddress, // This will be overridden by the contract
        title: formData.title,
        description: formData.description,
        bettingDeadline: bettingDeadlineTimestamp,
        proofDeadline: proofDeadlineTimestamp,
        votingDeadline: votingDeadlineTimestamp,
        minimumBetAmount: ethers.parseUnits(formData.minimumBetAmount, 6), // USDC has 6 decimals
        minimumSideStake: ethers.parseUnits(formData.minimumSideStake, 6),
        minimumTrustScore: parseInt(formData.minimumTrustScore),
        voterRewardPercentage: contractSettings.defaultVoterRewardPercentage || 5, // Use fetched value with fallback
        platformFeePercentage: contractSettings.defaultPlatformFeePercentage || 3  // Use fetched value with fallback
      };

      // Create the bet on the blockchain - The contract now handles the fee deduction.
      const createTx = await factory.createBet(betDetails);
      const receipt = await createTx.wait();

      console.log("Bet created successfully:", receipt);
      
      // Navigate back to dashboard
      navigate(createPageUrl("Dashboard"));

    } catch (error) {
      console.error("Error creating bet:", error);
      setError(`Failed to create bet: ${error.reason || error.message}`);
    }

    setCreating(false);
  };

  // NEW: Handle deposit redirect
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

        {error && (
          <Alert variant="destructive" className="mb-6 bg-red-900/20 border-red-500/50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-200">{error}</AlertDescription>
          </Alert>
        )}

        {/* NEW: Insufficient funds guidance */}
        {walletConnected && userBalances.proof < contractSettings.creationFeeProof && (
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
                  <p className="text-yellow-200 mb-4">
                    You need <strong>{contractSettings.creationFeeProof} PROOF tokens</strong> to create a market, 
                    but you only have <strong>{userBalances.proof.toFixed(2)} PROOF</strong> in your internal wallet.
                  </p>
                  <p className="text-yellow-200 mb-4">
                    You need to deposit <strong>{(contractSettings.creationFeeProof - userBalances.proof).toFixed(2)} more PROOF tokens</strong> to proceed.
                  </p>
                  <Button 
                    onClick={handleGoToDeposit}
                    className="bg-yellow-600 hover:bg-yellow-700 text-white"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Go to Wallet & Deposit PROOF
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
                  <p className="text-lg font-bold text-green-400">
                    {userBalances.usdc.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Internal PROOF Balance:</p>
                  <p className={`text-lg font-bold ${userBalances.proof >= contractSettings.creationFeeProof ? 'text-purple-400' : 'text-yellow-400'}`}>
                    {userBalances.proof.toFixed(2)} PROOF
                  </p>
                  {userBalances.proof < contractSettings.creationFeeProof && (
                    <p className="text-xs text-yellow-400">
                      Needed: {contractSettings.creationFeeProof} PROOF
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

                <div className="space-y-2">
                  <Label className="text-gray-300">Vote Stake Amount (PROOF)</Label>
                  <Input
                    type="text"
                    value={contractSettings.voteStakeAmountProof.toFixed(2)}
                    readOnly
                    className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 opacity-70 cursor-not-allowed"
                  />
                  <p className="text-sm text-gray-400">
                    PROOF tokens voters must stake (set by contract)
                  </p>
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
                      <SelectItem value="sports">Sports</SelectItem>
                      <SelectItem value="politics">Politics</SelectItem>
                      <SelectItem value="entertainment">Entertainment</SelectItem>
                      <SelectItem value="crypto">Crypto</SelectItem>
                      <SelectItem value="personal">Personal Achievement</SelectItem>
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
                      <SelectItem value="video">Video Upload</SelectItem>
                      <SelectItem value="live_stream">Live Stream</SelectItem>
                      <SelectItem value="photo">Photo Evidence</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Deadlines */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-gray-300">Betting Closes *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.bettingDeadline ? format(formData.bettingDeadline, 'PPP') : 'Select deadline'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-gray-700 border-gray-600" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.bettingDeadline}
                        onSelect={(date) => handleInputChange('bettingDeadline', date)}
                        disabled={(date) => date < new Date()}
                        className="text-white"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label className="text-gray-300">Voting Deadline *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.votingDeadline ? format(formData.votingDeadline, 'PPP') : 'Select deadline'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-gray-700 border-gray-600" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.votingDeadline}
                        onSelect={(date) => handleInputChange('votingDeadline', date)}
                        disabled={(date) => date < new Date()}
                        className="text-white"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Submit Button */}
              <div className="space-y-4">
                <Alert className="bg-blue-900/20 border-blue-500/50">
                    <Info className="h-4 w-4 text-blue-300" />
                    <AlertDescription className="text-blue-200">
                        A platform fee of <strong>{contractSettings.creationFeeProof} PROOF tokens</strong> will be charged to create this prediction market.
                    </AlertDescription>
                </Alert>

                <Button
                  type="submit"
                  disabled={creating || userBalances.proof < contractSettings.creationFeeProof}
                  className={`w-full font-semibold py-3 ${
                    userBalances.proof < contractSettings.creationFeeProof 
                      ? 'bg-gray-600 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700'
                  } text-white`}
                >
                  {creating ? 'Creating Market...' : 
                   userBalances.proof < contractSettings.creationFeeProof ? 
                   `Insufficient PROOF (${userBalances.proof.toFixed(2)}/${contractSettings.creationFeeProof})` :
                   `Create Market & Pay ${contractSettings.creationFeeProof} PROOF`}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
