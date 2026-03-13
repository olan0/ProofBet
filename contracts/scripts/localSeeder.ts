/**
 * Local Hardhat Seeder — reads deployed contracts + seeds 9 scenarios
 *
 * Prerequisites:
 *   1. Start local node:
 *      npx hardhat node                                                (terminal 1)
 *   2. Deploy contracts via Ignition:
 *      npx hardhat ignition deploy ./ignition/modules/LocalProofBetModule.ts \
 *        --network localhost --parameters '{"creationStake":"10000000","maxActiveBets":20}'
 *   3. Run this seeder:
 *      npx hardhat run scripts/localSeeder.ts --network localhost      (terminal 2)
 *
 * Addresses are read from:
 *   ignition/deployments/chain-31337/deployed_addresses.json
 *
 * Scenarios
 * ─────────
 *   1  OPEN cold shower              (7-day betting deadline)
 *   2  OPEN PROOF coin               (7-day betting deadline)
 *   3  AWAITING_PROOF                (betting closed, long proof window)
 *   4  VOTING                        (proof submitted, long voting window)
 *   5  COMPLETED YES                 (2 YES votes → YES wins)
 *   6  COMPLETED NO                  (2 NO  votes → NO  wins)
 *   7  CANCELLED NO_PROOF            (proof deadline passed, no proof)
 *   8  CANCELLED INVALID             (majority INVALID votes)
 *   9  CANCELLED TIE                 (1 YES + 1 NO → tie)
 */

import { network } from "hardhat";
import { ethers as ethersLib } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ─── Timing ────────────────────────────────────────────────────────────────

const BETTING_SECS = 15 * 60;   // 15 min
const PROOF_GAP    = 60 * 60;   // 1 h  (contract minimum)
const VOTING_GAP   = 60 * 60;   // 1 h  (contract minimum)
const BUFFER       = 10;        // seconds past each deadline

// ─── Token amounts ──────────────────────────────────────────────────────────

const USDC_MINT     = 10_000_000_000n;  // 10 000 USDC (6 dec)
const PROOF_MINT    = 50_000n * 10n**18n;  // 50 000 PROOF (18 dec)
const BET_SIZE      = 10_000_000n;      // 10 USDC

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getBetAddress(factory: any, receipt: any): string {
  for (const log of receipt.logs) {
    try {
      const p = factory.interface.parseLog(log);
      if (p?.name === "BetCreated") return p.args.betAddress;
    } catch {}
  }
  throw new Error("BetCreated event not found");
}

