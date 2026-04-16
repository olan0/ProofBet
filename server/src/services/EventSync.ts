import { ethers } from "ethers";
import BetFactoryArtifact from "../abis/BetFactory.json";
import BetArtifact from "../abis/Bet.json";
import Bet from "../models/Bet";
import { SyncState } from "../models/SyncState";
import { Interface, Result } from "ethers";
import dotenv from "dotenv";
import Activity, { ActivityType, ActorRole } from "../models/Activity";

dotenv.config();
const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS!;
const RPC_URL =  process.env.RPC_URL!;
const CONFIRMATIONS = parseInt(process.env.CONFIRMATIONS || "0", 10); // blocks to wait for finality
const DEPLOYMENT_BLOCK = parseInt(process.env.DEPLOYMENT_BLOCK || "0", 10);
const CHUNK_SIZE = 2000; // Alchemy eth_getLogs max range per request

// Log configuration at startup
console.log(`📋 EventSync Config: RPC=${RPC_URL ? '✓ Set' : '❌ Missing'}, FACTORY=${FACTORY_ADDRESS ? '✓ Set' : '❌ Missing'}`);
if (!RPC_URL) console.warn("⚠️ RPC_URL is not configured — blockchain sync will fail");
if (!FACTORY_ADDRESS) console.warn("⚠️ FACTORY_ADDRESS is not configured — blockchain sync will fail");

// Lazy-initialize provider to avoid blocking on startup
let provider: ethers.WebSocketProvider | null = null;
let factory: ethers.Contract | null = null;

function getProvider(): ethers.WebSocketProvider {
  if (!provider) {
    if (!RPC_URL) {
      throw new Error("RPC_URL environment variable is not set. Blockchain sync is disabled.");
    }
    try {
      provider = new ethers.WebSocketProvider(RPC_URL);
      console.log(`✅ WebSocket provider connected to: ${RPC_URL.substring(0, 50)}...`);
    } catch (err) {
      console.error(`❌ Failed to create WebSocket provider with ${RPC_URL}:`, err);
      throw err;
    }
    factory = new ethers.Contract(FACTORY_ADDRESS, BetFactoryArtifact, provider);
  }
  return provider;
}

function getFactory(): ethers.Contract {
  if (!factory) {
    getProvider(); // Ensure provider is initialized
  }
  return factory!;
}

// ----------- UTILITIES -----------

async function updateLastBlock(blockNumber: number) {
  await SyncState.updateOne(
    { contract: FACTORY_ADDRESS },
    { $set: { lastProcessedBlock: blockNumber } },
    { upsert: true }
  );
}

async function getLastProcessedBlock(): Promise<number> {
  const state = await SyncState.findOne({ contract: FACTORY_ADDRESS });
  return state?.lastProcessedBlock ?? DEPLOYMENT_BLOCK;
}

async function getBlockTimestamp(blockNumber: number): Promise<Date> {
  const block = await getProvider().getBlock(blockNumber);
  if (!block) {
    throw new Error(`Block ${blockNumber} not found`);
  }
  return new Date(block.timestamp * 1000);
}
async function fetchBetDetails(betAddress: string) {
  const bet = new ethers.Contract(betAddress, BetArtifact, getProvider());
  const details = await bet.getBetDetails();
  return details
}


// ----------- HANDLERS -----------


async function handleBetParticipation(
  betId: string,
  participant: string,
  position: number,
  amountUsdc: bigint,
  event: ethers.EventLog
) {
  try {
    const bet = await Bet.findOne({ betId });
    
    if (!bet) return;
    const pos = Number(position); 
    // Update stake totals (1=YES, 2=NO)
    if (pos === 1) {
      console.log(`Bet total yes stake before: ${bet.totalYesStake}`);
      bet.totalYesStake = (BigInt(bet.totalYesStake || 0) + amountUsdc).toString();
    } else if (pos === 2) {
      bet.totalNoStake = (BigInt(bet.totalNoStake || 0) + amountUsdc).toString();
    }
    bet.totalParticipants = (bet.totalParticipants || 0) + 1;
    bet.totalBet = (Number(bet.totalYesStake) + Number(bet.totalNoStake));
    bet.updatedAt = await getBlockTimestamp(event.blockNumber);
    await bet.save();
    /*
     await BetParticipation.create({
    betId,
    title: bet.title,
    user: participant.toLowerCase(),
    side: Number(position),
    amountUsdc: Number(amountUsdc), // USDC fits in JS number
    blockNumber: event.blockNumber,
    txHash: event.transactionHash,
  });*/
      await Activity.create({
      txHash: event.transactionHash,
      blockNumber: event.blockNumber,
      timestamp: await getBlockTimestamp(event.blockNumber),

      betId: betId,
      actor: participant.toLowerCase(),
      role: ActorRole.BETTOR,
      type: ActivityType.BET,

      betTitle: bet.title,
      side: Number(position),
      amountUsdc: amountUsdc.toString(),
    });
    await updateLastBlock(event.blockNumber);

    console.log(`💰 BetParticipation: ${participant} placed ${amountUsdc} USDC on side ${position}`);
  } catch (err) {
    console.error("Error in handleBetParticipation:", err);
  }
}

