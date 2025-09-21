
import React, { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bet } from "@/api/entities";
import { Participant } from "@/api/entities";
import { Vote } from "@/api/entities";
import { AppSettings } from "@/api/entities";
import { VoterReward } from "@/api/entities";
import { StakeRefund } from "@/api/entities";
import { UserProfile } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wallet, Plus, AlertCircle, Coins, DollarSign } from "lucide-react"; // Added Wallet, Plus, AlertCircle, Coins, DollarSign icons
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
import WalletConnectionModal from "../components/wallet/WalletConnectionModal";
import DepositModal from "../components/wallet/DepositModal";
import InsufficientFundsModal from "../components/wallet/InsufficientFundsModal";

export default function BetDetails() {
  const navigate = useNavigate();
  const location = useLocation();
  const [bet, setBet] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [votes, setVotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [appSettings, setAppSettings] = useState({
    voter_reward_percentage: 1,
    platform_fee_percentage: 2,
    vote_stake_amount_proof: 10, // Initialize with a default value as per the previous logic
  });

  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showInsufficientFundsModal, setShowInsufficientFundsModal] = useState(false);
  const [insufficientFundsData, setInsufficientFundsData] = useState({});
  const [userProfile, setUserProfile] = useState(null);
  const [placingBet, setPlacingBet] = useState(false); // Added for handlePlaceBet state

  const betId = new URLSearchParams(location.search).get("id");

  useEffect(() => {
    // Check for a connected wallet in localStorage on initial load
    const storedWalletAddress = localStorage.getItem("walletAddress");
    if (storedWalletAddress) {
      setWalletAddress(storedWalletAddress);
      setWalletConnected(true);
    }
  }, []);

  const handleWalletConnect = async (address) => {
    localStorage.setItem("walletAddress", address); // Save to localStorage
    setWalletConnected(true);
    setWalletAddress(address);
    setShowWalletModal(false);

    // Load or create user profile
    await loadUserProfile(address);
  };

  const loadUserProfile = async (address) => {
    try {
      const profileData = await UserProfile.filter({ wallet_address: address });
      if (profileData.length > 0) {
        setUserProfile(profileData[0]);
      } else {
        const newProfile = await UserProfile.create({
          wallet_address: address,
          internal_balance_usd: 0,
          internal_balance_proof: 0, // Initialize PROOF balance
        });
        setUserProfile(newProfile);
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
      // Optionally, set a user-facing error if profile is critical for interactions
    }
  };

  const handleDeposit = async (amount, tokenType) => {
    if (!userProfile) {
      console.error("Cannot deposit: User profile not loaded.");
      setError("Failed to process deposit: User profile not found.");
      return;
    }

    try {
      // In a real implementation, this would involve a smart contract transaction
      // For now, we'll simulate adding to the internal balance
      const updates = {};
      if (tokenType === 'usd') {
        updates.internal_balance_usd = (userProfile.internal_balance_usd || 0) + amount;
      } else if (tokenType === 'proof') {
        updates.internal_balance_proof = (userProfile.internal_balance_proof || 0) + amount;
      } else {
        console.error("Invalid token type for deposit:", tokenType);
        setError("Invalid token type for deposit.");
        return;
      }
      
      await UserProfile.update(userProfile.id, updates);

      // Reload user profile to get updated balance
      await loadUserProfile(walletAddress);

      setShowDepositModal(false);
    } catch (error) {
      console.error("Error depositing funds:", error);
      setError("Failed to process deposit. Please try again.");
      throw error; // Re-throw to indicate failure if needed by caller
    }
  };

  const checkSufficientBalance = (requiredAmount, actionType, currency = 'usd') => {
    if (!userProfile) {
      console.warn("User profile not loaded, cannot check balance.");
      setShowWalletModal(true); // Prompt connection/load if profile is missing
      return false;
    }

    const currentBalance = currency === 'usd' ? (userProfile.internal_balance_usd || 0) : (userProfile.internal_balance_proof || 0);

    if (currentBalance < requiredAmount) {
      setInsufficientFundsData({
        currentBalance,
        requiredAmount,
        actionType,
        currency
      });
      setShowInsufficientFundsModal(true);
      return false;
    }
    return true;
  };

  const loadBetDetails = useCallback(async (id) => {
    if (!id) {
      setError("No bet ID provided.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    // Helper to refund participants for a cancelled bet
    const processRefunds = async (betData, participantData, voteData = []) => {
      // Refund all participants' stakes (USDC)
      for (const participant of participantData) {
        try {
          const participantProfile = await UserProfile.filter({ wallet_address: participant.participant_address });
          if (participantProfile.length > 0) {
            await UserProfile.update(participantProfile[0].id, {
              internal_balance_usd: (participantProfile[0].internal_balance_usd || 0) + participant.stake_amount_usd
            });
          } else {
            console.warn(`Participant profile not found for refund: ${participant.participant_address}`);
          }

          await StakeRefund.create({
            participant_address: participant.participant_address,
            bet_id: betData.id,
            bet_title: betData.title,
            refund_amount_usd: participant.stake_amount_usd,
          });
        } catch (refundError) {
          console.error(`Error processing participant refund for ${participant.participant_address}:`, refundError);
        }
      }

      // Also refund any vote stakes (PROOF) if the bet is cancelled during the voting phase or generally cancelled with votes
      for (const vote of voteData) {
        try {
          const voterProfile = await UserProfile.filter({ wallet_address: vote.voter_address });
          if (voterProfile.length > 0) {
            await UserProfile.update(voterProfile[0].id, {
              internal_balance_proof: (voterProfile[0].internal_balance_proof || 0) + vote.stake_amount_proof
            });
          } else {
            console.warn(`Voter profile not found for refund: ${vote.voter_address}`);
          }

          // Note: StakeRefund entity currently only supports refund_amount_usd.
          // For PROOF refunds, we might need a separate entity or a way to distinguish.
          // For now, we'll log it if StakeRefund only handles USD. If StakeRefund is generic, it's fine.
          // Assuming StakeRefund is for USD participants only, not PROOF voters.
          // If a record is needed for PROOF refunds, a new entity (e.g., VoterStakeRefund) would be ideal.
          console.log(`Voter ${vote.voter_address} refunded ${vote.stake_amount_proof} PROOF for bet ${betData.id}.`);

        } catch (voteRefundError) {
          console.error(`Error processing vote refund for ${vote.voter_address}:`, voteRefundError);
        }
      }
    };

    // Helper to cancel the bet if conditions aren't met by the deadline and refund participants
    const checkAndCancelBet = async (betData, participantData) => {
      if (!betData || betData.status !== 'open_for_bets' || betData.cancellation_processed) return betData;

      const bettingDeadline = new Date(betData.betting_deadline);
      const now = new Date();

      // Use default values for missing fields to handle older bets
      const minimumSideStake = betData.minimum_side_stake_usd || 0.05;
      const yesMetMinimum = (betData.total_yes_stake_usd || 0) >= minimumSideStake;
      const noMetMinimum = (betData.total_no_stake_usd || 0) >= minimumSideStake;

      if (now > bettingDeadline && (!yesMetMinimum || !noMetMinimum)) {
        // Update with full bet data to avoid validation issues
        const updatedBet = {
          ...betData,
          status: 'cancelled',
          cancellation_processed: true,
          minimum_bet_amount_usd: betData.minimum_bet_amount_usd || 0.01,
          minimum_total_stake_usd: betData.minimum_total_stake_usd || 0.1,
          betting_deadline: betData.betting_deadline || new Date().toISOString(),
          // Ensure vote_stake_amount_proof is carried over if it exists
          vote_stake_amount_proof: betData.vote_stake_amount_proof || appSettings.vote_stake_amount_proof, // Default if not present
        };
        try {
          await Bet.update(betData.id, updatedBet);
          await processRefunds(updatedBet, participantData); // Call new helper for refunds
          return updatedBet;
        } catch (updateError) {
          console.error(`Error updating bet ${betData.id} to cancelled:`, updateError);
          return betData; // Return original if update fails
        }
      }
      return betData;
    };

    // Helper to resolve the bet if the voting period is over and distribute rewards/winnings/refunds
    const checkAndResolveBet = async (betData, voteData, participantData, settings) => {
      if (!betData || betData.status !== 'voting' || betData.cancellation_processed) return betData;

      const votingDeadline = new Date(betData.voting_deadline);
      const now = new Date();
      const minimumVotes = betData.minimum_votes || 3;

      if (now > votingDeadline) {
        // Total PROOF staked by voters for proportionality in rewards
        const totalVoteStakePROOF = voteData.reduce((sum, vote) => sum + (vote.stake_amount_proof || 0), 0);

        if (voteData.length >= minimumVotes) {
          const yesVotes = voteData.filter(v => v.vote === 'yes').length;
          const noVotes = voteData.filter(v => v.vote === 'no').length;
          const winningVote = yesVotes > noVotes ? 'yes' : 'no';

          const totalPrizePoolUSD = (betData.total_yes_stake_usd || 0) + (betData.total_no_stake_usd || 0);
          const voterRewardPercentage = settings?.voter_reward_percentage || 1;
          const platformFeePercentage = settings?.platform_fee_percentage || 2;

          const voterRewardPoolUSD = totalPrizePoolUSD * (voterRewardPercentage / 100);
          const platformFeeUSD = totalPrizePoolUSD * (platformFeePercentage / 100);
          const netWinningsPoolUSD = totalPrizePoolUSD - voterRewardPoolUSD - platformFeeUSD;

          // Automatically credit voter rewards to internal balance (in USD)
          if (voterRewardPoolUSD > 0 && totalVoteStakePROOF > 0) { // Check totalVoteStakePROOF here
            for (const vote of voteData) {
              try {
                // Reward share is proportional to PROOF staked, but paid in USD
                const rewardShare = (vote.stake_amount_proof / totalVoteStakePROOF) * voterRewardPoolUSD;

                // Credit reward to voter's internal balance (USD)
                const voterProfile = await UserProfile.filter({ wallet_address: vote.voter_address });
                if (voterProfile.length > 0) {
                  await UserProfile.update(voterProfile[0].id, {
                    internal_balance_usd: (voterProfile[0].internal_balance_usd || 0) + rewardShare
                  });
                }

                // Create reward record for history
                await VoterReward.create({
                  voter_address: vote.voter_address,
                  bet_id: betData.id,
                  reward_amount_usd: rewardShare,
                  bet_title: betData.title,
                  vote_cast: vote.vote
                });
              } catch (rewardError) {
                console.error(`Error processing reward for voter ${vote.voter_address}:`, rewardError);
                // Continue with other voters even if one fails
              }
            }
          }

          // Automatically credit winnings to participants (in USD)
          const winners = participantData.filter(p => p.position === winningVote);
          const totalWinnerStakeUSD = winners.reduce((sum, w) => sum + w.stake_amount_usd, 0);

          if (winners.length > 0 && totalWinnerStakeUSD > 0) {
            for (const winner of winners) {
              try {
                const winnerShare = (winner.stake_amount_usd / totalWinnerStakeUSD) * netWinningsPoolUSD;

                // Credit winnings to winner's internal balance (USD)
                const winnerProfile = await UserProfile.filter({ wallet_address: winner.participant_address });
                if (winnerProfile.length > 0) {
                  await UserProfile.update(winnerProfile[0].id, {
                    internal_balance_usd: (winnerProfile[0].internal_balance_usd || 0) + winnerShare
                  });
                }
              } catch (winnerError) {
                console.error(`Error processing winnings for ${winner.participant_address}:`, winnerError);
                // Continue with other winners even if one fails
              }
            }
          }

          // Update with full bet data to avoid validation issues
          const updatedBet = {
            ...betData,
            status: 'completed',
            winning_side: winningVote,
            platform_fee_collected_usd: platformFeeUSD,
            voter_rewards_distributed_usd: voterRewardPoolUSD,
            net_winnings_pool_usd: netWinningsPoolUSD,
            total_vote_stake_proof: totalVoteStakePROOF, // Store total PROOF staked for voting
            minimum_bet_amount_usd: betData.minimum_bet_amount_usd || 0.01,
            minimum_total_stake_usd: betData.minimum_total_stake_usd || 0.1,
            betting_deadline: betData.betting_deadline || new Date().toISOString(),
            vote_stake_amount_proof: betData.vote_stake_amount_proof || appSettings.vote_stake_amount_proof, // Default if not present
          };
          try {
            await Bet.update(betData.id, updatedBet);
            return updatedBet;
          } catch (updateError) {
            console.error(`Error updating bet ${betData.id} to completed:`, updateError);
            return betData; // Return original if update fails
          }
        } else {
          // Bet cancelled due to not enough votes
          const updatedBet = {
            ...betData,
            status: 'cancelled',
            cancellation_processed: true,
            minimum_bet_amount_usd: betData.minimum_bet_amount_usd || 0.01,
            minimum_total_stake_usd: betData.minimum_total_stake_usd || 0.1,
            betting_deadline: betData.betting_deadline || new Date().toISOString(),
            vote_stake_amount_proof: betData.vote_stake_amount_proof || appSettings.vote_stake_amount_proof, // Default if not present
          };
          try {
            await Bet.update(betData.id, updatedBet);
            await processRefunds(updatedBet, participantData, voteData); // Call new helper for refunds
            return updatedBet;
          } catch (updateError) {
            console.error(`Error updating bet ${betData.id} to cancelled (insufficient votes):`, updateError);
            return betData; // Return original if update fails
          }
        }
      }
      return betData;
    };

    try {
      // Load settings with error handling
      let currentSettings;
      try {
        const settingsData = await AppSettings.list();
        currentSettings = settingsData.length > 0 ? settingsData[0] : { voter_reward_percentage: 1, platform_fee_percentage: 2, vote_stake_amount_proof: 10 };
        setAppSettings(currentSettings);
      } catch (settingsError) {
        console.error("Error loading app settings:", settingsError);
        currentSettings = { voter_reward_percentage: 1, platform_fee_percentage: 2, vote_stake_amount_proof: 10 }; // Fallback to default
        setAppSettings(currentSettings);
      }

      // Add error handling for bet retrieval with specific error messages
      let betData;
      try {
        betData = await Bet.get(id);
        if (!betData) {
          setError("This bet no longer exists. It may have been deleted or completed.");
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error("Error loading bet:", err);
        // Handle different types of errors more specifically
        if (err.message && (err.message.includes('not found') || err.message.includes('Entity Bet with ID'))) {
          setError("This bet no longer exists. It may have been deleted. Please return to the markets page to view active bets.");
        } else if (err.message && err.message.includes('network')) {
          setError("Network error loading bet details. Please check your connection and try again.");
        } else {
          setError("Failed to load bet details. This bet may no longer exist or there may be a temporary issue.");
        }
        setLoading(false);
        return;
      }

      // Load participants and votes (before status transitions, as they might need this data for refunds)
      let participantData = [];
      let voteData = [];
      try {
        participantData = await Participant.filter({ bet_id: id }, "-created_date", 50);
        setParticipants(participantData);
      } catch (participantError) {
        console.error("Error loading participants:", participantError);
        if (participantError.message && (participantError.message.includes('not found') || participantError.message.includes('No documents matching the query'))) {
          // If participants can't be found, it's not necessarily an error, maybe just none.
          // Don't set global error, just log and continue with empty array.
        }
        setParticipants([]);
        participantData = [];
      }

      try {
        voteData = await Vote.filter({ bet_id: id }, "-created_date", 50);
        setVotes(voteData);
      } catch (voteError) {
        console.error("Error loading votes:", voteError);
        if (voteError.message && (voteError.message.includes('not found') || voteError.message.includes('No documents matching the query'))) {
          // Similar to participants, just log and continue.
        }
        setVotes([]);
        voteData = [];
      }

      // Handle automatic status transitions
      const now = new Date();

      // 1. Auto-transition from 'open_for_bets' to 'betting_closed' or 'cancelled'
      if (betData.status === 'open_for_bets' && now > new Date(betData.betting_deadline)) {
        const minimumSideStake = betData.minimum_side_stake_usd || 0.05;
        const yesMetMinimum = (betData.total_yes_stake_usd || 0) >= minimumSideStake;
        const noMetMinimum = (betData.total_no_stake_usd || 0) >= minimumSideStake;

        let updatedBet = {
          ...betData,
          minimum_bet_amount_usd: betData.minimum_bet_amount_usd || 0.01,
          minimum_total_stake_usd: betData.minimum_total_stake_usd || 0.1,
          betting_deadline: betData.betting_deadline || new Date().toISOString(),
          vote_stake_amount_proof: betData.vote_stake_amount_proof || appSettings.vote_stake_amount_proof, // Default if not present
        };
        
        let updatePayload = {};

        if (yesMetMinimum && noMetMinimum) {
          updatedBet.status = 'betting_closed';
          // Set proof deadline
          updatedBet.proof_deadline = new Date(new Date(betData.betting_deadline).getTime() + 24 * 60 * 60 * 1000).toISOString();
          updatePayload = { status: 'betting_closed', proof_deadline: updatedBet.proof_deadline };

        } else {
          updatedBet.status = 'cancelled';
          updatedBet.cancellation_processed = true;
          updatePayload = { status: 'cancelled', cancellation_processed: true };
        }

        try {
          await Bet.update(betData.id, updatePayload);
          betData = updatedBet; // Update local state
          if (betData.status === 'cancelled') {
            await processRefunds(betData, participantData);
          }
        } catch (updateError) {
          console.error("Failed to update bet status after betting deadline:", updateError);
        }
      }

      // 2. Auto-cancel if proof deadline is missed
      if (betData.status === 'betting_closed' && betData.proof_deadline && now > new Date(betData.proof_deadline)) {
        const updatedBet = {
          ...betData,
          status: 'cancelled',
          cancellation_processed: true,
          minimum_bet_amount_usd: betData.minimum_bet_amount_usd || 0.01,
          minimum_total_stake_usd: betData.minimum_total_stake_usd || 0.1,
          betting_deadline: betData.betting_deadline || new Date().toISOString(),
          vote_stake_amount_proof: betData.vote_stake_amount_proof || appSettings.vote_stake_amount_proof, // Default if not present
        };
        try {
          await Bet.update(betData.id, {
            status: 'cancelled',
            cancellation_processed: true,
          });
          betData = updatedBet; // Update local state
          // If cancelled at this stage, process refunds
          await processRefunds(betData, participantData);
        } catch (updateError) {
          console.error("Failed to cancel bet after proof deadline:", updateError);
        }
      }

      // 3. Auto-transition from 'betting_closed' to 'voting' if proof is submitted
      if (betData.status === 'betting_closed' && betData.proof_submitted && betData.proof_url && !betData.voting_deadline) {
        // Only set if voting_deadline is not already set, to prevent re-setting it repeatedly.
        const votingDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
        const updatedBet = {
          ...betData,
          status: 'voting',
          voting_deadline: votingDeadline,
          vote_stake_amount_proof: betData.vote_stake_amount_proof || appSettings.vote_stake_amount_proof, // Default if not present
        };
        try {
          await Bet.update(betData.id, {
            status: 'voting',
            voting_deadline: votingDeadline,
          });
          betData = updatedBet;
        } catch (updateError) {
          console.error("Failed to transition bet to voting status:", updateError);
        }
      }

      // Process bet resolution (for voting phase) and other remaining transitions
      try {
        betData = await checkAndCancelBet(betData, participantData); // This only applies if bet is still 'open_for_bets'
        const resolvedBet = await checkAndResolveBet(betData, voteData, participantData, currentSettings); // This only applies if bet is still 'voting'
        setBet(resolvedBet);
      } catch (processingError) {
        console.error("Error processing bet status transitions:", processingError);
        // If processing fails due to missing bet, show appropriate error
        if (processingError.message && (processingError.message.includes('not found') || processingError.message.includes('No documents matching the query'))) {
          setError("This bet no longer exists or has been removed from the system during processing.");
        }
        setBet(betData); // Use original bet data if processing fails
      }

    } catch (err) {
      console.error("Unexpected error loading bet details:", err);
      if (err.message && (err.message.includes('not found') || err.message.includes('No documents matching the query'))) {
        setError("This bet cannot be found. It may have been deleted or never existed.");
      } else {
        setError("An unexpected error occurred while loading bet details. Please try again later.");
      }
    }
    setLoading(false);
  }, [appSettings.vote_stake_amount_proof]); // Added appSettings.vote_stake_amount_proof to dependencies

  useEffect(() => {
    if (betId) {
      loadBetDetails(betId);
    } else {
      setLoading(false);
      setError("No bet ID specified in URL.");
    }
  }, [betId, loadBetDetails]);

  // Load user profile when wallet connects or changes
  useEffect(() => {
    if (walletConnected && walletAddress) {
      loadUserProfile(walletAddress);
    }
  }, [walletConnected, walletAddress]);


  const handleStartStream = async (streamUrl) => {
    if (!bet) return;

    try {
      // ONLY update the proof fields. Let the main loadBetDetails handle the status transition.
      await Bet.update(bet.id, {
        proof_url: streamUrl,
        proof_submitted: true,
      });

      // Refresh all data to trigger the status transition
      loadBetDetails(betId);
    } catch (error) {
      console.error("Error updating bet with stream URL:", error);
      setError("Failed to submit proof. Please try again.");
    }
  };

  const handlePlaceBet = async (position, betAmount) => {
    if (!bet || !walletConnected) {
      setShowWalletModal(true);
      return;
    }

    setPlacingBet(true);
    setError("");

    // Check if user has sufficient balance for USDC bet
    if (!checkSufficientBalance(betAmount, "bet", "usd")) {
      setPlacingBet(false);
      return;
    }

    const participantAddress = walletAddress;
    const txHash = `0x${Math.random().toString(16).substr(2, 64)}`;

    try {
      // Update Bet record with full data to avoid validation issues
      const newTotalYes = position === 'yes' ? (bet.total_yes_stake_usd || 0) + betAmount : (bet.total_yes_stake_usd || 0);
      const newTotalNo = position === 'no' ? (bet.total_no_stake_usd || 0) + betAmount : (bet.total_no_stake_usd || 0);
      const newTotal = newTotalYes + newTotalNo;

      // Check if both sides meet minimum requirements
      const minimumSideStake = bet.minimum_side_stake_usd || 0;
      const minimumTotalStake = bet.minimum_total_stake_usd || 0;
      const bettingDeadline = new Date(bet.betting_deadline);

      const yesMetMinimum = newTotalYes >= minimumSideStake;
      const noMetMinimum = newTotalNo >= minimumSideStake;
      const totalMetMinimum = newTotal >= minimumTotalStake;
      const bothSidesReady = yesMetMinimum && noMetMinimum && totalMetMinimum;

      const updatedBetData = {
        ...bet,
        participants_count: (bet.participants_count || 0) + 1,
        total_yes_stake_usd: newTotalYes,
        total_no_stake_usd: newTotalNo,
        // Auto-close betting if deadline passed AND both sides have minimum stakes
        status: (bet.status === 'open_for_bets' && bothSidesReady && new Date() > bettingDeadline) ? 'betting_closed' : bet.status,
        // Provide default values for newly required fields to patch old records
        minimum_bet_amount_usd: bet.minimum_bet_amount_usd || 0.01,
        minimum_total_stake_usd: bet.minimum_total_stake_usd || 0.1,
        betting_deadline: bet.betting_deadline || new Date().toISOString(),
        vote_stake_amount_proof: bet.vote_stake_amount_proof || appSettings.vote_stake_amount_proof, // Ensure this is carried over
      };
      await Bet.update(bet.id, updatedBetData);

      // Deduct from internal USD balance
      await UserProfile.update(userProfile.id, {
        internal_balance_usd: (userProfile.internal_balance_usd || 0) - betAmount
      });

      // Create new Participant record
      await Participant.create({
        bet_id: bet.id,
        participant_address: participantAddress,
        position: position,
        stake_amount_usd: betAmount,
        transaction_hash: txHash,
      });

    } catch (error) {
      console.error("Error during bet placement:", error);
      setError("Failed to place your bet. Please try again.");
      // In a real scenario, you might want to revert deductions if a later step fails
    }


    // Refresh user profile and bet details regardless of errors in updates
    await loadUserProfile(walletAddress);
    loadBetDetails(betId);
    setPlacingBet(false);
  };

  const handleVote = async (voteChoice) => {
    if (!bet || !walletConnected) {
      setShowWalletModal(true);
      return;
    }

    const voteStakeAmount = appSettings.vote_stake_amount_proof || 10;

    // Check if user has sufficient balance for PROOF stake
    if (!checkSufficientBalance(voteStakeAmount, "vote", "proof")) {
      return;
    }

    const currentUserAddress = walletAddress;
    // Check if user is a participant (has money at stake) - if so, prevent voting
    const isParticipant = participants.some(p => p.participant_address === currentUserAddress);
    const isCreator = bet.creator_address === currentUserAddress;

    if (isParticipant || isCreator) {
      alert("You cannot vote on this bet because you have a financial stake in the outcome.");
      return;
    }

    // Check if user has already voted
    const hasAlreadyVoted = votes.some(v => v.voter_address === currentUserAddress);
    if (hasAlreadyVoted) {
        alert("You have already cast your vote on this bet.");
        return;
    }

    try {
      // Deduct PROOF from internal balance
      await UserProfile.update(userProfile.id, {
        internal_balance_proof: (userProfile.internal_balance_proof || 0) - voteStakeAmount
      });
    } catch (error) {
      console.error("Error deducting balance for vote:", error);
      setError("Failed to deduct balance for vote. Please try again.");
      return;
    }

    try {
      // Create vote record with PROOF stake
      const txHash = `0x${Math.random().toString(16).substr(2, 64)}`;
      await Vote.create({
        bet_id: bet.id,
        voter_address: currentUserAddress,
        vote: voteChoice,
        stake_amount_proof: voteStakeAmount, // Use stake_amount_proof for votes
        transaction_hash: txHash
      });
    } catch (error) {
      console.error("Error creating vote record:", error);
      setError("Failed to record your vote. Please try again.");
      // Potentially reverse balance deduction if this fails consistently
      return;
    }

    // Refresh user profile and bet details regardless of errors in updates
    await loadUserProfile(walletAddress);
    loadBetDetails(betId);
  };

  const isCreator = bet && bet.creator_address === walletAddress;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 p-6 text-center flex flex-col items-center justify-center">
        <div className="max-w-md mx-auto space-y-4">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto" />
          <h2 className="2xl font-bold text-red-400 mb-4">Bet Not Found</h2>
          <p className="text-gray-300 mb-6">{error}</p>
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
            <BetResolution
              bet={bet}
              participants={participants}
              votes={votes}
              appSettings={appSettings}
            />
          )}

          {bet.status === 'cancelled' && (
            <BetCancellation
              bet={bet}
              participants={participants}
            />
          )}

          <div className="grid grid-cols-1 lg:col-span-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <ProofPanel
                bet={bet}
                isCreator={isCreator}
                onProofSubmit={handleStartStream}
              />
              <ParticipantsList participants={participants} bet={bet} />
              <VoteHistory votes={votes} />
            </div>
            <div className="space-y-8">
              {/* Balance Display */}
              {walletConnected && userProfile && (
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Wallet className="w-5 h-5 text-cyan-400" />
                      Your Balances
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-300 flex items-center gap-1">
                        <DollarSign className="w-4 h-4 text-green-400" /> USDC:
                      </span>
                      <span className="font-bold text-green-400 text-lg">
                        {(userProfile.internal_balance_usd || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-gray-300 flex items-center gap-1">
                        <Coins className="w-4 h-4 text-purple-400" /> PROOF:
                      </span>
                      <span className="font-bold text-purple-400 text-lg">
                        {(userProfile.internal_balance_proof || 0).toFixed(2)}
                      </span>
                    </div>
                    <Button
                      onClick={() => setShowDepositModal(true)}
                      variant="outline"
                      className="w-full border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Deposit Funds
                    </Button>
                  </CardContent>
                </Card>
              )}

              <BetStats bet={bet} votes={votes} />
              {bet.status !== 'completed' && bet.status !== 'cancelled' && (
                <VotingPanel
                  bet={bet}
                  participants={participants}
                  onPlaceBet={handlePlaceBet}
                  onVote={handleVote}
                  votes={votes}
                  appSettings={appSettings}
                  walletConnected={walletConnected}
                  walletAddress={walletAddress}
                  onRequestWalletConnect={() => setShowWalletModal(true)}
                  placingBet={placingBet} // Pass placingBet state
                />
              )}
            </div>
          </div>
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

      <InsufficientFundsModal
        isOpen={showInsufficientFundsModal}
        onClose={() => setShowInsufficientFundsModal(false)}
        onDeposit={() => {
          setShowInsufficientFundsModal(false);
          setShowDepositModal(true);
        }}
        currentBalance={insufficientFundsData.currentBalance || 0}
        requiredAmount={insufficientFundsData.requiredAmount || 0}
        actionType={insufficientFundsData.actionType}
        currency={insufficientFundsData.currency} // Pass currency to modal
      />
    </>
  );
}
