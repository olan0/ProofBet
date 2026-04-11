// frontend/src/__tests__/helpers/contracts.ts

import { ethers } from 'ethers';

// Import your ABIs (adjust paths as needed)
// These should be in your frontend src folder
// import FactoryABI from '../../abis/BetFactory.json';
// import ProofTokenABI from '../../abis/ProofToken.json';
// import USDCABI from '../../abis/MockERC20.json';
// import BetABI from '../../abis/Bet.json';

// For now, we'll use minimal ABIs for testing
// You should replace these with your actual ABIs
const BET_DETAILS_TUPLE = 'tuple(string title, string description, uint256 bettingDeadline, uint256 proofDeadline, uint256 votingDeadline, uint256 minimumBetAmount, uint256 minimumSideStake, uint8 minimumTrustScore, uint256 minimumVotes, uint8 category, uint8 proofType)';

const FactoryABI = [
  `function createBet(${BET_DETAILS_TUPLE} details, bool isPrivate, bool autoApprove, uint256 maxAutoApprove, bytes32 joinKeyHash) returns (address)`,
  'function depositProof(uint256 amount)',
  'function depositUsdc(uint256 amount)',
  'function withdrawProof(uint256 amount)',
  'function withdrawUsdc(uint256 amount)',
  'function getInternalBalances(address user) view returns (uint256 usdcBalance, uint256 proofBalance)',
  `function calculateDynamicCreationFee(${BET_DETAILS_TUPLE} details) view returns (uint256)`,
  'function isBetFromFactory(address bet) view returns (bool)',
  'function creationFeeProof() view returns (uint256)',
  'function proofCollateralUsdc() view returns (uint256)',
  'function privateBetFeeProof() view returns (uint256)',
  'event BetCreated(address betAddress, address creator, bool isPrivate)',
];

const ProofTokenABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

const USDCABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function mint(address to, uint256 amount)',
];

const BetABI = [
  'function placeBet(uint8 side, uint256 amount)',
  'function submitProof(string proofUrl)',
  'function vote(uint8 voteChoice)',
  'function checkAndCloseBetting()',
  'function checkAndResolve()',
  'function claimBettor()',
  'function claimVoter()',
  'function claimCreatorCollateral()',
  'function currentStatus() view returns (uint8)',
  'function totalYesStake() view returns (uint256)',
  'function totalNoStake() view returns (uint256)',
  'function creator() view returns (address)',
  'function details() view returns (string title, string description, uint256 bettingDeadline, uint256 proofDeadline, uint256 votingDeadline, uint256 minimumBetAmount, uint256 minimumSideStake, uint8 minimumTrustScore, uint256 minimumVotes, uint8 category, uint8 proofType)',
  // ── Private bet ──
  'function isPrivate() view returns (bool)',
  'function acceptingParticipants() view returns (bool)',
  'function autoApprove() view returns (bool)',
  'function maxAutoApprove() view returns (uint256)',
  'function autoApprovedCount() view returns (uint256)',
  'function joinKeyHash() view returns (bytes32)',
  'function joinRequested(address) view returns (bool)',
  'function joinApproved(address) view returns (bool)',
  'function joinBlacklisted(address) view returns (bool)',
  'function isRegistered(address) view returns (bool)',
  'function requestToJoin(string key)',
  'function approveParticipant(address participant)',
  'function rejectParticipant(address participant)',
  'function approveAllParticipants(address[] participants)',
  'function rejectAllParticipants(address[] participants)',
  'function register()',
  'function setAutoApprove(bool enabled, uint256 maxCount)',
  'function setAcceptingParticipants(bool accepting)',
  'event JoinRequested(address indexed participant)',
  'event ParticipantApproved(address indexed participant, bool wasAutoApproved)',
  'event ParticipantRejected(address indexed participant)',
  'event AutoApproveChanged(bool enabled, uint256 maxCount)',
];

export interface ContractSetup {
  provider: ethers.Provider;
  signer: ethers.Signer;
  factory: ethers.Contract;
  proofToken: ethers.Contract;
  usdc: ethers.Contract;
  userAddress: string;
}

/**
 * Setup contract instances for testing
 */
