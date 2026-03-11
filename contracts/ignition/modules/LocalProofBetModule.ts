import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import ProofBetModule from "./ProofBetModule";

// Use this module for local/localhost deployments.
// Usage: npx hardhat ignition deploy ./ignition/modules/LocalProofBetModule.ts --network localhost
const LocalProofBetModule = buildModule("LocalProofBetModule", (m) => {
  const deployer = m.getAccount(0);

  // Deploy MockERC20 as local USDC
  const mockUsdc = m.contract("MockERC20", ["Mock USDC", "mUSDC"]);

  // Mint 10,000 mock USDC to deployer (6 decimals)
  m.call(mockUsdc, "mint", [deployer, "10000000000"]);

  // Deploy the main module using the mock USDC address
  const { proofToken, trustScore, betFactory, tokenVesting } = m.useModule(
    ProofBetModule,
    { parameters: { usdcAddress: mockUsdc } }
  );

  return { mockUsdc, proofToken, trustScore, betFactory, tokenVesting };
});

export default LocalProofBetModule;