async function mine(ethers: any, seconds: number) {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine", []);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const { ethers } = await network.connect({ network: "localhost", chainType: "l1" });
  const signers = await ethers.getSigners();
  const [deployer, creator, bettorYes, bettorNo, voter1, voter2, voter3] = signers;

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  ProofBet Local Seeder — read deployment + seed 9 scenarios");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(`  deployer   ${deployer.address}`);
  console.log(`  creator    ${creator.address}`);
  console.log(`  bettorYes  ${bettorYes.address}`);
  console.log(`  bettorNo   ${bettorNo.address}`);
  console.log(`  voter1     ${voter1.address}`);
  console.log(`  voter2     ${voter2.address}`);
  console.log(`  voter3     ${voter3.address}`);

  // ── 1. Load deployed addresses ───────────────────────────────────────────

  console.log("\n[1/4] Loading deployed contract addresses...");

  const deployedAddressesPath = path.join(
    __dirname, "..", "ignition", "deployments", "chain-31337", "deployed_addresses.json"
  );
  if (!fs.existsSync(deployedAddressesPath)) {
    console.error(`\n❌ deployed_addresses.json not found at:\n   ${deployedAddressesPath}`);
    console.error("\n   Run Ignition deploy first:");
    console.error("   npx hardhat ignition deploy ./ignition/modules/LocalProofBetModule.ts \\");
    console.error("     --network localhost --parameters '{\"creationStake\":\"10000000\",\"maxActiveBets\":20}'");
    process.exit(1);
  }

  const deployed = JSON.parse(fs.readFileSync(deployedAddressesPath, "utf8"));

  const factoryAddress    = deployed["SepoliaProofBetModule#BetFactory"];
  const proofTokenAddress = deployed["SepoliaProofBetModule#ProofToken"];
  const trustScoreAddress = deployed["SepoliaProofBetModule#TrustScore"];
  const usdcAddress       = deployed["LocalProofBetModule#MockERC20"];

  if (!factoryAddress || !proofTokenAddress || !trustScoreAddress || !usdcAddress) {
    console.error("\n❌ One or more required addresses missing from deployed_addresses.json:");
    console.error(JSON.stringify(deployed, null, 2));
    process.exit(1);
  }

  const factory    = await ethers.getContractAt("BetFactory",  factoryAddress)    as any;
  const proofToken = await ethers.getContractAt("ProofToken",  proofTokenAddress) as any;
  const usdc       = await ethers.getContractAt("MockERC20",   usdcAddress)       as any;

  console.log(`  ✅ BetFactory   ${factoryAddress}`);
  console.log(`  ✅ ProofToken   ${proofTokenAddress}`);
  console.log(`  ✅ TrustScore   ${trustScoreAddress}`);
  console.log(`  ✅ MockUSDC     ${usdcAddress}`);

  // ── 2. Fund accounts ─────────────────────────────────────────────────────

  console.log("\n[2/4] Funding accounts...");

  // Mint USDC to all participants
  for (const acct of [creator, bettorYes, bettorNo, voter1, voter2, voter3]) {
    await (await usdc.mint(acct.address, USDC_MINT)).wait();
  }
  console.log("  ✅ USDC minted to all accounts");

  // Transfer PROOF from deployer (who got initial supply)
  for (const acct of [creator, bettorYes, bettorNo, voter1, voter2, voter3]) {
    await (await proofToken.transfer(acct.address, PROOF_MINT)).wait();
  }
  console.log("  ✅ PROOF transferred to all accounts");

  // Approve factory for all accounts
  for (const acct of [creator, bettorYes, bettorNo, voter1, voter2, voter3]) {
    await (await usdc.connect(acct).approve(factoryAddress, ethers.MaxUint256)).wait();
    await (await proofToken.connect(acct).approve(factoryAddress, ethers.MaxUint256)).wait();
  }
  console.log("  ✅ Approvals set");

  // Deposit into factory internal wallets
  await (await factory.connect(creator).depositUsdc(2_000_000_000n)).wait();    // 2000 USDC
  await (await factory.connect(creator).depositProof(PROOF_MINT)).wait();       // 50 000 PROOF
  await (await factory.connect(bettorYes).depositUsdc(500_000_000n)).wait();    // 500 USDC
  await (await factory.connect(bettorNo).depositUsdc(500_000_000n)).wait();     // 500 USDC
  await (await factory.connect(voter1).depositProof(5_000n * 10n**18n)).wait(); // 5 000 PROOF
  await (await factory.connect(voter2).depositProof(5_000n * 10n**18n)).wait();
  await (await factory.connect(voter3).depositProof(5_000n * 10n**18n)).wait();
  console.log("  ✅ Internal wallet deposits done");

  // ── 3. Create markets ────────────────────────────────────────────────────

  console.log("\n[3/4] Creating markets...");

  const block = await ethers.provider.getBlock("latest");
  const ts = Number(block!.timestamp);

  const base = {
    minimumBetAmount:  1n,
    minimumSideStake:  1n,
    minimumTrustScore: 0,
    minimumVotes:      1,
  };

  const long = {
    bettingDeadline: ts + 86400 * 7,
    proofDeadline:   ts + 86400 * 8,
    votingDeadline:  ts + 86400 * 9,
  };

  async function create(details: object): Promise<string> {
    const tx = await factory.connect(creator).createBet(details, false, ethers.ZeroHash);
    const r  = await tx.wait();
    return getBetAddress(factory, r);
  }

  async function createAndBet(label: string, details: object): Promise<string> {
    process.stdout.write(`  Creating ${label}...`);
    const addr = await create(details);
    process.stdout.write(` ${addr}\n`);
    const bet = await ethers.getContractAt("Bet", addr) as any;
    await (await bet.connect(bettorYes).placeBet(1, BET_SIZE)).wait();
    await (await bet.connect(bettorNo ).placeBet(2, BET_SIZE)).wait();
    return addr;
  }

  async function createPrivateAndBet(label: string, details: object, inviteKey: string): Promise<string> {
    const keyBytes  = ethersLib.encodeBytes32String(inviteKey);
    const keyHash   = ethersLib.keccak256(keyBytes);
    process.stdout.write(`  Creating ${label}...`);
    const tx = await factory.connect(creator).createBet(details, true, keyHash);
    const r  = await tx.wait();
    const addr = getBetAddress(factory, r);
    process.stdout.write(` ${addr}\n`);
    const bet = await ethers.getContractAt("Bet", addr) as any;
    await (await bet.connect(bettorYes).registerWithKey(keyBytes)).wait();
    await (await bet.connect(bettorNo ).registerWithKey(keyBytes)).wait();
    await (await bet.connect(voter1   ).registerWithKey(keyBytes)).wait();
    await (await bet.connect(voter2   ).registerWithKey(keyBytes)).wait();
    await (await bet.connect(voter3   ).registerWithKey(keyBytes)).wait();
    await (await bet.connect(bettorYes).placeBet(1, BET_SIZE)).wait();
    await (await bet.connect(bettorNo ).placeBet(2, BET_SIZE)).wait();
    console.log(`    🔒 key="${inviteKey}"  hash=${keyHash.slice(0, 10)}...`);
    return addr;
  }

  // OPEN markets — long deadlines (stay open forever)
  const betOpen = await createAndBet("1. OPEN cold shower", {
    ...base, ...long, category: 6, proofType: 2,
    title: "Will @CoachMike complete a 30-day cold shower challenge streamed live every morning?",
    description: "Mike has committed to streaming a cold shower every morning for 30 days on Twitch starting April 1. Resolves YES if all 30 sessions are streamed live with no breaks. Proof = full stream VODs.",
  });

  const freshBlock = await ethers.provider.getBlock("latest");
  const freshTs = Number(freshBlock!.timestamp);

  const short = {
    bettingDeadline: freshTs + BETTING_SECS,
    proofDeadline:   freshTs + BETTING_SECS + PROOF_GAP,
    votingDeadline:  freshTs + BETTING_SECS + PROOF_GAP + VOTING_GAP,
  };
  const longAwait = {
    bettingDeadline: freshTs + BETTING_SECS,
    proofDeadline:   freshTs + BETTING_SECS + 7 * 86400,
    votingDeadline:  freshTs + BETTING_SECS + 7 * 86400 + 3600,
  };
  const votingLong = {
    bettingDeadline: freshTs + BETTING_SECS,
    proofDeadline:   freshTs + BETTING_SECS + PROOF_GAP,
    votingDeadline:  freshTs + BETTING_SECS + PROOF_GAP + 7 * 86400,
  };

  const addrs: Record<string, string> = {};

  addrs.privateBet = await createPrivateAndBet("10. OPEN PRIVATE (private challenge)", {
    ...base, ...long, category: 6, proofType: 2,
    title: "Will @CryptoChad complete a 7-day no-social-media detox? (private)",
    description: "A private challenge between friends. Chad has committed to zero social media usage for 7 days. Only invited participants can view and bet on this market.",
  }, "proofbet-secret-2026");

  addrs.proofCoin = await createAndBet("2. OPEN PROOF coin", {
    ...base, ...long, category: 1, proofType: 4,
    title: "Will the PROOF token reach $1.00 before the end of 2026?",
    description: "Resolves YES if the PROOF token trades at or above $1.00 USD on any major DEX for at least 5 consecutive minutes before December 31, 2026 23:59 UTC.",
  });

  addrs.awaitingProof = await createAndBet("3. AWAITING_PROOF (Sara half-marathon)", {
    ...base, ...longAwait, category: 2, proofType: 2,
    title: "Will Sara run her first half-marathon and finish under 2h30m — streamed live?",
    description: "Sara trains on stream every week. She has entered a local half-marathon on April 20. Bet resolves YES if she crosses the finish line with an official chip time under 2:30:00.",
  });

  addrs.voting = await createAndBet("4. VOTING (Dave guitar)", {
    ...base, ...votingLong, category: 6, proofType: 2,
    title: "Will Dave learn and perform a full song on guitar within 30 days — live on stream?",
    description: "Dave is a complete beginner picking up guitar on camera. Can he learn Wonderwall start-to-finish and perform it on a live stream before the deadline?",
  });

  addrs.completedYes = await createAndBet("5. → COMPLETED YES (Alex ghost peppers)", {
    ...base, ...short, category: 6, proofType: 2,
    title: "Will Alex eat 5 ghost peppers in one sitting on his Saturday stream?",
    description: "Alex is a food challenge streamer. He claims he can eat 5 Carolina Reapers in under 10 minutes without drinking water.",
  });

  addrs.completedNo = await createAndBet("6. → COMPLETED NO (Emma jigsaw)", {
    ...base, ...short, category: 6, proofType: 1,
    title: "Will Emma finish a 1,000-piece jigsaw puzzle in under 2 hours on stream?",
    description: "Emma does variety challenges on Twitch. She's attempting a complex 1000-piece landscape puzzle and says she can beat 2 hours.",
  });

  addrs.cancelledNoProof = await createAndBet("7. → CANCELLED NO_PROOF (Jordan swim)", {
    ...base, ...short, category: 2, proofType: 2,
    title: "Will Jordan swim 5km in open water and livestream the full attempt?",
    description: "Jordan plans to swim 5km in a local lake next weekend. He says he will wear a waterproof livestream camera.",
  });

  addrs.cancelledInvalid = await createAndBet("8. → CANCELLED INVALID (PixelKing speedrun)", {
    ...base, ...short, category: 6, proofType: 1,
    title: "Will @PixelKing speedrun Super Mario Bros in under 5 minutes on a Saturday stream?",
    description: "PixelKing claims he has the skill to beat the original Super Mario Bros in any% under 5 minutes.",
  });

  addrs.cancelledTie = await createAndBet("9. → CANCELLED TIE (Tom bench press)", {
    ...base, ...short, category: 6, proofType: 2,
    title: "Will Tom bench press his bodyweight for the first time on his fitness livestream?",
    description: "Tom has been training for 6 months toward this milestone. He will attempt a 1-rep max on stream with a spotter present.",
  });

  // ── 4. Advance time + close betting + submit proofs + vote ───────────────

  console.log("\n[4/4] Advancing markets...");

  // Close betting for all short/await/voting markets
  await mine(ethers, BETTING_SECS + BUFFER);
  console.log("  ⏩ Time advanced past betting deadlines");

  for (const key of ["awaitingProof", "voting", "completedYes", "completedNo",
                      "cancelledNoProof", "cancelledInvalid", "cancelledTie"]) {
    const bet = await ethers.getContractAt("Bet", addrs[key]) as any;
    await (await bet.checkAndCloseBetting()).wait();
  }
  console.log("  ✅ Betting closed for all 7 short-deadline markets");

  // Submit proofs (awaitingProof and cancelledNoProof get no proof)
  for (const key of ["voting", "completedYes", "completedNo", "cancelledInvalid", "cancelledTie"]) {
    const bet = await ethers.getContractAt("Bet", addrs[key]) as any;
    const url = key === "cancelledInvalid"
      ? "https://example.com/not-real-proof"
      : `https://proof.example.com/${key}`;
    await (await bet.connect(creator).submitProof(url)).wait();
  }
  console.log("  ✅ Proofs submitted (awaitingProof & cancelledNoProof have no proof)");

  // Cast votes
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
    const bet = await ethers.getContractAt("Bet", addrs.cancelledTie) as any;
    await (await bet.connect(voter1).vote(1)).wait();
    await (await bet.connect(voter3).vote(2)).wait();
    console.log("  ✅ cancelledTie: voter1 YES, voter3 NO (tie)");
  }

  // Advance time past proof + voting deadlines for short markets
  await mine(ethers, PROOF_GAP + VOTING_GAP + BUFFER);
  console.log("  ⏩ Time advanced past proof+voting deadlines");

  // Resolve
  {
    const bet = await ethers.getContractAt("Bet", addrs.completedYes) as any;
    await (await bet.checkAndResolve()).wait();
    console.log("  ✅ COMPLETED YES");
  }
  {
    const bet = await ethers.getContractAt("Bet", addrs.completedNo) as any;
    await (await bet.checkAndResolve()).wait();
    console.log("  ✅ COMPLETED NO");
  }
  {
    const bet = await ethers.getContractAt("Bet", addrs.cancelledInvalid) as any;
    await (await bet.checkAndResolve()).wait();
    console.log("  ✅ CANCELLED INVALID");
  }
  {
    const bet = await ethers.getContractAt("Bet", addrs.cancelledTie) as any;
    await (await bet.checkAndResolve()).wait();
    console.log("  ✅ CANCELLED TIE");
  }
  {
    const bet = await ethers.getContractAt("Bet", addrs.cancelledNoProof) as any;
    await (await bet.checkAndCancelForNoProof()).wait();
    console.log("  ✅ CANCELLED NO_PROOF");
  }

  // ── Summary ─────────────────────────────────────────────────────────────

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  Seeding complete!");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("\n  Contract addresses:");
  console.log(`    BetFactory : ${factoryAddress}`);
  console.log(`    ProofToken : ${proofTokenAddress}`);
  console.log(`    TrustScore : ${trustScoreAddress}`);
  console.log(`    MockUSDC   : ${usdcAddress}`);

  console.log("\n  Deployed bet addresses:");
  const rows: [string, string][] = [
    ["OPEN cold shower",     betOpen],
    ["OPEN PROOF coin $1",   addrs.proofCoin],
    ["OPEN PRIVATE",         addrs.privateBet],
    ["AWAITING_PROOF",       addrs.awaitingProof],
    ["VOTING",               addrs.voting],
    ["COMPLETED YES",        addrs.completedYes],
    ["COMPLETED NO",         addrs.completedNo],
    ["CANCELLED NO_PROOF",   addrs.cancelledNoProof],
    ["CANCELLED INVALID",    addrs.cancelledInvalid],
    ["CANCELLED TIE",        addrs.cancelledTie],
  ];
  for (const [state, addr] of rows) {
    console.log(`    ${state.padEnd(20)} ${addr}`);
  }

  console.log(`\n  🔒 Private bet invite key: "proofbet-secret-2026"`);
  // ABIs, addresses, and server/.env are synced automatically by the
  // post-deploy hook in hardhat.config.ts when `ignition deploy` runs.
}

main().catch(err => {
  console.error("\n❌ Seeder failed:", err?.message ?? err);
  if (err?.data) console.error("   Error data:", err.data);
  process.exitCode = 1;
});
