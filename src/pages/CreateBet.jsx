
import React, { useState, useEffect } from "react";
import { Bet } from "@/api/entities";
import { UserProfile } from "@/api/entities";
import { AppSettings } from "@/api/entities";
import { UploadFile } from "@/api/integrations";
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
import { ArrowLeft, Calendar as CalendarIcon, Upload, Video, Camera, AlertCircle, Info, Wallet } from "lucide-react";
import { format } from "date-fns";
import { TrustScoreManager } from "../components/trust/TrustScoreManager";
import { Participant } from "@/api/entities";
import { StakeRefund } from "@/api/entities";
import WalletConnectionModal from "../components/wallet/WalletConnectionModal";
import DepositModal from "../components/wallet/DepositModal";

export default function CreateBet() {
  const navigate = useNavigate();
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [userProfile, setUserProfile] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    minimum_bet_amount: "10",
    minimum_side_stake: "50",
    minimum_total_stake: "100",
    minimum_votes: "5",
    minimum_trust_score: "0",
    proof_type: "",
    category: "",
    betting_deadline: null,
    voting_deadline: null,
    proof_deadline: null,
    proof_url: ""
  });
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [activeBetsCount, setActiveBetsCount] = useState(0);
  const [canCreateBet, setCanCreateBet] = useState(true);
  const [appSettings, setAppSettings] = useState({ 
    max_active_bets_per_user: 3, 
    bet_creation_fee_proof: 100, // Changed from bet_creation_fee_usd to bet_creation_fee_proof
    vote_stake_amount_proof: 10 // Added vote_stake_amount_proof
  });
  const [loadingSettings, setLoadingSettings] = useState(true);

  // Simulate wallet connection check
  // In a real app, this would check if MetaMask or another wallet is connected
  useEffect(() => {
    // Check for a connected wallet in localStorage on initial load
    const storedWalletAddress = localStorage.getItem("walletAddress");
    if (storedWalletAddress) {
      setWalletAddress(storedWalletAddress);
      setWalletConnected(true);
    } else {
        // If no wallet in storage, prompt to connect
        setShowWalletModal(true);
    }
  }, []);

  const handleWalletConnect = async (address) => {
    localStorage.setItem("walletAddress", address); // Save to localStorage
    setWalletConnected(true);
    setWalletAddress(address);
    setShowWalletModal(false);
    setError(""); // Clear any previous error
  };
  
  // Check active bets limit on component mount, now dependent on wallet connection
  useEffect(() => {
    const loadPrerequisites = async () => {
        if (!walletConnected) {
            setCanCreateBet(false);
            // Don't set an error message here, the modal will handle it.
            setLoadingSettings(false);
            return;
        }

        setLoadingSettings(true);
        try {
            const settingsData = await AppSettings.list();
            const currentSettings = settingsData.length > 0 ? settingsData[0] : { 
              max_active_bets_per_user: 3, 
              bet_creation_fee_proof: 100, // Default for new settings
              vote_stake_amount_proof: 10 // Default for new settings
            };
            setAppSettings(currentSettings);

            const creatorAddress = walletAddress;
            
            // Fetch or create user profile for displaying balance
            let currentUserProfile;
            const profileData = await UserProfile.filter({ wallet_address: creatorAddress });
            if (profileData.length === 0) {
                currentUserProfile = await UserProfile.create({
                    wallet_address: creatorAddress,
                    internal_balance_usd: 0,
                    internal_balance_proof: 0 // Initialize PROOF balance
                });
            } else {
                currentUserProfile = profileData[0];
            }
            setUserProfile(currentUserProfile);


            const allBets = await Bet.list("-created_date");
            const userBets = allBets.filter(bet => bet.creator_address === creatorAddress);
            
            // Aggressively process user's bets to update any outdated statuses before counting
            const processedUserBets = [];
            for (const bet of userBets) {
                let currentBet = { ...bet };
                let needsUpdate = false;

                // Case 1: Betting deadline has passed for an 'open_for_bets' bet
                if (currentBet.status === 'open_for_bets' && new Date() > new Date(currentBet.betting_deadline)) {
                    try {
                        const participants = await Participant.filter({ bet_id: currentBet.id });
                        const yesStake = participants.filter(p => p.position === 'yes').reduce((sum, p) => sum + p.stake_amount, 0);
                        const noStake = participants.filter(p => p.position === 'no').reduce((sum, p) => sum + p.stake_amount, 0);

                        const minSideStake = currentBet.minimum_side_stake || 50; // Default to 50 USDC
                        
                        if (yesStake >= minSideStake && noStake >= minSideStake) {
                            currentBet.status = 'betting_closed';
                        } else {
                            currentBet.status = 'cancelled';
                        }
                        needsUpdate = true;
                    } catch (e) {
                        console.error(`Failed to process participants for bet ${currentBet.id}`, e);
                    }
                }

                // Case 2: Voting deadline has passed for a 'voting' bet
                if (currentBet.status === 'voting' && new Date() > new Date(currentBet.voting_deadline)) {
                    // This state should trigger resolution, but for counting purposes, we'll consider it inactive.
                    // The actual resolution is handled on the BetDetails page. Here, we just mark it for recount.
                    // We don't change the status here to avoid complex resolution logic.
                }

                if (needsUpdate) {
                    try {
                        // Create a clean object for the update call, only including necessary fields.
                        const updatePayload = {
                            status: currentBet.status
                        };
                        await Bet.update(bet.id, updatePayload);
                    } catch(e) {
                        console.error(`Failed to auto-update bet status for ${bet.id}:`, e);
                        // If update fails, revert to original data to prevent incorrect local state
                        currentBet = { ...bet }; 
                    }
                }
                processedUserBets.push(currentBet);
            }

            const activeBets = processedUserBets.filter(bet => 
                bet.status === 'open_for_bets' || 
                bet.status === 'betting_closed' || 
                bet.status === 'proof_submitted' || 
                bet.status === 'voting'
            );
            
            setActiveBetsCount(activeBets.length);
            const canCreate = activeBets.length < currentSettings.max_active_bets_per_user;
            setCanCreateBet(canCreate);
            
            if (!canCreate) {
                setError(`You have reached the maximum limit of ${currentSettings.max_active_bets_per_user} active bets. Complete or wait for your existing bets to finish before creating new ones.`);
            }
        } catch (error) {
            console.error("Error loading prerequisites:", error);
            setError("Failed to load settings or active bet count. Please try again later.");
        }
        setLoadingSettings(false);
    };
    loadPrerequisites();
  }, [walletConnected, walletAddress]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleFileUpload = async (file) => {
    setUploading(true);
    try {
      const { file_url } = await UploadFile({ file });
      setFormData(prev => ({ ...prev, proof_url: file_url }));
    } catch (error) {
      setError("Failed to upload file. Please try again.");
    }
    setUploading(false);
  };

  const handleDeposit = async (amount, tokenType) => {
    if (!userProfile) {
        setError("User profile not loaded. Cannot deposit.");
        return;
    }
    try {
      const updates = {};
      if (tokenType === 'usd') {
        updates.internal_balance_usd = (userProfile.internal_balance_usd || 0) + amount;
      } else if (tokenType === 'proof') {
        updates.internal_balance_proof = (userProfile.internal_balance_proof || 0) + amount;
      }
      
      await UserProfile.update(userProfile.id, updates);
      // After successful update, refresh the userProfile state
      const updatedProfile = await UserProfile.filter({ wallet_address: walletAddress });
      if (updatedProfile.length > 0) {
        setUserProfile(updatedProfile[0]);
      }
      setShowDepositModal(false);
      setError(""); // Clear any previous error, including insufficient funds
    } catch (error) {
      console.error("Error depositing funds:", error);
      setError("Failed to process deposit. Please try again.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!walletConnected) {
      setShowWalletModal(true);
      return;
    }

    if (!canCreateBet) {
      setError(`You have reached the maximum limit of ${appSettings.max_active_bets_per_user} active bets. Complete your existing bets first.`);
      return;
    }
    
    setCreating(true);
    setError("");

    // Check internal PROOF balance for creation fee
    const creationFee = appSettings.bet_creation_fee_proof || 0;
    
    let currentUserProfile;
    try {
        const profileData = await UserProfile.filter({ wallet_address: walletAddress });
        if (profileData.length === 0) {
            // Auto-create user profile with 0 balance if it doesn't exist
            try {
                currentUserProfile = await UserProfile.create({ 
                    wallet_address: walletAddress, 
                    internal_balance_usd: 0,
                    internal_balance_proof: 0 // Initialize PROOF balance
                });
                setUserProfile(currentUserProfile);
                console.log("Auto-created user profile for new wallet:", walletAddress);
            } catch (createError) {
                console.error("Failed to create user profile:", createError);
                setError("Failed to initialize user profile. Please try again.");
                setCreating(false);
                return;
            }
        } else {
            currentUserProfile = profileData[0];
            // Ensure internal_balance_proof exists, default to 0 if not
            if (currentUserProfile.internal_balance_proof === undefined || currentUserProfile.internal_balance_proof === null) {
              currentUserProfile.internal_balance_proof = 0;
            }
            setUserProfile(currentUserProfile);
        }

        if ((currentUserProfile.internal_balance_proof || 0) < creationFee) {
            setError(`Insufficient PROOF tokens! You need ${creationFee} PROOF to create this bet but only have ${Math.floor(currentUserProfile.internal_balance_proof || 0)}.`);
            setCreating(false);
            return;
        }
    } catch (profileError) {
        console.error("Error with user profile:", profileError);
        setError("Failed to verify internal balance. Please try again.");
        setCreating(false);
        return;
    }

    if (!formData.title || !formData.description || !formData.category || !formData.proof_type || !formData.betting_deadline || !formData.voting_deadline) {
      setError("Please ensure all required fields (*) are filled out, including deadlines.");
      setCreating(false);
      return;
    }

    try {
      const creatorAddress = walletAddress;
      
      // Calculate proof deadline as 24 hours after betting deadline
      const bettingDeadlineDate = new Date(formData.betting_deadline);
      const proofDeadlineDate = new Date(bettingDeadlineDate.getTime() + 24 * 60 * 60 * 1000); // 24 hours later
      
      // Deduct fee from internal PROOF balance
      const newProofBalance = (currentUserProfile.internal_balance_proof || 0) - creationFee;
      await UserProfile.update(currentUserProfile.id, { internal_balance_proof: newProofBalance });
      setUserProfile(prev => ({...prev, internal_balance_proof: newProofBalance})); // Update local state immediately

      const betData = {
        ...formData,
        creator_address: creatorAddress,
        minimum_bet_amount: parseFloat(formData.minimum_bet_amount),
        minimum_side_stake: parseFloat(formData.minimum_side_stake),
        minimum_total_stake: parseFloat(formData.minimum_total_stake),
        minimum_votes: parseInt(formData.minimum_votes),
        minimum_trust_score: parseInt(formData.minimum_trust_score),
        vote_stake_amount_proof: appSettings.vote_stake_amount_proof || 10, // Get from appSettings
        betting_deadline: formData.betting_deadline.toISOString(),
        proof_deadline: proofDeadlineDate.toISOString(),
        voting_deadline: formData.voting_deadline.toISOString(),
        status: "open_for_bets",
        platform_fee_proof: appSettings.bet_creation_fee_proof || 0 // Use PROOF fee
      };

      const newBet = await Bet.create(betData);
      
      // Update creator's trust score after successful bet creation
      await TrustScoreManager.calculateTrustScore(creatorAddress);
      
      navigate(createPageUrl("Dashboard"));
    } catch (error) {
      console.error("Bet creation failed:", error);
      // In a production environment, you might consider reverting the balance deduction if bet creation fails,
      // possibly through a backend transaction or a compensation mechanism.
      setError("Failed to create bet. Please check all fields and try again.");
    }
    setCreating(false);
  };

  if (!walletConnected) {
    return (
      <>
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
                  You need to connect your wallet to create prediction markets. This is required to:
                </p>
                <div className="text-left max-w-md mx-auto mb-8 space-y-2">
                  <div className="flex items-center gap-3 text-gray-300">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                    <span>Pay the platform creation fee (in PROOF tokens)</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-300">
                    <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                    <span>Establish yourself as the bet creator</span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-300">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span>Manage your active bets</span>
                  </div>
                </div>
                <Button 
                  onClick={() => setShowWalletModal(true)} 
                  className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white font-bold px-8 py-3"
                >
                  <Wallet className="w-5 h-5 mr-2" />
                  Connect Wallet to Continue
                </Button>
              </CardContent>
            </Card>
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

  return (
    <>
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
              <p className="text-gray-400 mt-1">
                Put your money where your mouth is and let others challenge you! 
                {!loadingSettings && (
                  <span className="ml-2 text-sm">
                      Active bets: {activeBetsCount}/{appSettings.max_active_bets_per_user}
                  </span>
                )}
              </p>
            </div>
            {/* Show connected wallet info */}
            <div className="flex items-center gap-3 p-2 bg-gray-800 rounded-lg border border-gray-700">
              <div className="w-8 h-8 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-full flex items-center justify-center">
                <Wallet className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white text-sm">Connected</p>
                <p className="text-xs text-gray-400 truncate">{walletAddress}</p>
              </div>
            </div>
          </div>

          {/* Active Bets Limit Warning */}
          {!loadingSettings && activeBetsCount >= (appSettings.max_active_bets_per_user - 1) && (
            <Alert variant={!canCreateBet ? "destructive" : "default"} className={`mb-6 ${!canCreateBet ? "bg-red-900/20 border-red-500/50" : "bg-yellow-900/20 border-yellow-500/50"}`}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className={`${!canCreateBet ? "text-red-200" : "text-yellow-200"}`}>
                {!canCreateBet 
                  ? `You have reached the maximum of ${appSettings.max_active_bets_per_user} active bets. Complete your existing bets to create new ones.`
                  : `You have ${activeBetsCount} active bets. You can create ${appSettings.max_active_bets_per_user - activeBetsCount} more.`
                }
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="mb-6 bg-red-900/20 border-red-500/50">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-red-200 flex items-center justify-between">
                <span>{error}</span>
                {error.includes("Insufficient") && (
                  <Button 
                    onClick={() => setShowDepositModal(true)}
                    size="sm" 
                    className="ml-4 bg-cyan-600 hover:bg-cyan-700 text-white"
                  >
                    Deposit Funds
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Propose a Bet</CardTitle>
              <div className="flex items-center justify-between">
                <p className="text-gray-400">
                  {canCreateBet 
                    ? "Create a prediction for others to bet on - you don't stake money, just provide the claim!"
                    : "You have reached your active bet limit. Complete existing bets to create new ones."
                  }
                </p>
                {userProfile && walletConnected && (
                  <div className="text-right space-y-2">
                    <div>
                      <p className="text-sm text-gray-400">USDC Balance:</p>
                      <p className="text-lg font-bold text-green-400">
                        ${(userProfile.internal_balance_usd || 0).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">PROOF Balance:</p>
                      <p className="text-lg font-bold text-purple-400">
                        {Math.floor(userProfile.internal_balance_proof || 0)} PROOF
                      </p>
                    </div>
                    <Button 
                      onClick={() => setShowDepositModal(true)}
                      size="sm" 
                      variant="outline"
                      className="mt-1 border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10"
                    >
                      + Deposit
                    </Button>
                  </div>
                )}
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
                    disabled={!canCreateBet || loadingSettings || !walletConnected}
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
                    disabled={!canCreateBet || loadingSettings || !walletConnected}
                  />
                </div>

                {/* Betting Parameters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6"> 
                  <div className="space-y-2">
                    <Label htmlFor="min_bet" className="text-gray-300">Minimum Individual Bet (USDC) *</Label>
                    <Input
                      id="min_bet"
                      type="number"
                      step="1"
                      min="1"
                      value={formData.minimum_bet_amount}
                      onChange={(e) => handleInputChange('minimum_bet_amount', e.target.value)}
                      placeholder="10"
                      required
                      className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                      disabled={!canCreateBet || loadingSettings || !walletConnected}
                    />
                  </div>
                  
                  {/* New Minimum Per Side Input */}
                  <div className="space-y-2">
                    <Label htmlFor="min_side" className="text-gray-300">Minimum Per Side (USDC) *</Label>
                    <Input
                      id="min_side"
                      type="number"
                      step="1"
                      min="1"
                      value={formData.minimum_side_stake}
                      onChange={(e) => handleInputChange('minimum_side_stake', e.target.value)}
                      placeholder="50"
                      required
                      className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                      disabled={!canCreateBet || loadingSettings || !walletConnected}
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
                      step="1"
                      min="1"
                      value={formData.minimum_total_stake}
                      onChange={(e) => handleInputChange('minimum_total_stake', e.target.value)}
                      placeholder="100"
                      required
                      className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                      disabled={!canCreateBet || loadingSettings || !walletConnected}
                    />
                    <p className="text-sm text-gray-400">
                      Total amount needed from all bettors combined
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="min_votes" className="text-gray-300">Minimum Public Votes *</Label>
                    <Input
                      id="min_votes"
                      type="number"
                      min="1"
                      value={formData.minimum_votes}
                      onChange={(e) => handleInputChange('minimum_votes', e.target.value)}
                      placeholder="5"
                      required
                      className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                      disabled={!canCreateBet || loadingSettings || !walletConnected}
                    />
                    <p className="text-sm text-gray-400">
                      Minimum votes from neutral observers to resolve bet
                    </p>
                  </div>

                  {/* New Minimum Trust Score Input */}
                  <div className="space-y-2">
                    <Label htmlFor="min_trust" className="text-gray-300">Minimum Trust Score (0-100)</Label>
                    <Input
                      id="min_trust"
                      type="number"
                      min="0"
                      max="100"
                      value={formData.minimum_trust_score}
                      onChange={(e) => handleInputChange('minimum_trust_score', e.target.value)}
                      placeholder="0"
                      className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                      disabled={!canCreateBet || loadingSettings || !walletConnected}
                    />
                    <p className="text-sm text-gray-400">
                      Only users with this trust score or higher can participate (0 = everyone)
                    </p>
                  </div>
                  
                  {/* VOTE STAKE AMOUNT IS NOW CENTRALIZED IN ADMIN SETTINGS, REMOVED FROM FORM */}
                  <div className="space-y-2">
                    <Label className="text-gray-300">Vote Stake Amount (PROOF)</Label>
                    <Input
                      type="text"
                      value={appSettings.vote_stake_amount_proof || 'N/A'}
                      readOnly
                      className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 opacity-70 cursor-not-allowed"
                    />
                    <p className="text-sm text-gray-400">
                      PROOF tokens voters must stake to cast votes (set by admin)
                    </p>
                  </div>
                </div>

                {/* Category and Proof Type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-gray-300">Category *</Label>
                    <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)} required disabled={!canCreateBet || loadingSettings || !walletConnected}>
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
                    <Select value={formData.proof_type} onValueChange={(value) => handleInputChange('proof_type', value)} required disabled={!canCreateBet || loadingSettings || !walletConnected}>
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
                          disabled={!canCreateBet || loadingSettings || !walletConnected}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.betting_deadline ? format(formData.betting_deadline, 'PPP') : 'Select deadline'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-gray-700 border-gray-600" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.betting_deadline}
                          onSelect={(date) => handleInputChange('betting_deadline', date)}
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
                          disabled={!canCreateBet || loadingSettings || !walletConnected}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {formData.voting_deadline ? format(formData.voting_deadline, 'PPP') : 'Select deadline'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-gray-700 border-gray-600" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.voting_deadline}
                          onSelect={(date) => handleInputChange('voting_deadline', date)}
                          disabled={(date) => date < new Date()}
                          className="text-white"
                        />
                      </PopoverContent>
                    </Popover>
                    <p className="text-sm text-gray-400">
                      When participants must vote on the outcome
                    </p>
                  </div>
                </div>

                {/* Proof Upload Preview */}
                {formData.proof_type && (
                  <Card className="bg-gray-700 border-gray-600">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        {formData.proof_type === 'video' && <Video className="w-5 h-5" />}
                        {formData.proof_type === 'live_stream' && <Camera className="w-5 h-5" />}
                        {formData.proof_type === 'photo' && <Upload className="w-5 h-5" />}
                        {formData.proof_type === 'video' ? 'Video Proof' : 
                        formData.proof_type === 'live_stream' ? 'Live Stream Setup' : 'Photo Evidence'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {formData.proof_type === 'live_stream' ? (
                        <p className="text-gray-400">You'll be able to set up live streaming once the bet is created and voting begins.</p>
                      ) : (
                        <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center">
                          <p className="text-gray-400 mb-2">Upload your proof here (optional for now)</p>
                          <input
                            type="file"
                            accept={formData.proof_type === 'video' ? 'video/*' : 'image/*'}
                            onChange={(e) => e.target.files[0] && handleFileUpload(e.target.files[0])}
                            className="hidden"
                            id="proof-upload"
                            disabled={!canCreateBet || loadingSettings || !walletConnected}
                          />
                          <Label htmlFor="proof-upload">
                            <Button type="button" variant="outline" disabled={uploading || !canCreateBet || loadingSettings || !walletConnected} className="border-gray-600 text-gray-300 hover:bg-gray-600">
                              {uploading ? 'Uploading...' : 'Choose File'}
                            </Button>
                          </Label>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Submit Button */}
                <div className="space-y-4">
                  <Alert className="bg-blue-900/20 border-blue-500/50">
                      <Info className="h-4 w-4 text-blue-300" />
                      <AlertDescription className="text-blue-200">
                          A platform fee of <strong>{(appSettings.bet_creation_fee_proof || 0)} PROOF tokens</strong> will be charged to create this prediction market. This fee supports the platform's operation.
                      </AlertDescription>
                  </Alert>

                  <Button
                    type="submit"
                    disabled={creating || !canCreateBet || loadingSettings || !walletConnected}
                    className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white font-semibold py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {!walletConnected ? 'Connect Wallet to Continue' :
                     loadingSettings ? 'Loading Settings...' :
                     creating ? 'Creating Bet...' : 
                     !canCreateBet ? `Active Bet Limit Reached (${activeBetsCount}/${appSettings.max_active_bets_per_user})` :
                     `Create Market & Pay ${(appSettings.bet_creation_fee_proof || 0)} PROOF`}
                  </Button>
                </div>

                {!canCreateBet && (
                  <div className="text-center mt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate(createPageUrl("MyBets"))} // Assuming "MyBets" is a valid route to view user's bets
                      className="border-gray-600 text-gray-300 hover:bg-gray-700"
                    >
                      View My Active Bets
                    </Button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
      <WalletConnectionModal
        isOpen={showWalletModal}
        onClose={() => setShowWalletModal(false)}
        onConnect={handleWalletConnect}
      />
      <DepositModal 
        isOpen={showDepositModal} 
        onClose={() => setShowDepositModal(false)} 
        onDeposit={handleDeposit} 
        currentUsdBalance={userProfile?.internal_balance_usd || 0}
        currentProofBalance={userProfile?.internal_balance_proof || 0}
      />
    </>
  );
}
