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
      const createTx = await factory.createBet(betDetails, false, false, 0, ethers.ZeroHash);
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
        factory.createBet(invalidDetails, false, false, 0, ethers.ZeroHash)
      ).rejects.toThrow();
    });

    it('should reject bet with empty title', async () => {
      const { factory } = contracts;

      const invalidDetails = {
        ...createValidBetDetails(),
        title: '',
      };

      await expect(
        factory.createBet(invalidDetails, false, false, 0, ethers.ZeroHash)
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
      const createTx = await factory.createBet(betDetails, false, false, 0, ethers.ZeroHash);
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

      const createTx = await factory.createBet(betDetails, false, false, 0, ethers.ZeroHash);
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

      const createTx = await factory.createBet(betDetails, false, false, 0, ethers.ZeroHash);
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

  // ─────────────────────────────────────────────────────────────────────────
  // Private Bets
  // ─────────────────────────────────────────────────────────────────────────

  const JOIN_KEY      = 'test-join-key-2026';
  const WRONG_KEY     = 'wrong-key';
  const JOIN_KEY_HASH = ethers.keccak256(ethers.toUtf8Bytes(JOIN_KEY));

  describe('Private Bets — creation rules', () => {
    it('creating a private bet without a join key reverts', async () => {
      const { factory } = contracts;
      await depositToFactory(contracts.factory, contracts.proofToken, contracts.usdc, '200', '100');
      const blockTime = await getCurrentTimestamp();
      const betDetails = createValidBetDetails(21, blockTime);
      await expect(
        factory.createBet(betDetails, true, false, 0, ethers.ZeroHash)
      ).rejects.toThrow();
    });

    it('creating a private bet with a join key succeeds', async () => {
      const { factory } = contracts;
      await depositToFactory(contracts.factory, contracts.proofToken, contracts.usdc, '200', '100');
      const blockTime = await getCurrentTimestamp();
      const betDetails = createValidBetDetails(21, blockTime);
      const tx = await factory.createBet(betDetails, true, false, 0, JOIN_KEY_HASH);
      const receipt = await waitForTx(tx);
      const addr = getBetAddressFromReceipt(receipt, factory);
      expect(addr).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  describe('Private Bets — manual approve', () => {
    let bet: any;
    let betAddress: string;
    let participant: any;

    beforeAll(async () => {
      const { factory, signer, provider } = contracts;
      participant = await provider.getSigner(1);

      await depositToFactory(factory, contracts.proofToken, contracts.usdc, '200', '100');

      const blockTime = await getCurrentTimestamp();
      const betDetails = createValidBetDetails(21, blockTime);

      const createTx = await factory.createBet(betDetails, true, false, 0, JOIN_KEY_HASH);
      const receipt = await waitForTx(createTx);

      betAddress = getBetAddressFromReceipt(receipt, factory);
      bet = getBetContract(betAddress, signer);
    });

    it('isPrivate is true', async () => {
      expect(await bet.isPrivate()).toBe(true);
    });

    it('autoApprove defaults to false', async () => {
      expect(await bet.autoApprove()).toBe(false);
    });

    it('acceptingParticipants defaults to true', async () => {
      expect(await bet.acceptingParticipants()).toBe(true);
    });

    it('unregistered user cannot place a bet', async () => {
      const participantBet = getBetContract(betAddress, participant);
      await expect(
        participantBet.placeBet(1, ethers.parseUnits('50', 6))
      ).rejects.toThrow();
    });

    it('requestToJoin with wrong key reverts', async () => {
      const participantBet = getBetContract(betAddress, participant);
      await expect(
        participantBet.requestToJoin(WRONG_KEY)
      ).rejects.toThrow();
    });

    it('requestToJoin with empty string reverts', async () => {
      const participantBet = getBetContract(betAddress, participant);
      await expect(
        participantBet.requestToJoin('')
      ).rejects.toThrow();
    });

    it('requestToJoin with correct key sets joinRequested', async () => {
      const participantBet = getBetContract(betAddress, participant);
      await waitForTx(await participantBet.requestToJoin(JOIN_KEY));
      expect(await bet.joinRequested(await participant.getAddress())).toBe(true);
    });

    it('requestToJoin does NOT auto-register (manual mode)', async () => {
      expect(await bet.isRegistered(await participant.getAddress())).toBe(false);
    });

    it('approveParticipant sets joinApproved', async () => {
      const addr = await participant.getAddress();
      await waitForTx(await bet.approveParticipant(addr));
      expect(await bet.joinApproved(addr)).toBe(true);
    });

    it('register succeeds after approval', async () => {
      const participantBet = getBetContract(betAddress, participant);
      await waitForTx(await participantBet.register());
      expect(await bet.isRegistered(await participant.getAddress())).toBe(true);
    });

    it('registered user can place a bet', async () => {
      const participantBet = getBetContract(betAddress, participant);
      const participantFactory = contracts.factory.connect(participant);
      const participantUsdc = contracts.usdc.connect(participant);
      const amt = ethers.parseUnits('200', 6);
      await waitForTx(await contracts.usdc.mint(await participant.getAddress(), amt));
      await waitForTx(await participantUsdc.approve(await contracts.factory.getAddress(), amt));
      await waitForTx(await participantFactory.depositUsdc(amt));

      const betTx = await participantBet.placeBet(1, ethers.parseUnits('50', 6));
      await waitForTx(betTx);
      expect(await bet.totalYesStake()).toBeGreaterThan(0n);
    });

    it('rejectParticipant blacklists the requester', async () => {
      const { provider } = contracts;
      const newUser = await provider.getSigner(2);
      const newUserBet = getBetContract(betAddress, newUser);
      await waitForTx(await newUserBet.requestToJoin(JOIN_KEY));

      const addr = await newUser.getAddress();
      await waitForTx(await bet.rejectParticipant(addr));
      expect(await bet.joinRequested(addr)).toBe(false);
      expect(await bet.joinBlacklisted(addr)).toBe(true);
    });

    it('blacklisted user cannot re-request', async () => {
      const { provider } = contracts;
      const newUser = await provider.getSigner(2);
      const newUserBet = getBetContract(betAddress, newUser);
      await expect(
        newUserBet.requestToJoin(JOIN_KEY)
      ).rejects.toThrow();
    });

    it('setAcceptingParticipants(false) blocks new requests', async () => {
      await waitForTx(await bet.setAcceptingParticipants(false));
      expect(await bet.acceptingParticipants()).toBe(false);

      const { provider } = contracts;
      const lateUser = await provider.getSigner(7);
      const lateBet = getBetContract(betAddress, lateUser);
      await expect(
        lateBet.requestToJoin(JOIN_KEY)
      ).rejects.toThrow();
    });

    it('setAcceptingParticipants(true) re-opens requests', async () => {
      await waitForTx(await bet.setAcceptingParticipants(true));
      expect(await bet.acceptingParticipants()).toBe(true);
    });
  });

  describe('Private Bets — bulk approve / reject', () => {
    let bet: any;
    let betAddress: string;
    let p1: any;
    let p2: any;

    beforeAll(async () => {
      const { factory, signer, provider } = contracts;
      p1 = await provider.getSigner(3);
      p2 = await provider.getSigner(4);

      await depositToFactory(factory, contracts.proofToken, contracts.usdc, '200', '100');
      const blockTime = await getCurrentTimestamp();
      const betDetails = createValidBetDetails(21, blockTime);

      const createTx = await factory.createBet(betDetails, true, false, 0, JOIN_KEY_HASH);
      const receipt = await waitForTx(createTx);
      betAddress = getBetAddressFromReceipt(receipt, factory);
      bet = getBetContract(betAddress, signer);

      await waitForTx(await getBetContract(betAddress, p1).requestToJoin(JOIN_KEY));
      await waitForTx(await getBetContract(betAddress, p2).requestToJoin(JOIN_KEY));
    });

    it('approveAllParticipants approves both pending users', async () => {
      const [a1, a2] = [await p1.getAddress(), await p2.getAddress()];
      await waitForTx(await bet.approveAllParticipants([a1, a2]));
      expect(await bet.joinApproved(a1)).toBe(true);
      expect(await bet.joinApproved(a2)).toBe(true);
    });
  });

  describe('Private Bets — bulk reject', () => {
    let bet: any;
    let betAddress: string;
    let p1: any;
    let p2: any;

    beforeAll(async () => {
      const { factory, signer, provider } = contracts;
      p1 = await provider.getSigner(5);
      p2 = await provider.getSigner(6);

      await depositToFactory(factory, contracts.proofToken, contracts.usdc, '200', '100');
      const blockTime = await getCurrentTimestamp();
      const betDetails = createValidBetDetails(21, blockTime);

      const createTx = await factory.createBet(betDetails, true, false, 0, JOIN_KEY_HASH);
      const receipt = await waitForTx(createTx);
      betAddress = getBetAddressFromReceipt(receipt, factory);
      bet = getBetContract(betAddress, signer);

      await waitForTx(await getBetContract(betAddress, p1).requestToJoin(JOIN_KEY));
      await waitForTx(await getBetContract(betAddress, p2).requestToJoin(JOIN_KEY));
    });

    it('rejectAllParticipants blacklists both pending users', async () => {
      const [a1, a2] = [await p1.getAddress(), await p2.getAddress()];
      await waitForTx(await bet.rejectAllParticipants([a1, a2]));
      expect(await bet.joinBlacklisted(a1)).toBe(true);
      expect(await bet.joinBlacklisted(a2)).toBe(true);
      expect(await bet.joinRequested(a1)).toBe(false);
    });
  });

  describe('Private Bets — auto-approve', () => {
    let bet: any;
    let betAddress: string;
    let p1: any;
    let p2: any;

    beforeAll(async () => {
      const { factory, signer, provider } = contracts;
      p1 = await provider.getSigner(3);
      p2 = await provider.getSigner(4);

      await depositToFactory(factory, contracts.proofToken, contracts.usdc, '200', '100');

      const blockTime = await getCurrentTimestamp();
      const betDetails = createValidBetDetails(21, blockTime);

      const createTx = await factory.createBet(betDetails, true, true, 0, JOIN_KEY_HASH);
      const receipt = await waitForTx(createTx);

      betAddress = getBetAddressFromReceipt(receipt, factory);
      bet = getBetContract(betAddress, signer);
    });

    it('autoApprove is true on creation', async () => {
      expect(await bet.autoApprove()).toBe(true);
    });

    it('correct key immediately registers the user', async () => {
      const p1Bet = getBetContract(betAddress, p1);
      await waitForTx(await p1Bet.requestToJoin(JOIN_KEY));
      expect(await bet.isRegistered(await p1.getAddress())).toBe(true);
      expect(await bet.autoApprovedCount()).toBeGreaterThan(0n);
    });

    it('wrong key reverts even in auto-approve mode', async () => {
      const p2Bet = getBetContract(betAddress, p2);
      await expect(
        p2Bet.requestToJoin(WRONG_KEY)
      ).rejects.toThrow();
    });

    it('setAutoApprove can switch to manual', async () => {
      await waitForTx(await bet.setAutoApprove(false, 0));
      expect(await bet.autoApprove()).toBe(false);

      const p2Bet = getBetContract(betAddress, p2);
      await waitForTx(await p2Bet.requestToJoin(JOIN_KEY));
      expect(await bet.isRegistered(await p2.getAddress())).toBe(false);
    });
  });

  describe('Private Bets — auto-approve with cap', () => {
    let bet: any;
    let betAddress: string;

    beforeAll(async () => {
      const { factory, signer } = contracts;

      await depositToFactory(factory, contracts.proofToken, contracts.usdc, '200', '100');

      const blockTime = await getCurrentTimestamp();
      const betDetails = createValidBetDetails(21, blockTime);

      const createTx = await factory.createBet(betDetails, true, true, 1, JOIN_KEY_HASH);
      const receipt = await waitForTx(createTx);

      betAddress = getBetAddressFromReceipt(receipt, factory);
      bet = getBetContract(betAddress, signer);
    });

    it('first request is auto-registered (under cap)', async () => {
      const { provider } = contracts;
      const u1 = await provider.getSigner(5);
      const u1Bet = getBetContract(betAddress, u1);
      await waitForTx(await u1Bet.requestToJoin(JOIN_KEY));
      expect(await bet.isRegistered(await u1.getAddress())).toBe(true);
    });

    it('second request is NOT auto-registered (cap reached)', async () => {
      const { provider } = contracts;
      const u2 = await provider.getSigner(6);
      const u2Bet = getBetContract(betAddress, u2);
      await waitForTx(await u2Bet.requestToJoin(JOIN_KEY));
      expect(await bet.isRegistered(await u2.getAddress())).toBe(false);
      expect(await bet.joinRequested(await u2.getAddress())).toBe(true);
    });
  });
});