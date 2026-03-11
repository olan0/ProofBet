import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// This module is designed to be network-aware.
// On local networks (hardhat/localhost), it deploys a MockUSDC contract.
// On other networks (like Sepolia or mainnet), it uses a pre-configured address.
const ProofBetModule = buildModule("SepoliaProofBetModule", (m) => {
  // --- Get Deployer ---
  const deployer = m.getAccount(0);

  // --- Network-Specific USDC Configuration ---
  // Pass the USDC address as a parameter. Defaults to Circle's Sepolia USDC.
  // For local deployment with MockUSDC, deploy MockERC20 separately and pass its address:
  //   npx hardhat ignition deploy ./ignition/modules/ProofBetModule.ts --network localhost --parameters '{"usdcAddress": "0x<MockERC20Address>", "maxActiveBets": 5}'
  // For testnet (uses real Circle USDC by default):
  //   npx hardhat ignition deploy ./ignition/modules/ProofBetModule.ts --network sepolia
  const SEPOLIA_USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
  const usdcAddressParam = m.getParameter("usdcAddress", SEPOLIA_USDC_ADDRESS);
  const usdcAddress = m.contractAt("IERC20", usdcAddressParam);

  // --- Deployment Parameters ---
  const BET_CREATION_FEE = m.getParameter(
    "creationFee",
    "100000000000000000000" // 100 PROOF
  );
  const BET_CREATION_STAKE = m.getParameter(
    "creationStake",
    "50000000" // 50 USDC
  );
  const VOTE_STAKE_AMOUNT = m.getParameter(
    "voteStake",
    "10000000000000000000" // 10 PROOF
  );
  // NEW: Parameter for max active bets
  const MAX_ACTIVE_BETS = m.getParameter(
    "maxActiveBets",
    5 // Default to 5
  );

  // --- 1. Deploy Core Contracts (with dependencies handled by Ignition) ---
  const proofToken = m.contract("ProofToken");
  const trustScore = m.contract("TrustScore");

  // --- 2. Deploy BetFactory ---
  // Ignition automatically resolves the addresses from the 'proofToken', 'trustScore',
  // and 'usdcAddress' contract futures.
  //deploy Bet singele implementation for factory
  const betImplementation = m.contract("Bet");
  const betFactory = m.contract("BetFactory", [
    trustScore,
    usdcAddress,
    proofToken,
    deployer, // Fee collector address
    BET_CREATION_FEE,
    BET_CREATION_STAKE,
    VOTE_STAKE_AMOUNT,
    MAX_ACTIVE_BETS, // NEW
    betImplementation, // NEW
  ]);
  
  // --- 3. Deploy TokenVesting ---
  const tokenVesting = m.contract("TokenVesting", [proofToken]);

  // --- 4. Post-Deployment Authorizations ---
  // The owner (deployer) authorizes BetFactory to update trust scores.
  m.call(trustScore, "authorizeContract", [betFactory, true]);
  
  // The owner (deployer) authorizes BetFactory to burn PROOF tokens.
  // This was moved from the BetFactory constructor to here for correctness.
  m.call(proofToken, "authorizeBurner", [betFactory, true]);

  // --- Return Deployed Contract Addresses ---
  // These can be accessed after deployment for verification.
  return { proofToken, trustScore, betFactory, tokenVesting, usdcAddress };
});

export default ProofBetModule;