async function handleBetVote(
  betId: string,
  voter: string,
  voteBN: number,
  event: ethers.EventLog
) {
  try {
    const bet = await Bet.findOne({ betId });
    if (!bet) return;
    const vote = Number(voteBN);
    // Update votes (1=YES, 2=NO)
    if (vote === 1) bet.yesVotes = (bet.yesVotes || 0) + 1;
    else if (vote === 2) bet.noVotes = (bet.noVotes || 0) + 1;
    else if(vote === 3) bet.invalidVotes = (bet.invalidVotes || 0) + 1; 
    bet.totalVotes = (bet.totalVotes || 0) + 1;
    bet.updatedAt = await getBlockTimestamp(event.blockNumber);
    await bet.save();
/*
  await BetVote.create({
    betId,
    title: bet.title,
    voter: voter.toLowerCase(),
    vote,
    //stakeProof: stakeProof.toString(), // bigint → string
    blockNumber: event.blockNumber,
    txHash: event.transactionHash
  });*/
      await Activity.create({
      txHash: event.transactionHash,
      blockNumber: event.blockNumber,
      timestamp: await getBlockTimestamp(event.blockNumber),

      betId: betId,
      actor: voter.toLowerCase(),
      role: ActorRole.VOTER,
      type: ActivityType.VOTE,

      side: Number(vote),
      betTitle: bet.title,
    });

    await updateLastBlock(event.blockNumber);

    console.log(`🗳️ BetVote: ${voter} voted ${vote === 1 ? "YES" : "NO"} on bet ${betId}`);
  } catch (err) {
    console.error("Error in handleBetVote:", err);
  }
}

async function handleBetCreated(
  betId: string,
  creator: string,
  isPrivateBet: boolean,
  event: ethers.EventLog
) {

  const createdAt = await getBlockTimestamp(event.blockNumber);
  const details = await fetchBetDetails(betId);
  await Bet.updateOne(
    { betId },
    {
      $set: {
        betId,
        creator: creator.toLowerCase(),
        // For private bets the on-chain title is a placeholder; encrypted content
        // is stored separately via POST /api/bets/:id/private-content
        title: isPrivateBet ? "[PRIVATE]" : details.title,
        description: isPrivateBet ? "[PRIVATE]" : details.description,
        category: Number(details.category),
        proofType: Number(details.proofType),
        bettingDeadline: Number(details.bettingDeadline),
        proofDeadline: Number(details.proofDeadline),
        votingDeadline: Number(details.votingDeadline),
        status: 0,
        isPrivate: isPrivateBet,
        createdAt,
        blockNumber: event.blockNumber,
        txHash: event.transactionHash,
        totalYesStake: "0",
        totalNoStake: "0",
        totalBet: 0,
        yesVotes: 0,
        noVotes: 0,
        invalidVotes: 0,
        totalParticipants: 0,
        totalVotes: 0
      }
    },
    { upsert: true }
  );
    await Activity.create({
      txHash: event.transactionHash,
      blockNumber: event.blockNumber,
      timestamp: await getBlockTimestamp(event.blockNumber),

      betId: betId,
      betTitle: details.title,
      betStatus: 0,

      actor: creator.toLowerCase(),
      role: ActorRole.CREATOR,
      type: ActivityType.CREATE,
    });

  await updateLastBlock(event.blockNumber);
  
}

async function handleStatusChanged(
  betId: string,
  newStatus: number,
  event: ethers.EventLog
) {
  await Bet.updateOne(
    { betId },
    {
      $set: {
        status: Number(newStatus),
        updatedAt: await getBlockTimestamp(event.blockNumber),
      },
    }
  );
  await updateLastBlock(event.blockNumber);
  
  console.log(`🔄 [EventSync] StatusChanged: ${betId} → ${newStatus}`);
}



// ----------- SYNCING LOGIC -----------
// Helper to strongly type args
function decodeArgs<T extends any[]>(args: Result): T {
  return args as unknown as T;
}

async function processEventChunk(events: ethers.Log[]) {
  const iface = new Interface(BetFactoryArtifact);
  for (const ev of events) {
    try {
      const parsed = iface.parseLog(ev);
      if (!parsed) {
        console.warn("⚠️ Failed to parse event log: returned null");
        continue;
      }
      const eventName = parsed.name;
      const args = parsed.args as Result;

      if (eventName === "BetCreated") {
        const [betAddress, creator, isPrivateBet] = decodeArgs<[string, string, boolean]>(args);
        await handleBetCreated(betAddress, creator, isPrivateBet, ev as any);
      } else if (eventName === "BetStatusChanged") {
        const [betAddress, newStatus] = decodeArgs<[string, number]>(args);
        await handleStatusChanged(betAddress, newStatus, ev as any);
      } else if (eventName === "BetParticipation") {
        const [betAddress, participant, position, amountUsdc] = decodeArgs<[string, string, number, bigint]>(args);
        await handleBetParticipation(betAddress, participant, position, amountUsdc, ev as any);
      } else if (eventName === "BetVote") {
        const [betAddress, voter, vote] = decodeArgs<[string, string, number]>(args);
        await handleBetVote(betAddress, voter, vote, ev as any);
      }
    } catch (err) {
      console.warn("⚠️ Failed to parse event log:", err);
    }
  }
}

