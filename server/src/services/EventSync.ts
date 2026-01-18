import { ethers } from "ethers";
import mongoose from "mongoose";
import BetFactoryArtifact from "../abis/BetFactory.json";
import BetArtifact from "../abis/Bet.json";
import Bet from "../models/Bet";
import { SyncState } from "../models/SyncState";
import { Interface, Result } from "ethers";
import dotenv from "dotenv";
 
dotenv.config();
const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS!;
const RPC_URL =  process.env.RPC_URL!;
const CONFIRMATIONS = parseInt(process.env.CONFIRMATIONS || "0", 10); // blocks to wait for finality

const provider = new ethers.WebSocketProvider(RPC_URL);
const factory = new ethers.Contract(FACTORY_ADDRESS, BetFactoryArtifact, provider);

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
  return state?.lastProcessedBlock ?? 0;
}

async function getBlockTimestamp(blockNumber: number): Promise<Date> {
  const block = await provider.getBlock(blockNumber);
  if (!block) {
    throw new Error(`Block ${blockNumber} not found`);
  }
  return new Date(block.timestamp * 1000);
}
async function fetchBetDetails(betAddress: string) {
  const bet = new ethers.Contract(betAddress, BetArtifact, provider);
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

    bet.updatedAt = await getBlockTimestamp(event.blockNumber);
    await bet.save();
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
    await updateLastBlock(event.blockNumber);

    console.log(`🗳️ BetVote: ${voter} voted ${vote === 1 ? "YES" : "NO"} on bet ${betId}`);
  } catch (err) {
    console.error("Error in handleBetVote:", err);
  }
}

async function handleBetCreated(
  betId: string,
  creator: string,
  event: ethers.EventLog
) {
  
  const createdAt = await getBlockTimestamp(event.blockNumber);
  const details = await fetchBetDetails(betId);
  await Bet.updateOne(
    { betId },
    {
      betId,
      creator,
      title: details.title,
      description: details.description,
      category: Number(details.category),
      proofType: Number(details.proofType),
      bettingDeadline: Number(details.bettingDeadline),
      proofDeadline: Number(details.proofDeadline),
      votingDeadline: Number(details.votingDeadline),
      status: 0,
      createdAt,
      blockNumber: event.blockNumber,
      txHash: event.transactionHash,
      totalYesStake: 0,
      totalNoStake: 0,
      yesVotes: 0,
      noVotes: 0,
      invalidVotes: 0,
      totalParticipants: 0,
      totalVotes: 0
    },
    { upsert: true }
  );

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

export async function syncHistoricalEvents() {
  const lastProcessed = await getLastProcessedBlock();
  const latest = await provider.getBlockNumber();

  console.log(
    `⏳ Scanning historical events [${lastProcessed + 1} → ${latest}]`
  );

  const events = [
    ...(await factory.queryFilter("BetCreated", lastProcessed + 1, latest)),
    ...(await factory.queryFilter("BetStatusChanged", lastProcessed + 1, latest)),
    ...(await factory.queryFilter("BetParticipation", lastProcessed + 1, latest)),
    ...(await factory.queryFilter("BetVote", lastProcessed + 1, latest)),
  ];
const iface = new Interface(BetFactoryArtifact);
for (const ev of events) {
  try {
    const parsed = iface.parseLog(ev); // decode args + fragment safely
    if (!parsed) {
      console.warn("⚠️ Failed to parse event log: returned null");
      continue;
    }
    const eventName = parsed.name;
    const args = parsed.args as Result;

    if (eventName === "BetCreated") {
      const [betAddress, creator] =  decodeArgs<[string, string]>(args);
      await handleBetCreated(betAddress, creator,  ev as any);
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

  console.log(`✅ Historical sync complete (${events.length} events)`);
}

export function subscribeLiveEvents() {
  // BetCreated
  factory.on("BetCreated", async (betAddress, creator,  event) => {
    console.log(`📡 Detected BetCreated: ${betAddress}`);
    //console.log(`📡 Event block number : ${event.blockNumber}`);
    // Wait for finality
    const txHash = event.log.transactionHash;
    console.log(`📡 Waiting for ${CONFIRMATIONS} confirmations for tx ${txHash}...`)  ;
    const receipt = await provider.waitForTransaction(txHash, CONFIRMATIONS);
    if (!receipt || receipt.status !== 1) {
      console.warn(`⚠️ BetCreated not finalized for ${betAddress}`);
      return;
    }
    console.log(`receive ${receipt} `)
    
    //provider.once(event.blockNumber + CONFIRMATIONS, async () =>
      handleBetCreated(betAddress, creator,  event as any )
    //);
  });

  // StatusChanged
  factory.on("BetStatusChanged", async (betAddress, newStatus, reason,event) => {
    console.log(`📡 Detected StatusChanged → ${newStatus} with reason ${reason}`);
    // Wait for finality
    const txHash = event.log.transactionHash;
    console.log(`📡 Waiting for ${CONFIRMATIONS} confirmations for tx ${txHash}...`)  ;
    const receipt = await provider.waitForTransaction(txHash, CONFIRMATIONS);
    if (!receipt || receipt.status !== 1) {
      console.warn(`⚠️ StatusChanged not finalized for ${betAddress}`);
      return;
    }
    handleStatusChanged(betAddress, newStatus, event)
    
  });
  // --- BetParticipation ---
  factory.on("BetParticipation", async (betAddress, participant, position, amountUsdc, event) => {
    console.log(`📡 Detected BetParticipation: ${participant} bet ${amountUsdc}`);
    const txHash = event.log.transactionHash;
    console.log(`⏳ Waiting for ${CONFIRMATIONS} confirmations for tx ${txHash}...`);
    const receipt = await provider.waitForTransaction(txHash, CONFIRMATIONS);
    if (!receipt || receipt.status !== 1) {
      console.warn(`⚠️ BetParticipation not finalized for ${betAddress}`);
      return;
    }
    await handleBetParticipation(betAddress, participant, position, amountUsdc, event as any);
  });

  // --- BetVote ---
  factory.on("BetVote", async (betAddress, voter, vote, event) => {
    console.log(`📡 Detected BetVote: ${voter} voted ${vote}`);
    const txHash = event.log.transactionHash;
    console.log(`⏳ Waiting for ${CONFIRMATIONS} confirmations for tx ${txHash}...`);
    const receipt = await provider.waitForTransaction(txHash, CONFIRMATIONS);
    if (!receipt || receipt.status !== 1) {
      console.warn(`⚠️ BetVote not finalized for ${betAddress}`);
      return;
    }
    await handleBetVote(betAddress, voter, vote, event as any);
  });




  console.log("🔔 Subscribed to BetFactory live events");
}

export async function initEventSync() {
  await syncHistoricalEvents();
  subscribeLiveEvents();
}
