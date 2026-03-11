/**
 * Sepolia Seeder — 4-account full lifecycle
 *
 * Roles
 * ──────
 *   Account 1  creator    creates bets, submits proof
 *   Account 2  bettorYes  places YES bets on every market
 *   Account 3  bettorNo   places NO  bets on every market
 *   Account 4  voter1     casts YES vote (or NO on tie scenario)
 *   Account 5  voter2     casts YES vote (or NO on tie scenario)
 *   Account 6  voter3     casts NO vote (opposite on tie scenario)
 *
 * Scenarios created
 * ─────────────────
 *   1  OPEN               7-day betting deadline, active bets
 *   2  AWAITING_PROOF     betting closed, creator has not submitted proof yet
 *   3  VOTING             proof submitted, voting open
 *   4  COMPLETED YES      YES votes > NO → YES bettors win
 *   5  COMPLETED NO       NO  votes > YES → NO  bettors win
 *   6  CANCELLED NO_PROOF proof deadline passed, no proof submitted
 *   7  CANCELLED INVALID  majority voted INVALID (bad proof)
 *   8  CANCELLED TIE      YES votes = NO votes, no majority
 *
 * Prerequisites (contracts/.env)
 * ───────────────────────────────
 *   SIGNER_COUNT=4
 *   All four keys stored in Hardhat keystore:
 *     npx hardhat keystore set SEPOLIA_PRIVATE_KEY
 *     npx hardhat keystore set SEPOLIA_PRIVATE_KEY_2
 *     npx hardhat keystore set SEPOLIA_PRIVATE_KEY_3
 *     npx hardhat keystore set SEPOLIA_PRIVATE_KEY_4
 *     npx hardhat keystore set SEPOLIA_PRIVATE_KEY_5
 *     npx hardhat keystore set SEPOLIA_PRIVATE_KEY_6
 *     npx hardhat keystore set SEPOLIA_RPC_URL
 *
 *   Account 1 must have Sepolia ETH + Circle USDC.
 *   The script transfers USDC and PROOF to the other accounts automatically.
 *   All accounts need Sepolia ETH for gas (≥ 0.05 ETH each).
 *
 * Usage
 * ─────
 *   npx hardhat run scripts/sepoliaSeeder.ts --network sepolia
 *
 *   Run once to create and advance all markets.
 */

import { network } from "hardhat";
import { ethers as ethersLib } from "ethers";
import * as dotenv from "dotenv";
dotenv.config();

// ─── Addresses ───────────────────────────────────────────────────────────────

const FACTORY_ADDRESS = "0x30F9bAac593f974c31d9aFD4D0915Cb5fbC6d1f5";
const PROOF_ADDRESS   = "0xC0383bf30268239Cae53aF9B98b7070813b9D3db";
const USDC_ADDRESS    = "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238";

// ─── Timing (seconds from market creation) ───────────────────────────────────

// Contract enforces: proofDeadline >= bettingDeadline + 1h, votingDeadline >= proofDeadline + 1h
const BETTING_SECS = 15 * 60;      // 15 min betting window (8 markets × ~20s tx + buffer)
const PROOF_GAP    = 60 * 60;      // 1 hour proof phase (contract minimum)
const VOTING_GAP   = 60 * 60;      // 1 hour voting phase (contract minimum)
const BUFFER       = 30;           // extra buffer past each deadline

// ─── Token amounts ───────────────────────────────────────────────────────────

const USDC_PER_ACCOUNT  = ethersLib.parseUnits("100", 6);   // enough for all bets
const PROOF_PER_ACCOUNT = ethersLib.parseEther("3000");     // enough for creation + voting
const BET_SIZE          = ethersLib.parseUnits("10", 6);    // 10 USDC per bet

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

async function countdown(totalSecs: number, label: string) {
  for (let s = totalSecs; s > 0; s--) {
    process.stdout.write(`\r  ⏳ ${label} — ${s}s remaining...   `);
    await sleep(1000);
  }
  process.stdout.write(`\r  ✅ ${label} — done.                   \n`);
}

