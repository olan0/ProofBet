import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wallet, Plus, AlertCircle, Coins, DollarSign, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createPageUrl } from "@/utils";

import BetDetailHeader from "../components/betting/BetDetailHeader";
import BetStats from "../components/betting/BetStats";
import VotingPanel from "../components/betting/VotingPanel";
import ProofPanel from "../components/betting/ProofPanel";
import ParticipantsList from "../components/betting/ParticipantsList";
import VoteHistory from "../components/betting/VoteHistory";
import BetResolution from "../components/betting/BetResolution";
import BetCancellation from "../components/betting/BetCancellation";

import { 
    getBetContract, 
    getBetFactoryContract,
    getUsdcTokenContract, 
    getProofTokenContract,
    getConnectedAddress, 
    connectWallet
} from "../components/blockchain/contracts";

const STATUS_MAP = ["OPEN_FOR_BETS", "AWAITING_PROOF", "VOTING", "COMPLETED", "CANCELLED"];

// Helper function to convert contract status to frontend format
const convertStatusToFrontend = (contractStatus) => {
  const statusMapping = {
    "OPEN_FOR_BETS": "open_for_bets",
    "AWAITING_PROOF": "betting_closed", 
    "VOTING": "voting",
    "COMPLETED": "completed",
    "CANCELLED": "cancelled"
  };
  return statusMapping[contractStatus] || "unknown";
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
  
  const betRef = useRef(bet);
  betRef.current = bet;
  
  const betAddress = new URLSearchParams(location.search).get("address");

  // NEW: Load app settings from BetFactory contract
  const loadAppSettings = useCallback(async () => {
    try {
      const factory = getBetFactoryContract();
      const [voteStakeAmount, voterRewardPercentage] = await Promise.all([
        factory.voteStakeAmountProof(),
        factory.defaultVoterRewardPercentage()
      ]);

      setAppSettings({
        vote_stake_amount_proof: parseFloat(ethers.formatEther(voteStakeAmount)),
        voter_reward_percentage: Number(voterRewardPercentage)
      });
    } catch (error) {
      console.error("Error loading app settings:", error);
      // Set fallback values
      setAppSettings({
        vote_stake_amount_proof: 10,
        voter_reward_percentage: 5
      });
    }
  }, []);

  const loadBetDetails = useCallback(async (address) => {
    if (!address) {
      setError("No bet address provided.");
      setLoading(false);
      return;
    }

    // Only show full-page loader on initial load (when betRef is null)
    if (!betRef.current) {
        setLoading(true);
    }
    setError("");

    try {
      const betContract = getBetContract(address);
      
      const [
        details,
        currentStatus,
        totalYesStake,
        totalNoStake,
        proofUrl,
        winningSide,
        betPlacedEvents,
        voteCastEvents,
      ] = await Promise.all([
        betContract.details(),
        betContract.currentStatus(),
        betContract.totalYesStake(),
        betContract.totalNoStake(),
        betContract.proofUrl(),
        betContract.winningSide(),
        betContract.queryFilter(betContract.filters.BetPlaced()),
        betContract.queryFilter(betContract.filters.VoteCast()),
      ]);

      // Process events to build participant and voter lists
      const participantsAggregated = {};
      betPlacedEvents.forEach(event => {
        const { user, position, amountUsdc } = event.args;
        const userAddress = user;
        const stake = parseFloat(ethers.formatUnits(amountUsdc, 6));
        const side = Number(position) === 1 ? 'yes' : 'no';

        const key = `${userAddress}-${side}`;
        if (!participantsAggregated[key]) {
          participantsAggregated[key] = {
            id: key,
            participant_address: userAddress,
            position: side,
            stake_amount_usd: 0,
          };
        }
        participantsAggregated[key].stake_amount_usd += stake;
      });
      const participantsList = Object.values(participantsAggregated);
      setParticipants(participantsList);

      const votersList = voteCastEvents.map((event, index) => {
        const { voter, vote, amountProof } = event.args;
        return {
          id: event.transactionHash + index,
          voter_address: voter,
          vote: Number(vote) === 1 ? 'yes' : 'no',
          stake_amount_proof: parseFloat(ethers.formatEther(amountProof)),
          created_date: new Date().toISOString(), // Event timestamp is not easily available
        };
      });
      setVotes(votersList);
      
      const connectedAddr = await getConnectedAddress();
      const contractStatusString = STATUS_MAP[Number(currentStatus)];

      const betData = {
        address: address,
        creator_address: details.creator,
        title: details.title,
        description: details.description,
        betting_deadline: new Date(Number(details.bettingDeadline) * 1000).toISOString(),
        proof_deadline: new Date(Number(details.proofDeadline) * 1000).toISOString(),
        voting_deadline: new Date(Number(details.votingDeadline) * 1000).toISOString(),
        minimum_bet_amount_usd: ethers.formatUnits(details.minimumBetAmount, 6),
        minimum_bet_amount: parseFloat(ethers.formatUnits(details.minimumBetAmount, 6)),
        minimum_side_stake: parseFloat(ethers.formatUnits(details.minimumSideStake, 6)),
        minimum_trust_score: Number(details.minimumTrustScore),
        status: convertStatusToFrontend(contractStatusString),
        total_yes_stake_usd: parseFloat(ethers.formatUnits(totalYesStake, 6)),
        total_no_stake_usd: parseFloat(ethers.formatUnits(totalNoStake, 6)),
        proof_url: proofUrl,
        proof_submitted: !!proofUrl,
        winning_side: Number(winningSide) === 1 ? 'yes' : Number(winningSide) === 2 ? 'no' : null,
        category: 'other', 
        proof_type: 'video', 
        participants_count: participantsList.length,
        voters_count: votersList.length,
        updated_date: new Date().toISOString(),
      };

      setBet(betData);
      setWalletAddress(connectedAddr);
      setIsCreator(connectedAddr && betData.creator_address.toLowerCase() === connectedAddr.toLowerCase());

    } catch (err) {
      console.error("Error loading bet details from blockchain:", err);
      setError("Failed to load bet details. The contract may not exist at this address or there's a network issue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBetDetails(betAddress);
    loadAppSettings();
  }, [betAddress, loadBetDetails, loadAppSettings]);

  const handleProofSubmit = async (proofUrl) => {
    try {
      const betContract = getBetContract(bet.address, true);
      const tx = await betContract.submitProof(proofUrl);
      await tx.wait();
      loadBetDetails(betAddress);
    } catch (err) {
      console.error("Failed to submit proof:", err);
      setError(err.reason || "Failed to submit proof.");
    }
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
          <h2 className="text-2xl font-bold text-red-400 mb-4">Bet Not Found</h2>
          <p className="text-gray-300 mb-6">{error || "Could not find a bet at this address."}</p>
          <div className="flex gap-4 justify-center">
            <Button
              onClick={() => navigate(createPageUrl("Dashboard"))}
              className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700"
            >
              View Active Markets
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="border-gray-600 text-gray-300 hover:bg-gray-700"
            >
              Refresh Page
            </Button>
          </div>
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

          <BetDetailHeader bet={bet} />

          {bet.status === 'completed' && (
            <BetResolution bet={bet} participants={participants} votes={votes} appSettings={appSettings}/>
          )}

          {bet.status === 'cancelled' && (
            <BetCancellation bet={bet} participants={participants} />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <ProofPanel
                bet={bet}
                isCreator={isCreator}
                onProofSubmit={handleProofSubmit}
              />
              <ParticipantsList participants={participants} bet={bet} />
              <VoteHistory votes={votes} />
            </div>
            <div className="space-y-8">
              <BetStats bet={bet} votes={votes} />
              {bet.status !== 'completed' && bet.status !== 'cancelled' && (
                <VotingPanel
                  bet={bet}
                  participants={participants}
                  votes={votes}
                  appSettings={appSettings}
                  walletConnected={!!walletAddress}
                  walletAddress={walletAddress}
                  onRequestWalletConnect={connectWallet}
                  loadBetDetails={loadBetDetails} 
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}