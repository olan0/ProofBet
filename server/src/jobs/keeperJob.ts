/**
 * Keeper job - runs daily at midnight to transition bet statuses
 * Fetches active bets from API and triggers on-chain transitions
 */

import { ethers } from "ethers";
import BetFactoryArtifact from "../abis/BetFactory.json";
import BetArtifact from "../abis/Bet.json";
import dotenv from "dotenv";

dotenv.config();

const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS;
const RPC_URL = process.env.RPC_URL;
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3001";
const API_KEY = process.env.API_KEY || "";
const PRIVATE_KEY = process.env.KEEPER_PRIVATE_KEY;
const GAS_LIMIT = Number(process.env.KEEPER_GAS_LIMIT || 3_500_000);

const ACTIVE_STATUSES = [0, 1, 2]; // OPEN_FOR_BETS, AWAITING_PROOF, VOTING

enum Status {
  OPEN_FOR_BETS = 0,
  AWAITING_PROOF = 1,
  VOTING = 2,
  COMPLETED = 3,
  CANCELLED = 4,
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

async function fetchActiveBets(): Promise<any[]> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) headers["x-api-key"] = API_KEY;

  try {
    // Fetch public bets
    const publicUrl = `${API_BASE_URL}/api/bets?status=0,1,2&limit=100`;
    console.log(`📡 Fetching public bets from: ${publicUrl}`);

    const publicResponse = await fetch(publicUrl, { headers });
    if (!publicResponse.ok) {
      const body = await publicResponse.text();
      throw new Error(`API error ${publicResponse.status}: ${body}`);
    }
    const publicData = await publicResponse.json();
    const publicBets = publicData.bets || [];
    console.log(`✅ Fetched ${publicBets.length} public active bets`);

    // Fetch private bets
    const privateUrl = `${API_BASE_URL}/api/bets?status=0,1,2&isPrivate=true&limit=100`;
    console.log(`📡 Fetching private bets from: ${privateUrl}`);

    const privateResponse = await fetch(privateUrl, { headers });
    if (!privateResponse.ok) {
      const body = await privateResponse.text();
      throw new Error(`API error ${privateResponse.status}: ${body}`);
    }
    const privateData = await privateResponse.json();
    const privateBets = privateData.bets || [];
    console.log(`✅ Fetched ${privateBets.length} private active bets`);

    return [...publicBets, ...privateBets];
  } catch (err) {
    console.error("❌ Failed to fetch active bets:", err);
    return [];
  }
}

async function runKeeper() {
  console.log(`⏰ Keeper job started at ${new Date().toISOString()}`);
  console.log(`   API_BASE_URL: ${API_BASE_URL}`);
  console.log(`   FACTORY_ADDRESS: ${FACTORY_ADDRESS ? '✓ Set' : '❌ Missing'}`);
  console.log(`   RPC_URL: ${RPC_URL ? '✓ Set' : '❌ Missing'}`);
  console.log(`   KEEPER_PRIVATE_KEY: ${PRIVATE_KEY ? '✓ Set' : '❌ Missing'}`);

  if (!FACTORY_ADDRESS || !RPC_URL || !PRIVATE_KEY) {
    console.error("❌ Missing FACTORY_ADDRESS, RPC_URL, or KEEPER_PRIVATE_KEY");
    return;
  }

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    const factory = new ethers.Contract(
      FACTORY_ADDRESS,
      BetFactoryArtifact,
      signer
    );

    const bets = await fetchActiveBets();
    const now = nowSeconds();
    let transitioned = 0;

    for (const bet of bets) {
      const betAddress = bet.betAddress;

      try {
        const betContract = new ethers.Contract(betAddress, BetArtifact, signer);
        const details = await betContract.getBetDetails();
        const status = details.status;

        // Close betting if deadline passed
        if (
          status === Status.OPEN_FOR_BETS &&
          now > details.bettingDeadline
        ) {
          console.log(`📤 Closing betting for ${betAddress}`);
          const tx = await betContract.closeBetting({ gasLimit: GAS_LIMIT });
          await tx.wait();
          transitioned++;
        }

        // Cancel if no proof submitted
        if (
          status === Status.AWAITING_PROOF &&
          now > details.proofDeadline
        ) {
          console.log(`❌ Cancelling for missing proof: ${betAddress}`);
          const tx = await betContract.cancelBet(4, { gasLimit: GAS_LIMIT }); // CancelReason.NO_PROOF
          await tx.wait();
          transitioned++;
        }

        // Resolve if voting deadline passed
        if (
          status === Status.VOTING &&
          now > details.votingDeadline
        ) {
          console.log(`✅ Resolving bet: ${betAddress}`);
          const tx = await betContract.resolveBet({ gasLimit: GAS_LIMIT });
          await tx.wait();
          transitioned++;
        }
      } catch (err) {
        console.warn(`⚠️ Failed to process ${betAddress}:`, err);
      }
    }

    console.log(
      `✅ Keeper job complete — transitioned ${transitioned} bets`
    );
  } catch (err) {
    console.error("❌ Keeper job failed:", err);
  }
}

export { runKeeper };
