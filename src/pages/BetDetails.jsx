import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Wallet, AlertCircle, Loader2, RefreshCw, Lock, Users, UserCheck, UserX, Clock, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createPageUrl } from "@/utils";

import BetDetailHeader from "../components/betting/BetDetailHeader";
import BetStats from "../components/betting/BetStats";
import VotingPanel from "../components/betting/VotingPanel";
import ProofPanel from "../components/betting/ProofPanel";
import BetResolution from "../components/betting/BetResolution";
import BetCancellation from "../components/betting/BetCancellation";
import TabbedInfoPanel from "../components/betting/TabbedInfoPanel";
import ClaimPanel from "../components/betting/ClaimPanel"; // Import new component

import { 
    getBetContract, 
    getBetFactoryContract,
    connectWallet,
    getConnectedAddress,
} from "../components/blockchain/contracts";

const STATUS_ENUM = { OPEN_FOR_BETS: 0, AWAITING_PROOF: 1, VOTING: 2, COMPLETED: 3, CANCELLED: 4 };
const ON_CHAIN_STATUS_MAP = {
  0: "open_for_bets",
  1: "awaiting_proof",
  2: "voting",
  3: "completed",
  4: "cancelled",
};

const CATEGORY_MAP = {
  0: "Unknown",
  1: "Crypto",
  2: "Sports",
  3: "Politics",
  4: "Finance",
  5: "Entertainment",
  6: "Personal",
  7: "Other"
};

