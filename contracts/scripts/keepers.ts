/**
 * @file keepers.ts
 * @description Automated off-chain keeper for ProofBet contracts.
 * Scans BetFactory, checks all active bets, and triggers transitions
 * (close betting, cancel for missing proof, or resolve) automatically.
 */



// Types inferred from Hardhat artifacts
import { network } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

const NETWORK = process.env.HARDHAT_NETWORK ?? "localhost";
const CHAIN_TYPE = process.env.CHAIN_TYPE ??"l1";

const { ethers } = await network.connect({
  network: NETWORK,
  chainType: CHAIN_TYPE,
});


const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS ?? "";

// Gas config (optional)
const GAS_LIMIT = Number(process.env.KEEPER_GAS_LIMIT || 3_500_000);

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

async function handleBet(betAddr: string) {
  const bet = (await ethers.getContractAt("Bet", betAddr)) ;

  const statusBn = await bet.currentStatus();
  const status = Number(statusBn); // enum value

  // details: (title, description, bettingDeadline, proofDeadline, votingDeadline, ...)
  const details = await bet.getBetDetails();

  // BigNumber-safe conversions
  const bettingDeadline = Number(details.bettingDeadline);
  const proofDeadline   = Number(details.proofDeadline);
  const votingDeadline  = Number(details.votingDeadline);

  const now = nowSeconds();

  // Decide & call
  if (status === Status.OPEN_FOR_BETS && now >= bettingDeadline) {
    console.log(`🕓 Closing betting for ${betAddr}`);
    const tx = await bet.checkAndCloseBetting({ gasLimit: GAS_LIMIT });
    await tx.wait();
    return;
  }

  if (status === Status.AWAITING_PROOF && now >= proofDeadline) {
    console.log(`🚫 Cancelling for missing proof at ${betAddr}`);
    const tx = await bet.checkAndCancelForProof({ gasLimit: GAS_LIMIT });
    await tx.wait();
    return;
  }

  if (status === Status.VOTING && now >= votingDeadline) {
    console.log(`⚖️ Resolving bet ${betAddr}`);
    const tx = await bet.checkAndResolve({ gasLimit: GAS_LIMIT });
    await tx.wait();
    return;
  }

  // Optional: log minimal info for others
  // console.log(`⏩ Skipping ${betAddr} (status=${status})`);
}

async function main() {
  if (!FACTORY_ADDRESS) {
    console.error("❌ Missing FACTORY_ADDRESS in .env");
    process.exit(1);
  }

  const [keeper] = await ethers.getSigners();
  console.log(`👷 Keeper: ${keeper.address} on ${NETWORK}`);
  console.log(`🏭 Factory: ${FACTORY_ADDRESS}`);

  const factory = (await ethers.getContractAt(
    "BetFactory",
    FACTORY_ADDRESS
  )) 

  // Your factory exposes getBets(): address[]
  const betAddrs = await factory.getBets();
  console.log(`📊 Found ${betAddrs.length} bets`);

  for (const addr of betAddrs) {
    try {
      await handleBet(addr);
    } catch (err: any) {
      console.warn(`⚠️ Error handling bet ${addr}: ${err?.message ?? err}`);
      // continue to next bet
    }
  }

  console.log("✅ Keeper cycle complete.");
}

main().catch((err) => {
  console.error("❌ Keeper crashed:", err);
  process.exitCode = 1;
});