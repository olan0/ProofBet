import React, { useState, useEffect } from "react";
import Layout from "./Layout";
import { Button } from "@/components/ui/button";
import { getConnectedAddress } from "@/components/blockchain/contracts";
import { Loader, Gift, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { apiAxios } from "@/api/apiClient";

export default function Faucet() {
  const [walletAddress, setWalletAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [claimStatus, setClaimStatus] = useState(null); // "success", "error", or null
  const [statusMessage, setStatusMessage] = useState("");
  const [claimedToday, setClaimedToday] = useState(false);
  const [nextClaimTime, setNextClaimTime] = useState(null);
  const [txHash, setTxHash] = useState("");

  // Fetch wallet address on mount
  useEffect(() => {
    const checkWallet = async () => {
      const address = await getConnectedAddress();
      if (address) {
        setWalletAddress(address);
        checkFaucetStatus(address);
      }
    };
    checkWallet();
  }, []);

  // Check faucet status
  const checkFaucetStatus = async (address) => {
    try {
      setLoading(true);
      const response = await apiAxios.get(
        `/api/faucet/status/${address}`
      );
      const data = response.data;
      setClaimedToday(data.claimedToday);
      if (data.nextClaimTime) {
        setNextClaimTime(new Date(data.nextClaimTime));
      }
    } catch (error) {
      console.error("Failed to check faucet status:", error);
    } finally {
      setLoading(false);
    }
  };

  // Handle claim
  const handleClaim = async () => {
    if (!walletAddress) {
      setClaimStatus("error");
      setStatusMessage("Please connect wallet first");
      return;
    }

    try {
      setClaiming(true);
      setClaimStatus(null);
      setStatusMessage("");

      const response = await apiAxios.post(
        `/api/faucet/claim`,
        { wallet_address: walletAddress }
      );

      if (response.data.success) {
        setClaimStatus("success");
        setStatusMessage(response.data.message);
        setTxHash(response.data.txHash);
        setClaimedToday(true);
        setNextClaimTime(new Date(Date.now() + 24 * 60 * 60 * 1000));
        // Trigger balance update event
        window.dispatchEvent(new Event('balanceChanged'));
      } else {
        setClaimStatus("error");
        setStatusMessage(response.data.message);
      }
    } catch (error) {
      setClaimStatus("error");
      setStatusMessage(
        error.response?.data?.message || "Failed to claim faucet"
      );
    } finally {
      setClaiming(false);
    }
  };

  const getTimeUntilClaim = () => {
    if (!nextClaimTime) return "";
    const now = new Date();
    const diff = nextClaimTime - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800 p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Gift className="w-8 h-8 text-yellow-400" />
              <h1 className="text-4xl md:text-5xl font-bold text-white">
                PROOF Faucet
              </h1>
            </div>
            <p className="text-gray-400 text-lg">
              Get 50 PROOF tokens daily for testing
            </p>
          </div>

          {/* Main Card */}
          <div className="bg-gray-800/50 rounded-2xl p-8 border border-gray-700 backdrop-blur-sm">
            {/* Wallet Info */}
            {walletAddress ? (
              <div className="mb-8 p-4 bg-gray-700/30 rounded-lg border border-gray-600">
                <p className="text-sm text-gray-400 mb-1">Connected Wallet</p>
                <p className="text-sm font-mono text-cyan-400">{walletAddress}</p>
              </div>
            ) : (
              <div className="mb-8 p-4 bg-red-500/10 rounded-lg border border-red-500/30">
                <p className="text-sm text-red-400">
                  Please connect your wallet to claim the faucet
                </p>
              </div>
            )}

            {/* Status Display */}
            {loading ? (
              <div className="flex items-center justify-center gap-2 text-gray-400 mb-6">
                <Loader className="w-4 h-4 animate-spin" />
                <span>Loading status...</span>
              </div>
            ) : claimedToday && nextClaimTime ? (
              <div className="mb-6 p-4 bg-blue-500/10 rounded-lg border border-blue-500/30">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-blue-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-300 mb-1">
                      Already claimed today
                    </p>
                    <p className="text-xs text-blue-200">
                      Next claim available in {getTimeUntilClaim()}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Amount Info */}
            <div className="mb-8 p-6 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-lg border border-cyan-500/30">
              <p className="text-gray-400 text-sm mb-2">You will receive</p>
              <p className="text-5xl font-bold text-transparent bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text">
                50 PROOF
              </p>
              <p className="text-gray-500 text-sm mt-2">
                One claim per day, per address
              </p>
            </div>

            {/* Claim Button */}
            <div className="mb-6">
              <Button
                onClick={handleClaim}
                disabled={
                  !walletAddress || claiming || claimedToday || loading
                }
                className={`w-full h-12 text-lg font-semibold ${
                  claimedToday || !walletAddress
                    ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white"
                }`}
              >
                {claiming ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Claiming...
                  </>
                ) : claimedToday ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Claimed Today
                  </>
                ) : !walletAddress ? (
                  "Connect Wallet"
                ) : (
                  "Claim Now"
                )}
              </Button>
            </div>

            {/* Status Message */}
            {statusMessage && (
              <div
                className={`p-4 rounded-lg border ${
                  claimStatus === "success"
                    ? "bg-green-500/10 border-green-500/30 text-green-300"
                    : "bg-red-500/10 border-red-500/30 text-red-300"
                }`}
              >
                <div className="flex items-start gap-3">
                  {claimStatus === "success" ? (
                    <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  )}
                  <div>
                    <p className="font-semibold">{statusMessage}</p>
                    {txHash && (
                      <p className="text-xs mt-1 font-mono">
                        TX:{" "}
                        <a
                          href={`https://etherscan.io/tx/${txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:no-underline"
                        >
                          {txHash.substring(0, 10)}...
                        </a>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Info Section */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gray-800/30 rounded-lg p-6 border border-gray-700/50">
              <Gift className="w-6 h-6 text-yellow-400 mb-3" />
              <h3 className="font-semibold text-white mb-2">Free Tokens</h3>
              <p className="text-sm text-gray-400">
                Get test PROOF tokens for free daily
              </p>
            </div>

            <div className="bg-gray-800/30 rounded-lg p-6 border border-gray-700/50">
              <Clock className="w-6 h-6 text-blue-400 mb-3" />
              <h3 className="font-semibold text-white mb-2">Daily Limit</h3>
              <p className="text-sm text-gray-400">
                Claim once every 24 hours per address
              </p>
            </div>

            <div className="bg-gray-800/30 rounded-lg p-6 border border-gray-700/50">
              <AlertCircle className="w-6 h-6 text-purple-400 mb-3" />
              <h3 className="font-semibold text-white mb-2">Testing Only</h3>
              <p className="text-sm text-gray-400">
                Faucet is for testing purposes only
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
