// frontend/src/__tests__/integration/basic-flow.test.ts

import { ethers } from 'ethers';
import {
  setupContracts,
  depositToFactory,
  createValidBetDetails,
  getBetContract,
  getBetAddressFromReceipt,
  advanceTime,
  waitForTx,
  getCurrentTimestamp,
} from '../helpers/contracts';

/**
 * Basic Integration Tests
 * Tests fundamental contract interactions
 * 
 * Prerequisites:
 * 1. Hardhat node running: npx hardhat node
 * 2. Contracts deployed to localhost
 * 3. Update addresses in setup.ts
 */

describe('Basic Integration Tests', () => {
  let contracts: any;

  beforeAll(async () => {
    contracts = await setupContracts();
    console.log('Connected to contracts at:', {
      factory: await contracts.factory.getAddress(),
      user: contracts.userAddress,
    });
  });

  describe('Contract Connection', () => {
    it('should connect to factory contract', async () => {
      const { factory } = contracts;
      
      // Check contract has code (is deployed)
      const code = await contracts.provider.getCode(await factory.getAddress());
      expect(code).not.toEqual('0x');
      expect(code.length).toBeGreaterThan(2);
    });

    it('should connect to PROOF token', async () => {
      const { proofToken } = contracts;
      
      const code = await contracts.provider.getCode(await proofToken.getAddress());
      expect(code).not.toEqual('0x');
    });

    it('should connect to USDC token', async () => {
      const { usdc } = contracts;
      
      const code = await contracts.provider.getCode(await usdc.getAddress());
      expect(code).not.toEqual('0x');
    });

    it('should have correct user address', async () => {
      const { userAddress } = contracts;
      
      expect(userAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  describe('Token Deposits', () => {
    it('should deposit PROOF tokens', async () => {
      const { factory, proofToken, userAddress } = contracts;
      
      const amount = ethers.parseEther('50');

      // Approve
      const approveTx = await proofToken.approve(
        await factory.getAddress(),
        amount
      );
      await waitForTx(approveTx);

      // Get balance before
      const [, balanceBefore] = await factory.getInternalBalances(userAddress);

      // Deposit
      const depositTx = await factory.depositProof(amount);
      await waitForTx(depositTx);

      // Get balance after
      const [, balanceAfter] = await factory.getInternalBalances(userAddress);

      // Verify balance increased
      expect(balanceAfter - balanceBefore).toEqual(amount);
    });

    it('should deposit USDC tokens', async () => {
      const { factory, usdc, userAddress } = contracts;
      
      const amount = ethers.parseUnits('500', 6);

      // Mint USDC first
      const mintTx = await usdc.mint(userAddress, amount);
      await waitForTx(mintTx);

      // Approve
      const approveTx = await usdc.approve(
        await factory.getAddress(),
        amount
      );
      await waitForTx(approveTx);

      // Get balance before
      const [balanceBefore] = await factory.getInternalBalances(userAddress);

      // Deposit
      const depositTx = await factory.depositUsdc(amount);
      await waitForTx(depositTx);

      // Get balance after
      const [balanceAfter] = await factory.getInternalBalances(userAddress);

      // Verify balance increased
      expect(balanceAfter - balanceBefore).toEqual(amount);
    });
  });

  describe('Bet Creation', () => {
    beforeAll(async () => {
      // Ensure user has enough tokens
      await depositToFactory(
        contracts.factory,
        contracts.proofToken,
        contracts.usdc,
        '250', // enough for 200 PROOF dynamic fee + buffer
        '1000' // 1000 USDC
      );
    });

    it('should create a new bet', async () => {
      const { factory, userAddress } = contracts;

      const blockTime = await getCurrentTimestamp();
      const betDetails = createValidBetDetails(21, blockTime);

      // Create bet
      const createTx = await factory.createBet(betDetails);
      const receipt = await waitForTx(createTx);

      // Get bet address from event
      const betAddress = getBetAddressFromReceipt(receipt, factory);

      // Verify bet was created
      expect(betAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);

      // Verify it's from factory
      const isFromFactory = await factory.isBetFromFactory(betAddress);
      expect(isFromFactory).toBe(true);

      // Get bet contract
      const bet = getBetContract(betAddress, contracts.signer);

      // Verify creator
      const creator = await bet.creator();
      expect(creator).toEqual(userAddress);

      // Verify status is OPEN_FOR_BETS (0)
      const status = await bet.currentStatus();
      expect(status).toEqual(0n);
    });

    it('should reject bet with past deadline', async () => {
      const { factory } = contracts;
      
      const now = Math.floor(Date.now() / 1000);
      const invalidDetails = {
        ...createValidBetDetails(),
        bettingDeadline: now - 1, // Past
      };

      await expect(
        factory.createBet(invalidDetails)
      ).rejects.toThrow();
    });

    it('should reject bet with empty title', async () => {
      const { factory } = contracts;
      
      const invalidDetails = {
        ...createValidBetDetails(),
        title: '',
      };

      await expect(
        factory.createBet(invalidDetails)
      ).rejects.toThrow();
    });

    it('should calculate dynamic fee correctly', async () => {
      const { factory } = contracts;

      const blockTime = await getCurrentTimestamp();
      const shortBet = createValidBetDetails(3, blockTime); // 3 days
      const longBet = createValidBetDetails(21, blockTime); // 21 days

      const shortFee = await factory.calculateDynamicCreationFee(shortBet);
      const longFee = await factory.calculateDynamicCreationFee(longBet);

      // Long duration should cost more
      expect(longFee).toBeGreaterThan(shortFee);
    });
  });

  describe('Betting Flow', () => {
    let betContract: any;
    let betAddress: string;

    beforeAll(async () => {
      const { factory, signer } = contracts;

      // Ensure enough PROOF balance for creation fee
      await depositToFactory(contracts.factory, contracts.proofToken, contracts.usdc, '200', '100');

      // Use blockchain timestamp (not Date.now()) to avoid drift from advanceTime calls
      const blockTime = await getCurrentTimestamp();
      const betDetails = createValidBetDetails(21, blockTime);
      const createTx = await factory.createBet(betDetails);
      const receipt = await waitForTx(createTx);

      betAddress = getBetAddressFromReceipt(receipt, factory);
      betContract = getBetContract(betAddress, signer);

      console.log('Created bet for testing:', betAddress);
    });

    it('should place a YES bet', async () => {
      const amount = ethers.parseUnits('50', 6);

      // Place bet
      const betTx = await betContract.placeBet(1, amount); // 1 = YES
      await waitForTx(betTx);

      // Verify stake increased
      const totalYesStake = await betContract.totalYesStake();
      expect(totalYesStake).toBeGreaterThanOrEqual(amount);
    });

    it('should place a NO bet', async () => {
      const amount = ethers.parseUnits('60', 6);

      // Place bet
      const betTx = await betContract.placeBet(2, amount); // 2 = NO
      await waitForTx(betTx);

      // Verify stake increased
      const totalNoStake = await betContract.totalNoStake();
      expect(totalNoStake).toBeGreaterThanOrEqual(amount);
    });

    it('should reject bet below minimum', async () => {
      const tooLow = ethers.parseUnits('5', 6); // Below min

      await expect(
        betContract.placeBet(1, tooLow)
      ).rejects.toThrow();
    });

    it('should get bet details', async () => {
      const details = await betContract.details();

      expect(details.title).toBe('Test Bet');
      expect(details.minimumBetAmount).toEqual(ethers.parseUnits('10', 6));
    });
  });

  describe('Proof Submission', () => {
    let betContract: any;

    beforeAll(async () => {
      const { factory, signer } = contracts;

      // Ensure enough PROOF balance for creation fee
      await depositToFactory(contracts.factory, contracts.proofToken, contracts.usdc, '200', '100');

      // Use blockchain timestamp to avoid drift from advanceTime calls
      const now = await getCurrentTimestamp();
      const betDetails = {
        ...createValidBetDetails(21, now),
        bettingDeadline: now + 60, // 1 minute
      };

      const createTx = await factory.createBet(betDetails);
      const receipt = await waitForTx(createTx);
      const betAddress = getBetAddressFromReceipt(receipt, factory);

      betContract = getBetContract(betAddress, signer);

      // Place bets on both sides
      await betContract.placeBet(1, ethers.parseUnits('60', 6));
      await betContract.placeBet(2, ethers.parseUnits('70', 6));

      // Advance time past betting deadline
      await advanceTime(61);

      // Close betting
      const closeTx = await betContract.checkAndCloseBetting();
      await waitForTx(closeTx);
    });

    it('should submit valid proof', async () => {
      const proofUrl = 'https://ipfs.io/ipfs/QmTest123';

      // Submit proof
      const proofTx = await betContract.submitProof(proofUrl);
      await waitForTx(proofTx);

      // Verify status changed to VOTING (2)
      const status = await betContract.currentStatus();
      expect(status).toEqual(2n);
    });

    it('should reject HTTP URLs', async () => {
      // Create another bet for this test
      const { factory, signer } = contracts;

      // Deposit PROOF for creation fee and advance time past lock period
      await depositToFactory(contracts.factory, contracts.proofToken, contracts.usdc, '200', '100');

      const now = await getCurrentTimestamp();
      const betDetails = {
        ...createValidBetDetails(21, now),
        bettingDeadline: now + 60,
      };

      const createTx = await factory.createBet(betDetails);
      const receipt = await waitForTx(createTx);
      const betAddress = getBetAddressFromReceipt(receipt, factory);
      const bet = getBetContract(betAddress, signer);

      // Place bets and close
      await bet.placeBet(1, ethers.parseUnits('60', 6));
      await bet.placeBet(2, ethers.parseUnits('70', 6));
      await advanceTime(61);
      await bet.checkAndCloseBetting();

      // Try HTTP URL
      await expect(
        bet.submitProof('http://example.com/proof')
      ).rejects.toThrow();
    });
  });
});