import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// This module is designed to be network-aware.
// On local networks (hardhat/localhost), it deploys a MockUSDC contract.
// On other networks (like Sepolia or mainnet), it uses a pre-configured address.
const ProofBetModule = buildModule("ProofBetModule", (m) => {
  // --- Get Deployer ---
  const deployer = m.getAccount(0);

  // --- Network-Specific USDC Configuration ---
  // Use Ignition parameters to control USDC address
  // For local deployment: npx hardhat ignition deploy ./ignition/modules/ProofBetModule.ts --network localhost --parameters '{"useLocalUSDC": true, "maxActiveBets": 5}'
  // For testnet: npx hardhat ignition deploy ./ignition/modules/ProofBetModule.ts --network sepolia --parameters '{"maxActiveBets": 5}'
  const useLocalUSDC = m.getParameter("useLocalUSDC", false);
  const SEPOLIA_USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7a9c";

  let usdcAddress;

  if (useLocalUSDC) {
    // For local testing, deploy a mock ERC20 token and mint some to the deployer.
    const mockUsdc = m.contract("MockERC20", ["Mock USDC", "mUSDC"]);
    usdcAddress = mockUsdc;

    // Mint 10,000 mock USDC to the deployer (USDC has 6 decimals)
    m.call(mockUsdc, "mint", [deployer, "10000000000"]); // 10,000 * 10^6
  } else {
    // For live networks, use the official USDC contract address.
    // We create a contract "from" an existing address.
    usdcAddress = m.contractAt("IERC20", SEPOLIA_USDC_ADDRESS);
  }

  // --- Deployment Parameters ---
  const BET_CREATION_FEE = m.getParameter(
    "creationFee",
    "100000000000000000000" // 100 PROOF
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
  const betFactory = m.contract("BetFactory", [
    trustScore,
    usdcAddress,
    proofToken,
    deployer, // Fee collector address
    BET_CREATION_FEE,
    VOTE_STAKE_AMOUNT,
    MAX_ACTIVE_BETS, // NEW
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