export async function syncHistoricalEvents() {
  const lastProcessed = await getLastProcessedBlock();
  const latest = await getProvider().getBlockNumber();

  if (lastProcessed >= latest) {
    console.log("✅ Already up to date, no historical sync needed");
    return;
  }

  console.log(`⏳ Scanning historical events [${lastProcessed + 1} → ${latest}] in ${CHUNK_SIZE}-block chunks`);

  let totalEvents = 0;
  for (let from = lastProcessed + 1; from <= latest; from += CHUNK_SIZE) {
    const to = Math.min(from + CHUNK_SIZE - 1, latest);
    try {
      const events = [
        ...(await getFactory().queryFilter("BetCreated", from, to)),
        ...(await getFactory().queryFilter("BetStatusChanged", from, to)),
        ...(await getFactory().queryFilter("BetParticipation", from, to)),
        ...(await getFactory().queryFilter("BetVote", from, to)),
      ];
      if (events.length > 0) {
        await processEventChunk(events);
        totalEvents += events.length;
      }
      await updateLastBlock(to);
      console.log(`  ✓ Chunk [${from} → ${to}] — ${events.length} events`);
    } catch (err) {
      console.error(`  ✗ Chunk [${from} → ${to}] failed, will retry on next start:`, err);
      break;
    }
  }

  console.log(`✅ Historical sync complete (${totalEvents} total events)`);
}

async function waitAndProcess(
  txHash: string,
  label: string,
  handler: () => Promise<void>
): Promise<void> {
  try {
    const receipt = await getProvider().waitForTransaction(txHash, CONFIRMATIONS);
    if (!receipt || receipt.status !== 1) {
      console.warn(`⚠️ ${label} not finalized (tx ${txHash})`);
      return;
    }
    await handler();
  } catch (err) {
    console.error(`❌ ${label} handler failed:`, err);
  }
}

export function subscribeLiveEvents() {
  getFactory().on("BetCreated", async (betAddress, creator, isPrivateBet, event) => {
    console.log(`📡 BetCreated: ${betAddress} (private: ${isPrivateBet})`);
    await waitAndProcess(event.log.transactionHash, "BetCreated", () =>
      handleBetCreated(betAddress, creator, isPrivateBet, event as any)
    );
  });

  getFactory().on("BetStatusChanged", async (betAddress, newStatus, reason, event) => {
    console.log(`📡 StatusChanged → ${newStatus} (${reason})`);
    await waitAndProcess(event.log.transactionHash, "BetStatusChanged", () =>
      handleStatusChanged(betAddress, newStatus, event as any)
    );
  });

  getFactory().on("BetParticipation", async (betAddress, participant, position, amountUsdc, event) => {
    console.log(`📡 BetParticipation: ${participant} bet ${amountUsdc}`);
    await waitAndProcess(event.log.transactionHash, "BetParticipation", () =>
      handleBetParticipation(betAddress, participant, position, amountUsdc, event as any)
    );
  });

  getFactory().on("BetVote", async (betAddress, voter, vote, event) => {
    console.log(`📡 BetVote: ${voter} voted ${vote}`);
    await waitAndProcess(event.log.transactionHash, "BetVote", () =>
      handleBetVote(betAddress, voter, vote, event as any)
    );
  });

  // Periodically save the current block so restarts don't re-scan the whole chain
  const HEARTBEAT_MS = 5 * 60 * 1000; // every 5 minutes
  setInterval(async () => {
    try {
      const block = await getProvider().getBlockNumber();
      await updateLastBlock(block);
      console.log(`💓 Heartbeat: lastProcessedBlock saved as ${block}`);
    } catch (err) {
      console.warn("⚠️ Heartbeat block save failed:", err);
    }
  }, HEARTBEAT_MS);

  // Detect WebSocket disconnection and reconnect
  const ws = getProvider().websocket as any;
  ws.on?.("close", () => {
    console.warn("⚠️ WebSocket closed — restarting EventSync in 5s...");
    provider = null; // Reset provider to force fresh connection
    factory = null;
    setTimeout(() => initEventSync(), 5000);
  });

  console.log("🔔 Subscribed to BetFactory live events");
}

export async function initEventSync() {
  try {
    getProvider(); // Initialize provider
    await syncHistoricalEvents();
    subscribeLiveEvents();
    console.log("✅ EventSync initialized successfully");
  } catch (err) {
    console.error("❌ EventSync initialization failed:", err);
    console.error("Will retry in 10 seconds...");
    setTimeout(() => initEventSync(), 10000);
  }
}
