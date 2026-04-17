import { ethers } from "ethers";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BET_ABI = JSON.parse(readFileSync(path.join(__dirname, "../server/src/abis/Bet.json"), "utf8"));

const RPC_URL   = "https://eth-sepolia.g.alchemy.com/v2/thdZxXo78oQiiQh0KmasU";
const BET_ADDR  = process.argv[2] ?? "0x222F684dDA7B872E1491FdeF5A14A3f720572B98";

const STATUS_NAMES = ["OPEN_FOR_BETS","AWAITING_PROOF","VOTING","COMPLETED","CANCELLED","NONE"];
const CANCEL_NAMES = ["NONE","MIN_SIDE_STAKE","NO_PROOF","INSUFFICIENT_VOTES","TIE","VOTE_INVALID"];
const SIDE_NAMES   = ["NONE","YES","NO","INVALID"];

const fmt = (usdc) => `${(Number(usdc) / 1e6).toFixed(2)} USDC`;
const ts  = (t)    => t == 0 ? "—" : new Date(Number(t) * 1000).toISOString();

const provider = new ethers.JsonRpcProvider(RPC_URL);
const bet      = new ethers.Contract(BET_ADDR, BET_ABI, provider);

const [status, cancelReason, outcomeSide, details, info, resolution] = await Promise.all([
  bet.currentStatus().then(Number),
  bet.cancelReason().then(Number),
  bet.outcomeSide().then(Number),
  bet.getBetDetails(),
  bet.getBetInfo(),
  bet.getResolutionInfo(),
]);

const now = Math.floor(Date.now() / 1000);

console.log("\n═══════════════════════════════════════════════════════");
console.log(`  Bet:     ${BET_ADDR}`);
console.log("═══════════════════════════════════════════════════════");
console.log(`  Status:        ${STATUS_NAMES[status] ?? status}`);
console.log(`  Cancel reason: ${CANCEL_NAMES[cancelReason] ?? cancelReason}`);
console.log(`  Outcome side:  ${SIDE_NAMES[outcomeSide] ?? outcomeSide}`);
console.log(`  Title:         ${details.title}`);
console.log("");
console.log("  ── Deadlines ──────────────────────────────────────");
console.log(`  Betting: ${ts(details.bettingDeadline)}  ${now > Number(details.bettingDeadline) ? "(PASSED)" : "(future)"}`);
console.log(`  Proof:   ${ts(details.proofDeadline)}  ${now > Number(details.proofDeadline) ? "(PASSED)" : "(future)"}`);
console.log(`  Voting:  ${ts(details.votingDeadline)}  ${now > Number(details.votingDeadline) ? "(PASSED)" : "(future)"}`);
console.log("");
console.log("  ── Stakes ─────────────────────────────────────────");
console.log(`  Total YES:      ${fmt(info.totalYes)}`);
console.log(`  Total NO:       ${fmt(info.totalNo)}`);
console.log(`  Min side stake: ${fmt(details.minimumSideStake)}`);
console.log("");
console.log("  ── Resolution snapshot ────────────────────────────");
console.log(`  YES stake snap:     ${fmt(resolution.yesStake)}`);
console.log(`  NO  stake snap:     ${fmt(resolution.noStake)}`);
console.log(`  YES votes:          ${resolution.yesVotes}`);
console.log(`  NO  votes:          ${resolution.noVotes}`);
console.log(`  Creator collateral: ${fmt(resolution.creatorCollateralSnap)}`);
console.log(`  Bettor bonus pool:  ${fmt(resolution.bettorBonusPoolUsdc)}`);
console.log("═══════════════════════════════════════════════════════\n");
