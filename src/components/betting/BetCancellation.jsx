import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, User, Vote, Loader2, DollarSign, ShieldCheck } from "lucide-react";
import { getBetContract } from "../blockchain/contracts";
import { ethers } from "ethers";

export default function BetCancellation({ bet, participants, walletAddress, loadBetDetails }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isProcessingVoter, setIsProcessingVoter] = useState(false);
  const [error, setError] = useState("");
  const [voterError, setVoterError] = useState("");
  const [userHasRefund, setUserHasRefund] = useState(false);
  const [userRefundAmount, setUserRefundAmount] = useState(0);
  const [hasClaimedRefund, setHasClaimedRefund] = useState(false);
  const [userVoterStake, setUserVoterStake] = useState(0);
  const [hasClaimedVoterRefund, setHasClaimedVoterRefund] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [creatorHasClaimedCollateral, setCreatorHasClaimedCollateral] = useState(false);
  const [isProcessingCreator, setIsProcessingCreator] = useState(false);
  const [creatorError, setCreatorError] = useState("");

  useEffect(() => {
    const checkRefundStatus = async () => {
      if (!walletAddress || !bet) return;
      
      try {
        const betContract = getBetContract(bet.address);
        const [participantData, voterStakeData, creator, collateralLocked] = await Promise.all([
          betContract.participants(walletAddress),
          betContract.voterStakesProof(walletAddress),
          betContract.creator(),
          betContract.collateralLocked()
        ]);
        
        const totalStake = parseFloat(ethers.formatUnits(participantData.yesStake, 6)) + 
                          parseFloat(ethers.formatUnits(participantData.noStake, 6));
        
        setUserRefundAmount(totalStake);
        setUserHasRefund(totalStake > 0);
        setHasClaimedRefund(participantData.hasWithdrawn);
        
        const voterStake = parseFloat(ethers.formatEther(voterStakeData));
        setUserVoterStake(voterStake);
        setHasClaimedVoterRefund(voterStake === 0);
        
        // Check if user is creator
        const userIsCreator = creator.toLowerCase() === walletAddress.toLowerCase();
        setIsCreator(userIsCreator);
        if (userIsCreator) {
          // Show claim button when collateralLocked == true (collateral exists)
          // Hide button if: already claimed OR no collateral (collateralLocked == false)
          setCreatorHasClaimedCollateral(participantData.hasWithdrawn || !collateralLocked);
        }
      } catch (e) {
        console.error("Could not check refund status:", e);
      }
    };
    
    checkRefundStatus();
  }, [walletAddress, bet]);

  const handleClaimRefund = async () => {
    setIsProcessing(true);
    setError("");
    
    try {
      const betContract = getBetContract(bet.address, true);
      const tx = await betContract.claimRefund();
      await tx.wait();
      
      if (loadBetDetails) {
        loadBetDetails(bet.address);
      }
      
      setHasClaimedRefund(true);
    } catch (err) {
      console.error("Failed to claim refund:", err);
      setError(err.reason || err.message || "Failed to claim refund. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClaimVoterRefund = async () => {
    setIsProcessingVoter(true);
    setVoterError("");
    
    try {
      const betContract = getBetContract(bet.address, true);
      const tx = await betContract.claimVoterRewards();
      await tx.wait();
      
      if (loadBetDetails) {
        loadBetDetails(bet.address);
      }
      
      setHasClaimedVoterRefund(true);
    } catch (err) {
      console.error("Failed to claim voter refund:", err);
      setVoterError(err.reason || err.message || "Failed to claim voter refund. Please try again.");
    } finally {
      setIsProcessingVoter(false);
    }
  };

  const handleClaimCreatorCollateral = async () => {
    setIsProcessingCreator(true);
    setCreatorError("");
    
    try {
      const betContract = getBetContract(bet.address, true);
      const tx = await betContract.claimCreatorCollateral();
      await tx.wait();
      
      if (loadBetDetails) {
        loadBetDetails(bet.address);
      }
      
      setCreatorHasClaimedCollateral(true);
    } catch (err) {
      console.error("Failed to claim creator collateral:", err);
      setCreatorError(err.reason || err.message || "Failed to claim creator collateral. Please try again.");
    } finally {
      setIsProcessingCreator(false);
    }
  };

  if (bet.effectiveStatus !== 'cancelled') return null;

  const getCancellationReason = () => {
    const votingDeadline = new Date(bet.votingDeadline * 1000);
    const now = new Date();

    if (now > votingDeadline && bet.proofUrl) {
        const minimumVotes = bet.minimum_votes || 3;
        if (bet.voters_count < minimumVotes) {
            return `The minimum of ${minimumVotes} public votes was not reached by the voting deadline.`;
        }
        return `The vote resulted in a tie, so the bet could not be resolved.`;
    }
    
    const proofDeadline = new Date(bet.proofDeadline * 1000);
    if (now > proofDeadline && !bet.proofUrl) {
        return `The creator did not submit proof of the outcome before the deadline.`;
    }

    const minSideStake = bet.minimum_side_stake || 0;
    return `The minimum stake of ${minSideStake.toLocaleString()} USDC was not met on both the YES and NO sides by the betting deadline.`;
  };

  return (
    <Card className="bg-red-900/20 border-red-500/30">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-400" />
          Market Cancelled - Refunds Available
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 bg-red-900/30 rounded-lg">
          <h3 className="font-semibold text-red-200 mb-2">Reason for Cancellation</h3>
          <p className="text-red-300">{getCancellationReason()}</p>
        </div>

        {walletAddress && userHasRefund && (
          <div className="space-y-3 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-400" />
                Your Refund
              </h3>
              <span className="text-2xl font-bold text-green-400">
                ${userRefundAmount.toFixed(2)} USDC
              </span>
            </div>
            
            {hasClaimedRefund ? (
              <div className="p-3 bg-green-900/20 border border-green-500/30 rounded-md">
                <p className="text-green-300 text-sm">✓ Refund claimed successfully! Check your internal wallet.</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-400">
                  Your original stake is ready to be claimed. It will be returned to your internal wallet.
                </p>
                <Button 
                  onClick={handleClaimRefund} 
                  disabled={isProcessing}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Claiming Refund...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Claim Refund
                    </>
                  )}
                </Button>
              </>
            )}
            
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-900/30 border border-red-500/50 rounded-md">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}
          </div>
        )}

        {walletAddress && userVoterStake > 0 && (
          <div className="space-y-3 p-4 bg-gray-900/50 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                Your Voter Stake Refund
              </h3>
              <span className="text-2xl font-bold text-purple-400">
                {userVoterStake.toFixed(2)} PROOF
              </span>
            </div>
            
            {hasClaimedVoterRefund ? (
              <div className="p-3 bg-purple-900/20 border border-purple-500/30 rounded-md">
                <p className="text-purple-300 text-sm">✓ Voter stake refunded successfully! Check your internal wallet.</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-400">
                  Your voting stake is ready to be claimed. It will be returned to your internal wallet.
                </p>
                <Button 
                  onClick={handleClaimVoterRefund} 
                  disabled={isProcessingVoter}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold"
                >
                  {isProcessingVoter ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Claiming Voter Refund...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Claim Voter Refund
                    </>
                  )}
                </Button>
              </>
            )}
            
            {voterError && (
              <div className="flex items-start gap-2 p-3 bg-red-900/30 border border-red-500/50 rounded-md">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{voterError}</p>
              </div>
            )}
          </div>
        )}

        {walletAddress && isCreator && (
          <div className="space-y-3 p-4 bg-gray-900/50 rounded-lg border border-cyan-700">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-cyan-400" />
                Creator Collateral Refund
              </h3>
            </div>
            
            {creatorHasClaimedCollateral ? (
              <div className="p-3 bg-cyan-900/20 border border-cyan-500/30 rounded-md">
                <p className="text-cyan-300 text-sm">✓ Collateral refunded successfully! Check your internal wallet.</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-400">
                  As the market creator, you can claim back your collateral. It will be returned to your internal wallet.
                </p>
                <Button 
                  onClick={handleClaimCreatorCollateral} 
                  disabled={isProcessingCreator}
                  className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold"
                >
                  {isProcessingCreator ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Claiming Collateral...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Claim Creator Collateral
                    </>
                  )}
                </Button>
              </>
            )}
            
            {creatorError && (
              <div className="flex items-start gap-2 p-3 bg-red-900/30 border border-red-500/50 rounded-md">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{creatorError}</p>
              </div>
            )}
          </div>
        )}

        {walletAddress && !userHasRefund && !userVoterStake && !isCreator && (
          <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-md">
            <p className="text-blue-300 text-sm">You did not participate or vote in this market, so there is no refund to claim.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}