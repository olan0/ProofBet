/**
 * Inspect a single Bet contract — prints status, deadlines, stakes, and resolution info.
 * Usage: NETWORK=sepolia npx hardhat run scripts/inspectBet.ts
 */

import { network } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

const NETWORK    = process.env.HARDHAT_NETWORK ?? process.env.NETWORK ?? "localhost";
const CHAIN_TYPE = process.env.CHAIN_TYPE ?? "l1";
const BET_ADDRESS = process.env.BET_ADDRESS ?? "0x222F684dDA7B872E1491FdeF5A14A3f720572B98";

const { ethers } = await network.connect({ network: NETWORK, chainType: CHAIN_TYPE });

const STATUS_NAMES = ["OPEN_FOR_BETS", "AWAITING_PROOF", "VOTING", "COMPLETED", "CANCELLED", "NONE"];
const CANCEL_NAMES = ["NONE", "MIN_SIDE_STAKE", "NO_PROOF", "INSUFFICIENT_VOTES", "TIE", "VOTE_INVALID"];
const SIDE_NAMES   = ["NONE", "YES", "NO", "INVALID"];

function fmt(usdc: bigint) { return `${(Number(usdc) / 1e6).toFixed(2)} USDC`; }
function ts(t: bigint)     { return t === 0n ? "—" : new Date(Number(t) * 1000).toISOString(); }

const bet = await ethers.getContractAt("Bet", BET_ADDRESS);

const status       = Number(await bet.currentStatus());
const cancelReason = Number(await bet.cancelReason());
const outcomeSide  = Number(await bet.outcomeSide());
const details      = await bet.getBetDetails();
const info         = await bet.getBetInfo();
const resolution   = await bet.getResolutionInfo();

const now = Math.floor(Date.now() / 1000);

console.log("\n═══════════════════════════════════════════════════════");
console.log(`  Bet: ${BET_ADDRESS}`);
console.log(`  Network: ${NETWORK}`);
console.log("═══════════════════════════════════════════════════════");
console.log(`  Status:        ${STATUS_NAMES[status] ?? status}`);
console.log(`  Cancel reason: ${CANCEL_NAMES[cancelReason] ?? cancelReason}`);
console.log(`  Outcome side:  ${SIDE_NAMES[outcomeSide] ?? outcomeSide}`);
console.log("");
console.log(`  Title:         ${details.title}`);
console.log("");
console.log("  ── Deadlines ──────────────────────────────────────");
console.log(`  Betting:   ${ts(details.bettingDeadline)}  ${now > Number(details.bettingDeadline) ? "(PASSED)" : "(future)"}`);
console.log(`  Proof:     ${ts(details.proofDeadline)}  ${now > Number(details.proofDeadline) ? "(PASSED)" : "(future)"}`);
console.log(`  Voting:    ${ts(details.votingDeadline)}  ${now > Number(details.votingDeadline) ? "(PASSED)" : "(future)"}`);
console.log("");
console.log("  ── Stakes ─────────────────────────────────────────");
console.log(`  Total YES: ${fmt(info.totalYes)}`);
console.log(`  Total NO:  ${fmt(info.totalNo)}`);
console.log(`  Min side stake: ${fmt(details.minimumSideStake)}`);
console.log("");
console.log("  ── Resolution snapshot ────────────────────────────");
console.log(`  YES stake snap: ${fmt(resolution.yesStake)}`);
console.log(`  NO  stake snap: ${fmt(resolution.noStake)}`);
console.log(`  YES votes:      ${resolution.yesVotes}`);
console.log(`  NO  votes:      ${resolution.noVotes}`);
console.log(`  Creator collateral: ${fmt(resolution.creatorCollateralSnap)}`);
console.log(`  Bettor bonus pool:  ${fmt(resolution.bettorBonusPoolUsdc)}`);
console.log("═══════════════════════════════════════════════════════\n");
