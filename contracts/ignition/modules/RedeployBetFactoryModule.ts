/**
 * RedeployBetFactoryModule
 *
 * Redeploys TrustScore, Bet (implementation), and BetFactory on Sepolia,
 * reusing the already-deployed ProofToken and USDC.
 *
 * Existing addresses (chain-11155111):
 *   USDC        0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238  (Circle Sepolia)
 *   ProofToken  0xfaB32c9b6736E5Bc6D44a591DAa267d8D723c83D
 *
 * Usage:
 *   npx hardhat ignition deploy ./ignition/modules/RedeployBetFactoryModule.ts \
 *     --network sepolia \
 *     --deployment-id redeploy-bet-factory
 *
 * Optional parameter overrides (pass via --parameters '{"key":"value"}'):
 *   proofTokenAddress   — override ProofToken address
 *   usdcAddress         — override USDC address
 *   creationFee         — PROOF tokens (18 dec) charged per bet creation
 *   creationStake       — USDC collateral (6 dec) locked by creator
 *   voteStake           — base PROOF stake (18 dec) required to vote
 *   maxActiveBets       — max concurrent active bets per user
 */

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const EXISTING = {
  USDC:       "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  ProofToken: "0xfaB32c9b6736E5Bc6D44a591DAa267d8D723c83D",
};

const RedeployBetFactoryModule = buildModule("RedeployBetFactoryModule", (m) => {
  const deployer = m.getAccount(0);

  // ── Existing contracts (no redeploy) ────────────────────────────────────────
  const proofToken = m.contractAt(
    "ProofToken",
    m.getParameter("proofTokenAddress", EXISTING.ProofToken),
  );

  const usdcAddress = m.contractAt(
    "IERC20",
    m.getParameter("usdcAddress", EXISTING.USDC),
  );

  // ── Parameters ───────────────────────────────────────────────────────────────
  const creationFee   = m.getParameter("creationFee",   "100000000000000000000"); // 100 PROOF
  const creationStake = m.getParameter("creationStake", "50000000");              // 50 USDC
  const voteStake     = m.getParameter("voteStake",     "10000000000000000000");  // 10 PROOF
  const maxActiveBets = m.getParameter("maxActiveBets", 5);

  // ── New deployments ───────────────────────────────────────────────────────────
  const trustScore        = m.contract("TrustScore");
  const betImplementation = m.contract("Bet");

  const betFactory = m.contract("BetFactory", [
    trustScore,
    usdcAddress,
    proofToken,
    deployer,        // fee collector
    creationFee,
    creationStake,
    voteStake,
    maxActiveBets,
    betImplementation,
  ]);

  // ── Authorizations ────────────────────────────────────────────────────────────
  m.call(trustScore, "authorizeContract", [betFactory, true], { id: "authorizeTrustScore" });
  m.call(proofToken, "authorizeBurner",   [betFactory, true], { id: "authorizeBurner" });

  return { trustScore, betImplementation, betFactory };
});

export default RedeployBetFactoryModule;
