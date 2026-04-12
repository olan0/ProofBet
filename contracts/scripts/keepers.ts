/**
 * @file keepers.ts
 * @description Automated off-chain keeper for ProofBet contracts.
 * Fetches only active bets from the API, then triggers transitions
 * (close betting, cancel for missing proof, or resolve) on-chain.
 */

import { network } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

const NETWORK    = process.env.HARDHAT_NETWORK ?? process.env.NETWORK ?? "localhost";
const CHAIN_TYPE = process.env.CHAIN_TYPE ?? "l1";

const { ethers } = await network.connect({
  network: NETWORK,
  chainType: CHAIN_TYPE,
});

const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS ?? "";
const API_BASE_URL    = process.env.API_BASE_URL ?? "http://127.0.0.1:3001";
const API_KEY         = process.env.API_KEY ?? "";
const GAS_LIMIT       = Number(process.env.KEEPER_GAS_LIMIT || 3_500_000);

// Statuses the keeper cares about
const ACTIVE_STATUSES = [0, 1, 2]; // OPEN_FOR_BETS, AWAITING_PROOF, VOTING

enum Status {
  OPEN_FOR_BETS   = 0,
  AWAITING_PROOF  = 1,
  VOTING          = 2,
  COMPLETED       = 3,
  CANCELLED       = 4,
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Fetch all active bet addresses from the API, paginating through all results.
 * Returns null if the API is unreachable.
 */
async function fetchActiveBetAddressesFromApi(): Promise<string[] | null> {
  const addresses: string[] = [];
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) headers["x-api-key"] = API_KEY;

  try {
    for (const status of ACTIVE_STATUSES) {
      // Fetch public bets
      let cursor: string | null = null;
      while (true) {
        const params = new URLSearchParams({ status: String(status), limit: "100" });
        if (cursor) params.set("cursor", cursor);

        const res = await fetch(`${API_BASE_URL}/api/bets?${params}`, { headers });
        if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);

        const json = await res.json() as { data?: { betId: string }[]; pagination?: { nextCursor: string | null; hasNext: boolean } };
        for (const bet of json.data ?? []) {
          if (bet.betId) addresses.push(bet.betId);
        }

        cursor = json.pagination?.nextCursor ?? null;
        if (!json.pagination?.hasNext) break;
      }

      // Fetch private bets for this status
      cursor = null;
      while (true) {
        const params = new URLSearchParams({ status: String(status), isPrivate: "true", limit: "100" });
        if (cursor) params.set("cursor", cursor);

        const res = await fetch(`${API_BASE_URL}/api/bets?${params}`, { headers });
        if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);

        const json = await res.json() as { data?: { betId: string }[]; pagination?: { nextCursor: string | null; hasNext: boolean } };
        for (const bet of json.data ?? []) {
          if (bet.betId) addresses.push(bet.betId);
        }

        cursor = json.pagination?.nextCursor ?? null;
        if (!json.pagination?.hasNext) break;
      }
    }
    return addresses;
  } catch (err: any) {
    console.warn(`⚠️  API unavailable (${err?.cause?.code ?? err?.message}), falling back to blockchain`);
    return null;
  }
}

/**
 * Fallback: fetch all bet addresses directly from the factory contract.
 * Only used when the API is down — scans all bets including completed ones.
 */
async function fetchActiveBetAddressesFromChain(factory: any): Promise<string[]> {
  const all: string[] = await factory.getBets();
  console.log(`⛓️  Chain fallback: scanning ${all.length} total bets`);
  return all; // handleBet skips terminal states immediately
}

async function handleBet(betAddr: string) {
  const bet = await ethers.getContractAt("Bet", betAddr);

  // Loop until no further transition is possible this cycle
  while (true) {
    const status = Number(await bet.currentStatus());

    if (status === Status.COMPLETED || status === Status.CANCELLED) break;

    const details         = await bet.getBetDetails();
    const bettingDeadline = Number(details.bettingDeadline);
    const proofDeadline   = Number(details.proofDeadline);
    const votingDeadline  = Number(details.votingDeadline);
    const now             = nowSeconds();

    if (status === Status.OPEN_FOR_BETS && now >= bettingDeadline) {
      console.log(`🕓 Closing betting for ${betAddr}`);
      await (await bet.checkAndCloseBetting({ gasLimit: GAS_LIMIT })).wait();
      continue; // re-check — proof deadline may also have passed
    }

    if (status === Status.AWAITING_PROOF && now >= proofDeadline) {
      console.log(`🚫 Cancelling no-proof at ${betAddr}`);
      await (await bet.checkAndCancelForNoProof({ gasLimit: GAS_LIMIT })).wait();
      break;
    }

    if (status === Status.VOTING && now >= votingDeadline) {
      console.log(`⚖️  Resolving ${betAddr}`);
      await (await bet.checkAndResolve({ gasLimit: GAS_LIMIT })).wait();
      break;
    }

    break; // nothing to do yet
  }
}

async function main() {
  if (!FACTORY_ADDRESS) {
    console.error("❌ Missing FACTORY_ADDRESS in .env");
    process.exit(1);
  }

  const [keeper] = await ethers.getSigners();
  console.log(`👷 Keeper: ${keeper.address} on ${NETWORK}`);
  console.log(`🏭 Factory: ${FACTORY_ADDRESS}`);
  console.log(`🔗 API: ${API_BASE_URL}`);

  const factory = await ethers.getContractAt("BetFactory", FACTORY_ADDRESS);

  const apiAddrs = await fetchActiveBetAddressesFromApi();
  const betAddrs = apiAddrs ?? await fetchActiveBetAddressesFromChain(factory);
  console.log(`📊 Active bets to process: ${betAddrs.length}`);

  if (betAddrs.length === 0) {
    console.log("✅ Nothing to do.");
    return;
  }

  let processed = 0;
  let errors = 0;

  for (const addr of betAddrs) {
    try {
      await handleBet(addr);
      processed++;
    } catch (err: any) {
      console.warn(`⚠️  Error handling bet ${addr}: ${err?.message ?? err}`);
      errors++;
    }
  }

  console.log(`✅ Keeper cycle complete. Processed: ${processed}, Errors: ${errors}`);
}

main().catch((err) => {
  console.error("❌ Keeper crashed:", err);
  process.exitCode = 1;
});
