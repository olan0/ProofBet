import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// Use this module for local/localhost deployments.
// Inlines all contract deployments (does NOT use m.useModule) so that
// mockUsdc can be passed directly as a constructor argument to BetFactory.
// (Hardhat Ignition m.getParameter cannot accept contract futures — passing
//  mockUsdc via m.useModule parameters silently falls back to the default
//  Sepolia USDC address, causing depositUsdc to fail on the local node.)
//
// Usage:
//   npx hardhat ignition deploy ./ignition/modules/LocalProofBetModule.ts \
//     --network localhost
const LocalProofBetModule = buildModule("LocalProofBetModule", (m) => {
  const deployer = m.getAccount(0);

  // ── 1. Deploy MockERC20 as local USDC ──────────────────────────────────────
  const mockUsdc = m.contract("MockERC20", ["Mock USDC", "mUSDC"]);

  // Mint 10,000 mUSDC to deployer (6 decimals)
  m.call(mockUsdc, "mint", [deployer, "10000000000"], { id: "mintToDeployer" });

  // ── 2. Deploy core contracts ───────────────────────────────────────────────
  const proofToken      = m.contract("ProofToken");
  const trustScore      = m.contract("TrustScore");
  const betImplementation = m.contract("Bet");

  // ── 3. Deploy BetFactory with mockUsdc passed directly ────────────────────
  const betFactory = m.contract("BetFactory", [
    trustScore,
    mockUsdc,                        // ← local MockERC20, not Sepolia USDC
    proofToken,
    deployer,                        // fee collector
    "100000000000000000000",         // creationFee  = 100 PROOF  (18 dec)
    "10000000",                      // creationStake = 10 USDC   (6 dec)
    "10000000000000000000",          // voteStake     = 10 PROOF  (18 dec)
    20,                              // maxActiveBets
    betImplementation,
  ]);

  // ── 4. Deploy TokenVesting ─────────────────────────────────────────────────
  const tokenVesting = m.contract("TokenVesting", [proofToken]);

  // ── 5. Post-deployment authorizations ─────────────────────────────────────
  m.call(trustScore, "authorizeContract", [betFactory, true]);
  m.call(proofToken, "authorizeBurner",   [betFactory, true]);

  return { mockUsdc, proofToken, trustScore, betFactory, tokenVesting };
});

export default LocalProofBetModule;
