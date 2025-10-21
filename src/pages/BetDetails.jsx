
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wallet, AlertCircle, Loader2, RefreshCw } from "lucide-react";
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
        betContract.winningSide(),
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
          vote: Number(event.args.vote) === 1 ? 'yes' : 'no',
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
        winning_side: Number(winningSideRaw) === 1 ? 'yes' : Number(winningSideRaw) === 2 ? 'no' : null,
        participants_count: Number(participantCount),
        voters_count: Number(voterCount),
        category: 'other', 
        proof_type: 'video',
      };
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
            tx = await betContract.checkAndCancelForProof();
        } else if (bet.onChainStatus === 'voting') {
            tx = await betContract.checkAndResolve();
        }
        
        if(tx) {
          await tx.wait();
          loadBetDetails(betAddress);
        }

    } catch (err) {
        console.error("Keeper action failed:", err);
        setError(err.reason || "Failed to update the market status.");
    } finally {
        setIsProcessingTx(false);
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
            <BetCancellation bet={bet} participants={participants} />
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
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