export async function setupContracts(): Promise<ContractSetup> {
  const rpcUrl = process.env.REACT_APP_RPC_URL || 'http://127.0.0.1:8545';
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  // Get first signer from Hardhat node
  const signer = await provider.getSigner(0);
  const userAddress = await signer.getAddress();

  // Get contract addresses from env
  const factoryAddress = process.env.REACT_APP_FACTORY_ADDRESS!;
  const proofTokenAddress = process.env.REACT_APP_PROOF_TOKEN_ADDRESS!;
  const usdcAddress = process.env.REACT_APP_USDC_ADDRESS!;

  // Create contract instances
  const factory = new ethers.Contract(factoryAddress, FactoryABI, signer);
  const proofToken = new ethers.Contract(proofTokenAddress, ProofTokenABI, signer);
  const usdc = new ethers.Contract(usdcAddress, USDCABI, signer);

  return {
    provider,
    signer,
    factory,
    proofToken,
    usdc,
    userAddress,
  };
}

/**
 * Get a bet contract instance
 */
export function getBetContract(
  address: string,
  signer: ethers.Signer
): ethers.Contract {
  return new ethers.Contract(address, BetABI, signer);
}

/**
 * Create a valid bet details object
 */
export function createValidBetDetails(durationDays: number = 21, baseTimestamp?: number) {
  const now = baseTimestamp ?? Math.floor(Date.now() / 1000);
  
  return {
    title: 'Test Bet',
    description: 'This is a test bet for integration testing',
    bettingDeadline: now + 7 * 86400,
    proofDeadline: now + 14 * 86400,
    votingDeadline: now + durationDays * 86400,
    minimumBetAmount: ethers.parseUnits('10', 6), // 10 USDC
    minimumSideStake: ethers.parseUnits('50', 6), // 50 USDC
    minimumTrustScore: 0,
    minimumVotes: 3,
    category: 1, // CRYPTO
    proofType: 1, // VIDEO
  };
}

/**
 * Fund a user with tokens for testing
 */
export async function fundUser(
  usdc: ethers.Contract,
  proofToken: ethers.Contract,
  userAddress: string,
  usdcAmount: string = '10000', // 10,000 USDC
  proofAmount: string = '1000'   // 1,000 PROOF
) {
  // Mint USDC
  const usdcTx = await usdc.mint(userAddress, ethers.parseUnits(usdcAmount, 6));
  await usdcTx.wait();

  // Transfer PROOF from deployer
  const proofTx = await proofToken.transfer(userAddress, ethers.parseEther(proofAmount));
  await proofTx.wait();
}

/**
 * Approve and deposit tokens to factory
 */
export async function depositToFactory(
  factory: ethers.Contract,
  proofToken: ethers.Contract,
  usdc: ethers.Contract,
  proofAmount: string = '100', // 100 PROOF
  usdcAmount: string = '1000'   // 1000 USDC
) {
  const proofAmountWei = ethers.parseEther(proofAmount);
  const usdcAmountWei = ethers.parseUnits(usdcAmount, 6);

  // Approve PROOF
  const approveProofTx = await proofToken.approve(
    await factory.getAddress(),
    proofAmountWei
  );
  await approveProofTx.wait();

  // Approve USDC
  const approveUsdcTx = await usdc.approve(
    await factory.getAddress(),
    usdcAmountWei
  );
  await approveUsdcTx.wait();

  // Deposit PROOF
  const depositProofTx = await factory.depositProof(proofAmountWei);
  await depositProofTx.wait();

  // Deposit USDC
  const depositUsdcTx = await factory.depositUsdc(usdcAmountWei);
  await depositUsdcTx.wait();

  // Wait for deposit lock period
  await advanceTime(3601); // 1 hour + 1 second
}

/**
 * Advance blockchain time
 */
export async function advanceTime(seconds: number) {
  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  await provider.send('evm_increaseTime', [seconds]);
  await provider.send('evm_mine', []);
}

/**
 * Get current blockchain timestamp
 */
export async function getCurrentTimestamp(): Promise<number> {
  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  const block = await provider.getBlock('latest');
  return block!.timestamp;
}

/**
 * Wait for a transaction and return receipt
 */
export async function waitForTx(tx: any) {
  const receipt = await tx.wait();
  if (receipt.status !== 1) {
    throw new Error('Transaction failed');
  }
  return receipt;
}

/**
 * Extract bet address from BetCreated event
 */
export function getBetAddressFromReceipt(
  receipt: any,
  factoryContract: ethers.Contract
): string {
  for (const log of receipt.logs) {
    try {
      const parsed = factoryContract.interface.parseLog(log);
      if (parsed && parsed.name === 'BetCreated') {
        return parsed.args[0]; // betAddress
      }
    } catch (e) {
      // Ignore logs that aren't from the factory
    }
  }
  throw new Error('BetCreated event not found in receipt');
}