const PROOF_TYPE_MAP = {
  0: "Unknown",
  1: "Video",
  2: "Live Stream",
  3: "Document",
  4: "Oracle",
  5: "Other"
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

export default function BetDetails() {
  const navigate = useNavigate();
  const location = useLocation();
  const [bet, setBet] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [votes, setVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [walletAddress, setWalletAddress] = useState(null);
  const [isCreator, setIsCreator] = useState(false);
  const [appSettings, setAppSettings] = useState(null);
  const [isProcessingTx, setIsProcessingTx] = useState(false);
  const [isPrivateBet, setIsPrivateBet] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [joinRequested, setJoinRequested] = useState(false);
  const [joinApproved, setJoinApproved] = useState(false);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [isJoinTxPending, setIsJoinTxPending] = useState(false);
  const [autoApprove, setAutoApproveState] = useState(false);
  const [maxAutoApprove, setMaxAutoApproveState] = useState(0);
  const [autoApprovedCount, setAutoApprovedCount] = useState(0);
  const [joinKeyHash, setJoinKeyHash] = useState(null);
  const [acceptingParticipants, setAcceptingParticipants] = useState(true);
  const [joinBlacklisted, setJoinBlacklisted] = useState(false);
  const [joinKeyInput, setJoinKeyInput] = useState("");
  const [creatorJoinKey, setCreatorJoinKey] = useState(""); // plaintext key shown to creator
  const [showJoinKey, setShowJoinKey] = useState(false);
  
  const betAddress = new URLSearchParams(location.search).get("address");
  const effectiveStatus = useMemo(() => getEffectiveStatus(bet), [bet]);

  const loadAppSettings = useCallback(async () => {
    try {
      const factory = getBetFactoryContract();
      const [voteStakeAmount, voterRewardPercentage, platformFeePercentage] = await Promise.all([
        factory.voteStakeAmountProof(),
        factory.defaultVoterRewardPercentage(),
        factory.defaultPlatformFeePercentage()
      ]);

      setAppSettings({
        vote_stake_amount_proof: parseFloat(ethers.formatEther(voteStakeAmount)),
        voter_reward_percentage: Number(voterRewardPercentage),
        platform_fee_percentage: Number(platformFeePercentage)
      });
    } catch (error) {
      console.error("Error loading app settings:", error);
    }
  }, []);

  const loadBetDetails = useCallback(async (address) => {
    if (!address) {
      setError("No bet address provided.");
      setLoading(false);
      return;
    }
    if(!bet) setLoading(true);
    setError("");

    try {
      const betContract = getBetContract(address);
      const connectedAddr = await getConnectedAddress();
      
      const [
        onChainStatusRaw,
        info,
        details,
        creatorAddress,
        winningSideRaw,
        betPlacedEvents,
        voteCastEvents,
      ] = await Promise.all([betContract.currentStatus(),
        betContract.getBetInfo(),
        betContract.details(),
        betContract.creator(),
        betContract.outcomeSide(),
        betContract.queryFilter(betContract.filters.BetPlaced()),
        betContract.queryFilter(betContract.filters.VoteCast()),
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

      // CORRECTED LOGIC: Create a flat list of all participation records from events.
      const participantsList = betPlacedEvents.map(event => {
        const { user, position, amountUsdc } = event.args;
        return {
          id: event.transactionHash + event.logIndex, // Unique key for each bet
          participant_address: user,
          position: Number(position) === 1 ? 'yes' : 'no',
          stake_amount_usd: parseFloat(ethers.formatUnits(amountUsdc, 6)),
        };
      });
      setParticipants(participantsList);

      const votersList = voteCastEvents.map(event => ({
          id: event.transactionHash,
          address: event.args.voter,
          vote: Number(event.args.vote) === 1 ? 'yes' : Number(event.args.vote) === 2 ? 'no' : 'invalid',
      }));
      setVotes(votersList);
      
      const onChainStatus = ON_CHAIN_STATUS_MAP[Number(onChainStatusRaw)];

      const betData = {
        address: address,
        creator_address: creatorAddress,
        title: title,
        description: description,
        bettingDeadline: Number(bettingDeadline),
        proofDeadline: Number(proofDeadline),
        votingDeadline: Number(votingDeadline),
        minimum_bet_amount: parseFloat(ethers.formatUnits(details.minimumBetAmount, 6)),
        minimum_side_stake: parseFloat(ethers.formatUnits(details.minimumSideStake, 6)),
        minimum_trust_score: Number(details.minimumTrustScore),
        minimum_votes: Number(details.minimumVotes),
        onChainStatus: onChainStatus,
        total_yes_stake_usd: parseFloat(ethers.formatUnits(totalYes, 6)),
        total_no_stake_usd: parseFloat(ethers.formatUnits(totalNo, 6)),
        proofUrl: proofUrl,
        winning_side: Number(winningSideRaw) === 1 ? 'yes' : Number(winningSideRaw) === 2 ? 'no' : Number(winningSideRaw) === 3 ? 'invalid' : null,
        participants_count: Number(participantCount),
        voters_count: Number(voterCount),
        category: CATEGORY_MAP[Number(details.category)] || 'Other',
        proof_type: PROOF_TYPE_MAP[Number(details.proofType)] || 'Other',
      };
      // ─── Private bet handling ────────────────────────────────────────
      const betIsPrivate = await betContract.isPrivate();
      if (betIsPrivate) {
        setIsPrivateBet(true);
        const [aa, mac, aac, jkh, ap] = await Promise.all([
          betContract.autoApprove(),
          betContract.maxAutoApprove(),
          betContract.autoApprovedCount(),
          betContract.joinKeyHash(),
          betContract.acceptingParticipants(),
        ]);
        setAutoApproveState(aa);
        setMaxAutoApproveState(Number(mac));
        setAutoApprovedCount(Number(aac));
        setJoinKeyHash(jkh);
        setAcceptingParticipants(ap);
        // Load the key from localStorage for the creator
        if (jkh && jkh !== ethers.ZeroHash && connectedAddr &&
            creatorAddress.toLowerCase() === connectedAddr.toLowerCase()) {
          const stored = localStorage.getItem(`joinKey:${address.toLowerCase()}`);
          if (stored) setCreatorJoinKey(stored);
        }
        if (connectedAddr) {
          const [registered, requested, approved, blacklisted] = await Promise.all([
            betContract.isRegistered(connectedAddr),
            betContract.joinRequested(connectedAddr),
            betContract.joinApproved(connectedAddr),
            betContract.joinBlacklisted(connectedAddr),
          ]);
          setIsRegistered(registered);
          setJoinRequested(requested);
          setJoinApproved(approved);
          setJoinBlacklisted(blacklisted);
        }
        // If creator: load pending join requests from events
        if (connectedAddr && creatorAddress.toLowerCase() === connectedAddr.toLowerCase()) {
          const joinEvents = await betContract.queryFilter(betContract.filters.JoinRequested());
          const pending = [];
          for (const ev of joinEvents) {
            const addr = ev.args.participant;
            const req = await betContract.joinRequested(addr);
            const reg = await betContract.isRegistered(addr);
            if (req && !reg) pending.push(addr);
          }
          setPendingRequests(pending);
        }
      }
      // ────────────────────────────────────────────────────────────────

      setBet(betData);
      setWalletAddress(connectedAddr);
      setIsCreator(connectedAddr && creatorAddress.toLowerCase() === connectedAddr.toLowerCase());

    } catch (err) {
      console.error("Error loading bet details from blockchain:", err);
      setError("Failed to load bet details. The contract may not exist or there's a network issue.");
    } finally {
      setLoading(false);
    }
  }, [bet]);

  useEffect(() => {
    loadBetDetails(betAddress);
    loadAppSettings();

    // Set up event listeners for real-time updates
    if (!betAddress) return;

    const betContract = getBetContract(betAddress);
    
    const handleBetPlaced = (user, position, amountUsdc, event) => {
      console.log("BetPlaced event:", user, position, amountUsdc);
      loadBetDetails(betAddress);
    };

    const handleVoteCast = (voter, vote, event) => {
      console.log("VoteCast event:", voter, vote);
      loadBetDetails(betAddress);
    };

    betContract.on("BetPlaced", handleBetPlaced);
    betContract.on("VoteCast", handleVoteCast);

    // Cleanup listeners on unmount
    return () => {
      betContract.off("BetPlaced", handleBetPlaced);
      betContract.off("VoteCast", handleVoteCast);
    };
  }, [betAddress, loadBetDetails, loadAppSettings]);

  const handleProofSubmit = async (proofUrl) => {
    try {
      const betContract = getBetContract(bet.address, true);
      setIsProcessingTx(true);
      const tx = await betContract.submitProof(proofUrl);
      await tx.wait();
      loadBetDetails(betAddress);
    } catch (err) {
      console.error("Failed to submit proof:", err);
      setError(err.reason || "Failed to submit proof.");
    } finally {
      setIsProcessingTx(false);
    }
  };

  const handleRequestToJoin = async () => {
    if (!joinKeyInput.trim()) {
      setError("Enter the join key provided by the creator.");
      return;
    }
    setIsJoinTxPending(true);
    try {
      const betContract = getBetContract(betAddress, true);
      const tx = await betContract.requestToJoin(joinKeyInput.trim());
      await tx.wait();
      setJoinRequested(true);
      if (autoApprove) setIsRegistered(true); // auto-approve registers immediately
      setJoinKeyInput("");
    } catch (err) {
      setError(err.reason || err.message || "Failed to request to join.");
    } finally {
      setIsJoinTxPending(false);
    }
  };

  const handleToggleAccepting = async () => {
    try {
      const betContract = getBetContract(betAddress, true);
      const tx = await betContract.setAcceptingParticipants(!acceptingParticipants);
      await tx.wait();
      setAcceptingParticipants(!acceptingParticipants);
    } catch (err) {
      setError(err.reason || err.message || "Failed to update participant acceptance.");
    }
  };

  const handleRegister = async () => {
    setIsJoinTxPending(true);
    try {
      const betContract = getBetContract(betAddress, true);
      const tx = await betContract.register();
      await tx.wait();
      setIsRegistered(true);
    } catch (err) {
      setError(err.reason || "Failed to register.");
    } finally {
      setIsJoinTxPending(false);
    }
  };

  const handleApprove = async (participant) => {
    setIsJoinTxPending(true);
    try {
      const betContract = getBetContract(betAddress, true);
      const tx = await betContract.approveParticipant(participant);
      await tx.wait();
      setPendingRequests(prev => prev.filter(a => a !== participant));
    } catch (err) {
      setError(err.reason || "Failed to approve participant.");
    } finally {
      setIsJoinTxPending(false);
    }
  };

  const handleReject = async (participant) => {
    setIsJoinTxPending(true);
    try {
      const betContract = getBetContract(betAddress, true);
      const tx = await betContract.rejectParticipant(participant);
      await tx.wait();
      setPendingRequests(prev => prev.filter(a => a !== participant));
    } catch (err) {
      setError(err.reason || "Failed to reject participant.");
    } finally {
      setIsJoinTxPending(false);
    }
  };

  const handleApproveAll = async () => {
    setIsJoinTxPending(true);
    try {
      const betContract = getBetContract(betAddress, true);
      const tx = await betContract.approveAllParticipants(pendingRequests);
      await tx.wait();
      setPendingRequests([]);
    } catch (err) {
      setError(err.reason || "Failed to approve all.");
    } finally {
      setIsJoinTxPending(false);
    }
  };

  const handleRejectAll = async () => {
    setIsJoinTxPending(true);
    try {
      const betContract = getBetContract(betAddress, true);
      const tx = await betContract.rejectAllParticipants(pendingRequests);
      await tx.wait();
      setPendingRequests([]);
    } catch (err) {
      setError(err.reason || "Failed to reject all.");
    } finally {
      setIsJoinTxPending(false);
    }
  };

  const handleKeeperAction = async () => {
    if (!bet) return;
    setIsProcessingTx(true);
    setError("");

    try {
        const betContract = getBetContract(bet.address, true);
        let tx;
        // Determine the action based on onChainStatus not effectiveStatus
        // The keeper actions are directly tied to the smart contract's state transitions
        // and its specific functions, not the UI's effective status.
        if (bet.onChainStatus === 'open_for_bets') {
            tx = await betContract.checkAndCloseBetting();
        } else if (bet.onChainStatus === 'awaiting_proof') {
            tx = await betContract.checkAndCancelForNoProof();
        } else if (bet.onChainStatus === 'voting') {
            tx = await betContract.checkAndResolve();
        }
        
        if(tx) {
          await tx.wait();
          // Wait a bit for the blockchain to update before reloading
          setTimeout(() => loadBetDetails(betAddress), 1000);
        }

    } catch (err) {
        console.error("Keeper action failed:", err);
        setError(err.reason || "Failed to update the market status.");
    } finally {
        setIsProcessingTx(false);
    }
  };

  const handleSetAutoApprove = async (enabled, max) => {
    setIsJoinTxPending(true);
    try {
      const betContract = getBetContract(betAddress, true);
      const tx = await betContract.setAutoApprove(enabled, max);
      await tx.wait();
      setAutoApproveState(enabled);
      setMaxAutoApproveState(max);
    } catch (err) {
      setError(err.reason || "Failed to update auto-approve setting.");
    } finally {
      setIsJoinTxPending(false);
    }
  };

  const KeeperButton = () => {
      if (!bet || isProcessingTx) return null;
      
      const now = Date.now();
      const bettingDeadline = bet.bettingDeadline * 1000;
      const proofDeadline = bet.proofDeadline * 1000;
      const votingDeadline = bet.votingDeadline * 1000;
      
      let keeperText = "";
      let showButton = false;

      // Only show keeper button if the on-chain status is behind the real-world time progression
      if (bet.onChainStatus === 'open_for_bets' && now > bettingDeadline) {
          keeperText = "Close Betting Period";
          showButton = true;
      } else if (bet.onChainStatus === 'awaiting_proof' && now > proofDeadline && !bet.proofUrl) {
          keeperText = "Finalize Cancellation (No Proof)";
          showButton = true;
      } else if (bet.onChainStatus === 'voting' && now > votingDeadline) {
          keeperText = "Resolve Market & Distribute Funds";
          showButton = true;
      }

      if (showButton) {
          return (
              <Card className="bg-yellow-900/30 border-yellow-500/40">
                  <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                      <div>
                          <h4 className="font-semibold text-yellow-300">Action Required</h4>
                          <p className="text-sm text-yellow-400">This market's deadline has passed. It needs a manual update to proceed.</p>
                      </div>
                      <Button onClick={handleKeeperAction} disabled={isProcessingTx} className="bg-yellow-500 hover:bg-yellow-600 text-black">
                          {isProcessingTx ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                          {keeperText}
                      </Button>
                  </CardContent>
              </Card>
          );
      }
      
      return null;
  };
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 p-6 flex items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-cyan-500" />
      </div>
    );
  }


  if (error || !bet) {
    return (
      <div className="min-h-screen bg-gray-900 p-6 text-center flex flex-col items-center justify-center">
        <div className="max-w-md mx-auto space-y-4">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto" />
          <h2 className="2xl font-bold text-red-400 mb-4">Market Not Found</h2>
          <p className="text-gray-300 mb-6">{error || "Could not find a bet at this address."}</p>
          <Button onClick={() => navigate(createPageUrl("Dashboard"))} className="bg-cyan-600">
              View Active Markets
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          <Button
            variant="outline"
            onClick={() => navigate(createPageUrl("Dashboard"))}
            className="flex items-center gap-2 border-gray-700 bg-gray-800 hover:bg-gray-700 text-gray-300"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Markets
          </Button>

          <KeeperButton />

          {/* Private bet banner */}
          {isPrivateBet && (
            <Card className="bg-purple-900/30 border-purple-700/50">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Lock className="w-5 h-5 text-purple-400 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-purple-200 font-medium text-sm">Private Bet</p>
                    <p className="text-purple-400 text-xs">
                      {isCreator
                        ? joinKeyHash && joinKeyHash !== ethers.ZeroHash
                          ? "Key-protected — share the join key with your audience."
                          : "You created this private bet. Approve participants from the list below."
                        : isRegistered
                          ? "You are registered and can participate."
                          : joinApproved
                            ? "You have been approved! Click Register to join."
                            : joinRequested
                              ? "Your join request is pending creator approval."
                              : joinKeyHash && joinKeyHash !== ethers.ZeroHash
                                ? "This bet requires a join key. Enter it below to join instantly."
                                : "Request to join — the creator must approve you before you can participate."}
                    </p>
                  </div>
                </div>

                {/* Creator: show join key if key-protected */}
                {isCreator && joinKeyHash && joinKeyHash !== ethers.ZeroHash && (
                  <div className="flex items-center gap-2 p-2 bg-purple-800/30 border border-purple-600/40 rounded-md">
                    <span className="text-xs text-purple-300 font-medium flex-shrink-0">Join key:</span>
                    <code className={`flex-1 text-xs font-mono ${showJoinKey ? "text-yellow-300" : "text-transparent select-none bg-purple-400/20 rounded"}`}>
                      {creatorJoinKey || "stored locally — open from the same browser you created it in"}
                    </code>
                    {creatorJoinKey && (
                      <button
                        onClick={() => setShowJoinKey(v => !v)}
                        className="text-xs text-purple-400 hover:text-purple-200 flex-shrink-0 underline"
                      >
                        {showJoinKey ? "hide" : "show"}
                      </button>
                    )}
                  </div>
                )}

                {/* Non-creator: action buttons */}
                {walletAddress && !isCreator && (
                  <div className="flex gap-2 flex-wrap items-end">
                    {joinBlacklisted && (
                      <div className="flex items-center gap-2 text-xs text-red-400">
                        <UserX className="w-4 h-4" />
                        Your join request was rejected by the creator.
                      </div>
                    )}
                    {!isRegistered && !joinRequested && !joinBlacklisted && (
                      <>
                        <Input
                          placeholder="Enter join key…"
                          value={joinKeyInput}
                          onChange={(e) => setJoinKeyInput(e.target.value)}
                          className="bg-purple-900/50 border-purple-600 text-white placeholder-purple-400 h-8 text-sm w-48"
                        />
                        <Button
                          size="sm"
                          onClick={handleRequestToJoin}
                          disabled={isJoinTxPending || !acceptingParticipants}
                          className="bg-purple-700 hover:bg-purple-600 text-white"
                        >
                          {isJoinTxPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Users className="w-4 h-4 mr-1" />}
                          Join with Key
                        </Button>
                      </>
                    )}
                    {joinRequested && !joinApproved && !isRegistered && (
                      <div className="flex items-center gap-2 text-xs text-yellow-300">
                        <Clock className="w-4 h-4" />
                        Waiting for creator approval…
                      </div>
                    )}
                    {joinApproved && !isRegistered && (
                      <Button
                        size="sm"
                        onClick={handleRegister}
                        disabled={isJoinTxPending}
                        className="bg-green-700 hover:bg-green-600 text-white"
                      >
                        {isJoinTxPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <UserCheck className="w-4 h-4 mr-1" />}
                        Register
                      </Button>
                    )}
                  </div>
                )}

                {/* Creator: pending requests */}
                {isCreator && pendingRequests.length > 0 && (
                  <div className="space-y-2 pt-1 border-t border-purple-700/40">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-purple-300 font-medium">Pending join requests ({pendingRequests.length}):</p>
                      {pendingRequests.length > 1 && (
                        <div className="flex gap-1">
                          <Button size="sm" onClick={handleApproveAll} disabled={isJoinTxPending}
                            className="bg-green-800 hover:bg-green-700 text-white h-6 px-2 text-xs">
                            <UserCheck className="w-3 h-3 mr-1" /> Accept All
                          </Button>
                          <Button size="sm" onClick={handleRejectAll} disabled={isJoinTxPending}
                            className="bg-red-900 hover:bg-red-800 text-white h-6 px-2 text-xs">
                            <UserX className="w-3 h-3 mr-1" /> Reject All
                          </Button>
                        </div>
                      )}
                    </div>
                    {pendingRequests.map(addr => (
                      <div key={addr} className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-mono text-gray-300 truncate">{addr}</span>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(addr)}
                            disabled={isJoinTxPending}
                            className="bg-green-800 hover:bg-green-700 text-white h-6 px-2 text-xs"
                          >
                            <UserCheck className="w-3 h-3 mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleReject(addr)}
                            disabled={isJoinTxPending}
                            className="bg-red-900 hover:bg-red-800 text-white h-6 px-2 text-xs"
                          >
                            <UserX className="w-3 h-3 mr-1" /> Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {isCreator && pendingRequests.length === 0 && !autoApprove && (
                  <p className="text-xs text-purple-400/70">No pending join requests.</p>
                )}

                {/* Accepting participants status */}
                <div className={`flex items-center justify-between p-2 rounded-md ${acceptingParticipants ? "bg-green-900/20 border border-green-700/40" : "bg-red-900/20 border border-red-700/40"}`}>
                  <span className={`text-xs font-medium ${acceptingParticipants ? "text-green-300" : "text-red-300"}`}>
                    {acceptingParticipants ? "Accepting new participants" : "Not accepting new participants"}
                  </span>
                  {isCreator && (
                    <button
                      onClick={handleToggleAccepting}
                      className={`text-xs underline flex-shrink-0 ml-2 ${acceptingParticipants ? "text-red-400 hover:text-red-200" : "text-green-400 hover:text-green-200"}`}
                    >
                      {acceptingParticipants ? "Close" : "Open"}
                    </button>
                  )}
                </div>

                {/* Creator: auto-approve controls */}
                {isCreator && (
                  <div className="pt-2 border-t border-purple-700/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Zap className={`w-3.5 h-3.5 ${autoApprove ? 'text-yellow-400' : 'text-gray-500'}`} />
                        <span className="text-xs text-white font-medium">Auto-approve</span>
                        {autoApprove && maxAutoApprove > 0 && (
                          <span className="text-xs text-gray-400">
                            ({autoApprovedCount}/{maxAutoApprove} used)
                          </span>
                        )}
                        {autoApprove && maxAutoApprove === 0 && (
                          <span className="text-xs text-gray-400">(unlimited)</span>
                        )}
                      </div>
                      <Switch
                        checked={autoApprove}
                        onCheckedChange={(v) => handleSetAutoApprove(v, maxAutoApprove)}
                        disabled={isJoinTxPending}
                        className="scale-75"
                      />
                    </div>
                    {autoApprove && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 flex-shrink-0">Cap:</span>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0 = unlimited"
                          defaultValue={maxAutoApprove || ""}
                          onBlur={(e) => {
                            const v = parseInt(e.target.value) || 0;
                            if (v !== maxAutoApprove) handleSetAutoApprove(true, v);
                          }}
                          className="h-6 text-xs bg-gray-800 border-gray-600 text-white px-2 w-32"
                        />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <BetDetailHeader bet={{ ...bet, effectiveStatus }} />
          
          <ClaimPanel 
            bet={{...bet, effectiveStatus}}
            participants={participants}
            votes={votes}
            walletAddress={walletAddress}
            loadBetDetails={() => loadBetDetails(betAddress)}
          />

          {effectiveStatus === 'completed' && (
            <BetResolution bet={bet} participants={participants} votes={votes} appSettings={appSettings}/>
          )}

          {effectiveStatus === 'cancelled' && (
            <BetCancellation 
              bet={{...bet, effectiveStatus}}
              participants={participants}
              walletAddress={walletAddress}
              loadBetDetails={() => loadBetDetails(betAddress)}
            />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            <div className="lg:col-span-2 space-y-8">
              <ProofPanel
                bet={{ ...bet, effectiveStatus }}
                isCreator={isCreator}
                onProofSubmit={handleProofSubmit}
              />
              <TabbedInfoPanel 
                bet={{ ...bet, effectiveStatus }}
                participants={participants}
                votes={votes}
                walletAddress={walletAddress}
                walletConnected={!!walletAddress}
                onRequestWalletConnect={connectWallet}
              />
            </div>

            <div className="space-y-8 lg:sticky lg:top-28">
              <BetStats bet={bet} votes={votes} />
              {(effectiveStatus === 'open_for_bets' || effectiveStatus === 'voting') && (
                <VotingPanel
                  bet={{ ...bet, effectiveStatus }}
                  participants={participants}
                  votes={votes}
                  appSettings={appSettings}
                  walletConnected={!!walletAddress}
                  walletAddress={walletAddress}
                  onRequestWalletConnect={connectWallet}
                  loadBetDetails={() => loadBetDetails(betAddress)}
                  isProcessingTx={isProcessingTx}
                  isPrivateBet={isPrivateBet}
                  isRegistered={isRegistered}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}