import { getTrustScoreContract } from "../blockchain/contracts";

// Simple in-memory cache to avoid repeated RPC calls for the same address within a short time.
const scoreCache = new Map();
const CACHE_TTL = 30000; // Cache for 30 seconds

/**
 * Gets the trust score for a given wallet address directly from the TrustScore smart contract.
 * Implements a simple in-memory cache to reduce redundant RPC calls.
 * @param {string} walletAddress The user's wallet address.
 * @returns {Promise<{overall_score: number}>} An object containing the user's trust score.
 */
async function getTrustScore(walletAddress) {
  if (!walletAddress) {
    return { overall_score: 0 };
  }

  // 1. Check cache first to prevent spamming the blockchain endpoint
  const cached = scoreCache.get(walletAddress);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }

  try {
    // 2. Get the contract instance
    const contract = getTrustScoreContract();
    
    // 3. Call the `getScore` function on the smart contract
    const scoreFromContract = await contract.getScore(walletAddress);
    
    // The contract returns a BigInt, so we convert it to a standard JavaScript number.
    const scoreAsNumber = Number(scoreFromContract);

    const scoreData = { overall_score: scoreAsNumber };

    // 4. Update the cache with the fresh data
    scoreCache.set(walletAddress, {
      data: scoreData,
      timestamp: Date.now()
    });

    return scoreData;
  } catch (error) {
    console.error(`Failed to fetch trust score from contract for ${walletAddress}:`, error);
    // Return a default score on error to prevent the UI from breaking.
    return { overall_score: 0 };
  }
}

export const TrustScoreManager = {
  getTrustScore,
  // The complex calculation logic that relied on database entities is no longer needed.
  // The smart contract is now the single source of truth for trust scores.
};