function getBetAddress(factory: any, receipt: any): string {
  for (const log of receipt.logs) {
    try {
      const p = factory.interface.parseLog(log);
      if (p?.name === "BetCreated") return p.args.betAddress;
    } catch {}
  }
  throw new Error("BetCreated event not found");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { ethers } = await network.connect({ network: "sepolia", chainType: "l1" });
  const signers = await ethers.getSigners();

  if (signers.length < 6) {
    console.error(`\n❌ Need 6 signers, got ${signers.length}.`);
    console.error("   Set SIGNER_COUNT=6 in contracts/.env and store all 6 keys in keystore.");
    process.exit(1);
  }

  const [creator, bettorYes, bettorNo, voter1, voter2, voter3] = signers;

  console.log("\n════════════════════════════════════════════════════");
  console.log("  ProofBet Sepolia Seeder — 4 accounts, 8 scenarios");
  console.log("════════════════════════════════════════════════════");
  console.log(`  Account 1 creator    ${creator.address}`);
  console.log(`  Account 2 bettorYes  ${bettorYes.address}`);
  console.log(`  Account 3 bettorNo   ${bettorNo.address}`);
  console.log(`  Account 4 voter1     ${voter1.address}`);
  console.log(`  Account 5 voter2     ${voter2.address}`);
  console.log(`  Account 6 voter3     ${voter3.address}`);

  const factory    = await ethers.getContractAt("BetFactory", FACTORY_ADDRESS) as any;
  const proofToken = await ethers.getContractAt("ProofToken", PROOF_ADDRESS)   as any;
  const usdcToken  = await ethers.getContractAt("IERC20",     USDC_ADDRESS)    as any;

  // ── 4. Create all markets ─────────────────────────────────────────────────
  console.log("\n[4/6] Creating markets...");

  // Raise the active-bet limit so the creator can open all 8 markets at once
  const currentLimit = Number(await factory.maxActiveBetsPerUser());
  if (currentLimit < 10) {
    process.stdout.write("  Setting maxActiveBetsPerUser to 10...");
    await (await factory.connect(creator).setMaxActiveBetsPerUser(10)).wait();
    process.stdout.write(" ✅\n");
  }

  const block = await ethers.provider.getBlock("latest");
  const ts = Number(block!.timestamp);

  const base = {
    minimumBetAmount:  1n,
    minimumSideStake:  1n,
    minimumTrustScore: 0,
    minimumVotes:      1,
  };

  const long  = { bettingDeadline: ts + 86400 * 7, proofDeadline: ts + 86400 * 8, votingDeadline: ts + 86400 * 9 };

  async function create(details: object): Promise<string> {
    const tx = await factory.connect(creator).createBet(details);
    const r  = await tx.wait();
    return getBetAddress(factory, r);
  }

  // Create each market and place bets immediately — don't batch, deadline is per-creation ts
  async function createAndBet(label: string, details: object): Promise<string> {
    process.stdout.write(`  Creating ${label}...`);
    const addr = await create(details);
    process.stdout.write(` ✅ ${addr}\n`);
    const bet = await ethers.getContractAt("Bet", addr) as any;
    await (await bet.connect(bettorYes).placeBet(1, BET_SIZE)).wait();
    await (await bet.connect(bettorNo ).placeBet(2, BET_SIZE)).wait();
    console.log(`    ✅ YES + NO bets placed`);
    return addr;
  }

  const betOpen = await createAndBet("Market 1: OPEN (7-day) cold shower", {
    ...base, ...long, category: 6, proofType: 2,
    title:       "Will @CoachMike complete a 30-day cold shower challenge and stream every morning?",
    description: "Mike has committed to streaming a cold shower every morning for 30 days on Twitch starting April 1. Resolves YES if all 30 sessions are streamed live with no breaks. Proof = full stream VODs.",
  });

  const addrs: Record<string, string> = {};

  addrs.proofCoin = await createAndBet("Market 2: OPEN (7-day) PROOF coin", {
    ...base, ...long, category: 1, proofType: 4,
    title:       "Will the PROOF token reach $1.00 before the end of 2026?",
    description: "Resolves YES if the PROOF token trades at or above $1.00 USD on any major DEX (Uniswap, SushiSwap) for at least 5 consecutive minutes before December 31, 2026 23:59 UTC. Proof = on-chain price oracle snapshot or DEX trade history showing sustained $1.00+ price.",
  });

  // Get a fresh block timestamp for short-deadline markets (after OPEN market creation)
  const freshBlock = await ethers.provider.getBlock("latest");
  const freshTs = Number(freshBlock!.timestamp);

  // Short lifecycle: betting closes, proof deadline passes, voting deadline passes → terminal state
  const short = {
    bettingDeadline: freshTs + BETTING_SECS,
    proofDeadline:   freshTs + BETTING_SECS + PROOF_GAP,
    votingDeadline:  freshTs + BETTING_SECS + PROOF_GAP + VOTING_GAP,
  };

  // awaitingProof: betting closes soon, proof window is 7 days → stays AWAITING_PROOF
  const longAwait = {
    bettingDeadline: freshTs + BETTING_SECS,
    proofDeadline:   freshTs + BETTING_SECS + 7 * 86400,
    votingDeadline:  freshTs + BETTING_SECS + 7 * 86400 + 3600,
  };

  // voting: short proof window (submit proof → VOTING immediately), voting window is 7 days → stays VOTING
  const votingLong = {
    bettingDeadline: freshTs + BETTING_SECS,
    proofDeadline:   freshTs + BETTING_SECS + PROOF_GAP,
    votingDeadline:  freshTs + BETTING_SECS + PROOF_GAP + 7 * 86400,
  };

  // Create in-progress markets with their own long deadlines
  addrs.awaitingProof = await createAndBet("Market (→awaitingProof)", {
    ...base, ...longAwait, category: 2, proofType: 2,
    title: "Will Sara run her first half-marathon and finish under 2h30m — streamed live?",
    description: "Sara trains on stream every week. She has entered a local half-marathon on April 20. Bet resolves YES if she crosses the finish line with an official chip time under 2:30:00. She will wear a GoPro and stream the entire race.",
  });
  addrs.voting = await createAndBet("Market (→voting)", {
    ...base, ...votingLong, category: 6, proofType: 2,
    title: "Will Dave learn and perform a full song on guitar within 30 days — live on stream?",
    description: "Dave is a complete beginner picking up guitar on camera. Starting from zero, can he learn Wonderwall start-to-finish and perform it cleanly on a live stream before the deadline? Resolves YES if he plays the song with no more than 3 audible mistakes on the final stream.",
  });

  // Create the 5 short-lifecycle scenarios (advance to terminal states)
  const shortScenarios = [
    {
      key: "completedYes", category: 6, proofType: 2,
      title: "Will Alex eat 5 ghost peppers in one sitting on his Saturday stream?",
      description: "Alex is a food challenge streamer. He claims he can eat 5 Carolina Reapers in under 10 minutes without drinking water. The stream will be live on YouTube. Resolves YES if he finishes all 5 without stopping.",
    },
    {
      key: "completedNo", category: 6, proofType: 1,
      title: "Will Emma finish a 1,000-piece jigsaw puzzle in under 2 hours on stream?",
      description: "Emma does variety challenges on Twitch. She's attempting a complex 1000-piece landscape puzzle and says she can beat 2 hours. Video of the full session will be the proof. Resolves YES only if the timer shows under 2:00:00 when the last piece is placed.",
    },
    {
      key: "cancelledNoProof", category: 2, proofType: 2,
      title: "Will Jordan swim 5km in open water and livestream the full attempt?",
      description: "Jordan plans to swim 5km in a local lake next weekend. He says he will wear a waterproof livestream camera. Resolves YES if the uncut stream shows 5km completed. Creator did not submit proof — market cancelled.",
    },
    {
      key: "cancelledInvalid", category: 6, proofType: 1,
      title: "Will @PixelKing speedrun Super Mario Bros in under 5 minutes on a Saturday stream?",
      description: "PixelKing claims he has the skill to beat the original Super Mario Bros in any% under 5 minutes. He will attempt it live. Resolves YES if the in-game timer (frame-counted) shows sub-5:00 during the stream.",
    },
    {
      key: "cancelledTie", category: 6, proofType: 2,
      title: "Will Tom bench press his bodyweight for the first time on his fitness livestream?",
      description: "Tom has been training for 6 months toward this milestone. He will attempt a 1-rep max on stream with a spotter present. Resolves YES if the lift is completed with full lockout and no spotter assistance — judged from the stream footage.",
    },
  ] as const;

  for (const s of shortScenarios) {
    addrs[s.key] = await createAndBet(`Market (→${s.key})`,
      { ...base, ...short, category: s.category, proofType: s.proofType, title: s.title, description: s.description }
    );
  }

  // ── 5. Wait → close betting → submit proofs → vote ────────────────────────
  console.log("\n[5/6] Advancing markets...");
  await countdown(BETTING_SECS + BUFFER, "Waiting for betting deadlines");

  // Close betting for all 7 short/long-await markets
  for (const key of Object.keys(addrs)) {
    const bet = await ethers.getContractAt("Bet", addrs[key]) as any;
    await (await bet.checkAndCloseBetting()).wait();
    console.log(`  ✅ Betting closed: ${key}`);
  }

  // Submit proof for markets that need it (submitProof → status immediately = VOTING)
  // awaitingProof: no proof (stays AWAITING_PROOF)
  // cancelledNoProof: no proof (will be cancelled by checkAndCancelForNoProof)
  // cancelledTie: proof submitted but no votes cast → CANCELLED INSUFFICIENT_VOTES
  const submitProofFor = ["voting", "completedYes", "completedNo", "cancelledInvalid", "cancelledTie"];
  for (const key of submitProofFor) {
    const bet = await ethers.getContractAt("Bet", addrs[key]) as any;
    const url = key === "cancelledInvalid"
      ? "https://example.com/this-is-not-real-proof"
      : `https://proof.example.com/${key}`;
    await (await bet.connect(creator).submitProof(url)).wait();
    console.log(`  ✅ Proof submitted: ${key} → VOTING`);
  }

  // Vote NOW — before the short-market voting deadline expires.
  // Creator cannot vote; bettorYes/bettorNo placed bets so they cannot vote.
  // voter1 (acct 4), voter2 (acct 5), voter3 (acct 6) are all eligible.
  console.log("  Casting votes...");
  {
    const bet = await ethers.getContractAt("Bet", addrs.completedYes) as any;
    await (await bet.connect(voter1).vote(1)).wait();
    await (await bet.connect(voter2).vote(1)).wait();
    console.log("  ✅ completedYes: voter1+voter2 → YES");
  }
  {
    const bet = await ethers.getContractAt("Bet", addrs.completedNo) as any;
    await (await bet.connect(voter1).vote(2)).wait();
    await (await bet.connect(voter2).vote(2)).wait();
    console.log("  ✅ completedNo: voter1+voter2 → NO");
  }
  {
    const bet = await ethers.getContractAt("Bet", addrs.cancelledInvalid) as any;
    await (await bet.connect(voter1).vote(3)).wait();
    await (await bet.connect(voter2).vote(3)).wait();
    console.log("  ✅ cancelledInvalid: voter1+voter2 → INVALID");
  }
  {
    // voter1 YES + voter3 NO → 1:1 tie → CANCELLED TIE
    const bet = await ethers.getContractAt("Bet", addrs.cancelledTie) as any;
    await (await bet.connect(voter1).vote(1)).wait();
    await (await bet.connect(voter3).vote(2)).wait();
    console.log("  ✅ cancelledTie: voter1 → YES, voter3 → NO (tie)");
  }
  // voting: leave open — long deadline keeps it VOTING

  // Wait for short-market proof+voting deadlines to expire
  await countdown(PROOF_GAP + VOTING_GAP + BUFFER, "Waiting for proof+voting deadlines");

  // ── 6. Resolve ────────────────────────────────────────────────────────────
  console.log("\n[6/6] Resolving markets...");

  {
    const bet = await ethers.getContractAt("Bet", addrs.completedYes) as any;
    await (await bet.checkAndResolve()).wait();
    console.log("  ✅ COMPLETED YES resolved");
  }
  {
    const bet = await ethers.getContractAt("Bet", addrs.completedNo) as any;
    await (await bet.checkAndResolve()).wait();
    console.log("  ✅ COMPLETED NO resolved");
  }
  {
    const bet = await ethers.getContractAt("Bet", addrs.cancelledInvalid) as any;
    await (await bet.checkAndResolve()).wait();
    console.log("  ✅ CANCELLED INVALID resolved");
  }
  {
    const bet = await ethers.getContractAt("Bet", addrs.cancelledTie) as any;
    await (await bet.checkAndResolve()).wait();
    console.log("  ✅ CANCELLED TIE resolved");
  }
  {
    const bet = await ethers.getContractAt("Bet", addrs.cancelledNoProof) as any;
    await (await bet.checkAndCancelForNoProof()).wait();
    console.log("  ✅ CANCELLED NO_PROOF resolved");
  }

  console.log("  ✅ VOTING — left open (proof submitted, 7-day voting deadline)");
  console.log("  ✅ AWAITING_PROOF — left open (betting closed, 7-day proof deadline)");

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n════════════════════════════════════════════════════");
  console.log("  Seeding complete!");
  console.log("════════════════════════════════════════════════════");

  const rows: [string, string][] = [
    ["OPEN cold shower",       betOpen],
    ["OPEN PROOF coin $1",     addrs.proofCoin],
    ["AWAITING_PROOF",         addrs.awaitingProof],
    ["VOTING",                 addrs.voting],
    ["COMPLETED YES",          addrs.completedYes],
    ["COMPLETED NO",           addrs.completedNo],
    ["CANCELLED NO_PROOF",     addrs.cancelledNoProof],
    ["CANCELLED INVALID",      addrs.cancelledInvalid],
    ["CANCELLED (no votes)",   addrs.cancelledTie],
  ];
  for (const [state, addr] of rows) {
    console.log(`  ${state.padEnd(22)} ${addr}`);
  }
}

main().catch(err => {
  console.error("\n❌ Seeder failed:", err?.message ?? err);
  process.exitCode = 1;
});
