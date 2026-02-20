// test/ProofBet.test.js
import { expect } from "chai";
import { network } from "hardhat";

describe("ProofBet Platform", function () {
  // Contracts
  let factory, betImplementation, proofToken, trustScore, usdc;
  let ethers;
  
  // Signers
  let deployer, alice, bob, charlie, dave, eve;
  let signers;
  
  // Constants
  const CREATION_FEE = "10000000000000000000"; // 10 PROOF
  const PROOF_COLLATERAL = "100000000"; // 100 USDC
  const INITIAL_VOTE_STAKE = "5000000000000000000"; // 5 PROOF
  const MAX_ACTIVE_BETS = 10;
  const INITIAL_PROOF_SUPPLY = "1000000000000000000000"; // 1000 PROOF
  const INITIAL_USDC_SUPPLY = "10000000000"; // 10,000 USDC
  const DEPOSIT_LOCK_PERIOD = 3600; // 1 hour

  before(async function () {
    // Connect to network and get ethers
    const networkConnection = await network.connect({
      network: "hardhatMainnet",
      chainType: "l1",
    });
    ethers = networkConnection.ethers;
    
    // Get signers
    signers = await ethers.getSigners();
    [deployer, alice, bob, charlie, dave, eve] = signers;
  });

  beforeEach(async function () {
    // Deploy contracts manually (same as your Ignition module)
    
    // 1. Deploy MockERC20 (USDC) - make sure this file exists in contracts/test/
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    usdc = await MockERC20.deploy("Mock USDC", "mUSDC");
    await usdc.waitForDeployment();
    
    // Mint initial USDC to deployer
    await usdc.mint(deployer.address, "10000000000"); // 10,000 USDC

    // 2. Deploy ProofToken (no _FIXED suffix)
    const ProofToken = await ethers.getContractFactory("ProofToken");
    proofToken = await ProofToken.deploy();
    await proofToken.waitForDeployment();

    // 3. Deploy TrustScore (no _FIXED suffix)
    const TrustScore = await ethers.getContractFactory("TrustScore");
    trustScore = await TrustScore.deploy();
    await trustScore.waitForDeployment();

    // 4. Deploy Bet implementation (no _FIXED suffix)
    const Bet = await ethers.getContractFactory("Bet");
    betImplementation = await Bet.deploy();
    await betImplementation.waitForDeployment();

    // 5. Deploy BetFactory (no _FIXED suffix)
    const BetFactory = await ethers.getContractFactory("BetFactory");
    factory = await BetFactory.deploy(
      await trustScore.getAddress(),
      await usdc.getAddress(),
      await proofToken.getAddress(),
      deployer.address, // feeCollector
      CREATION_FEE,
      PROOF_COLLATERAL,
      INITIAL_VOTE_STAKE,
      MAX_ACTIVE_BETS,
      await betImplementation.getAddress()
    );
    await factory.waitForDeployment();

    // 6. Authorize factory (same as Ignition module)
    await proofToken.authorizeBurner(await factory.getAddress(), true);
    await trustScore.authorizeContract(await factory.getAddress(), true);

    // 7. Distribute tokens to test users
    const users = [alice, bob, charlie, dave, eve];
    for (const user of users) {
      // Transfer PROOF tokens
      await proofToken.transfer(user.address, INITIAL_PROOF_SUPPLY);
      
      // Mint USDC tokens
      await usdc.mint(user.address, INITIAL_USDC_SUPPLY);
      
      // Approve factory
      await proofToken.connect(user).approve(await factory.getAddress(), ethers.MaxUint256);
      await usdc.connect(user).approve(await factory.getAddress(), ethers.MaxUint256);
    }
  });

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  async function createValidBetDetails() {
    const latestBlock = await ethers.provider.getBlock("latest");
    const now = latestBlock.timestamp;
    
    return {
      title: "Bitcoin will reach $100k by end of 2026",
      description: "BTC price prediction",
      bettingDeadline: now + 7 * 24 * 3600,
      proofDeadline: now + 14 * 24 * 3600,
      votingDeadline: now + 21 * 24 * 3600,
      minimumBetAmount: "10000000", // 10 USDC
      minimumSideStake: "50000000", // 50 USDC
      minimumTrustScore: 0,
      minimumVotes: 3,
      category: 1, // CRYPTO
      proofType: 1  // VIDEO
    };
  }

  async function increaseTime(seconds) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine");
  }

  async function depositAndCreateBet(user) {
    // Deposit funds
    await factory.connect(user).depositProof(BigInt(CREATION_FEE) + BigInt("100000000000000000000"));
    await factory.connect(user).depositUsdc(BigInt(PROOF_COLLATERAL) + BigInt("500000000"));
    
    // Wait for deposit lock period
    await increaseTime(DEPOSIT_LOCK_PERIOD + 1);
    
    // Create bet
    const details = await createValidBetDetails();
    const tx = await factory.connect(user).createBet(details);
    const receipt = await tx.wait();
    
    // Get bet address from event
    const event = receipt.logs.find(log => {
      try {
        const parsed = factory.interface.parseLog(log);
        return parsed && parsed.name === 'BetCreated';
      } catch {
        return false;
      }
    });
    
    const betAddress = factory.interface.parseLog(event).args[0];
    return await ethers.getContractAt("Bet", betAddress);
  }

  async function placeBet(bet, user, side, amount) {
    const [usdcBalance] = await factory.getInternalBalances(user.address);
    if (usdcBalance < amount) {
      await factory.connect(user).depositUsdc(BigInt(amount) - BigInt(usdcBalance) + BigInt("100000000"));
    }
    await bet.connect(user).placeBet(side, amount);
  }

  async function submitProof(bet, creator, proofUrl) {
    await bet.connect(creator).submitProof(proofUrl);
  }

  async function vote(bet, voter, voteChoice) {
    const [, proofBalance] = await factory.getInternalBalances(voter.address);
    const requiredStake = await factory.calculateRequiredStake(voter.address);
    
    if (proofBalance < requiredStake) {
      await factory.connect(voter).depositProof(BigInt(requiredStake) - BigInt(proofBalance) + BigInt("10000000000000000000"));
    }
    
    await bet.connect(voter).vote(voteChoice);
  }

  // ============================================
  // DEPLOYMENT TESTS
  // ============================================

  describe("Deployment", function () {
    it("Should deploy all contracts correctly", async function () {
      expect(await factory.trustScoreContract()).to.equal(await trustScore.getAddress());
      expect(await factory.usdcToken()).to.equal(await usdc.getAddress());
      expect(await factory.proofToken()).to.equal(await proofToken.getAddress());
      expect(await factory.feeCollector()).to.equal(deployer.address);
    });

    it("Should have correct initial parameters", async function () {
      expect(await factory.creationFeeProof()).to.equal(CREATION_FEE);
      expect(await factory.proofCollateralUsdc()).to.equal(PROOF_COLLATERAL);
      expect(await factory.maxActiveBetsPerUser()).to.equal(MAX_ACTIVE_BETS);
    });

    it("Should have authorized factory in TrustScore", async function () {
      expect(await trustScore.authorizedContracts(await factory.getAddress())).to.be.true;
    });

    it("Should have authorized factory as burner in ProofToken", async function () {
      expect(await proofToken.authorizedBurners(await factory.getAddress())).to.be.true;
    });
  });

  // ============================================
  // DEPOSIT/WITHDRAW TESTS
  // ============================================

  describe("Deposits and Withdrawals", function () {
    it("Should deposit USDC", async function () {
      const amount = "100000000"; // 100 USDC
      await factory.connect(alice).depositUsdc(amount);
      
      const [balance] = await factory.getInternalBalances(alice.address);
      expect(balance).to.equal(amount);
    });

    it("Should deposit PROOF", async function () {
      const amount = "100000000000000000000"; // 100 PROOF
      await factory.connect(alice).depositProof(amount);
      
      const [, balance] = await factory.getInternalBalances(alice.address);
      expect(balance).to.equal(amount);
    });

    it("Should withdraw USDC", async function () {
      const amount = "100000000";
      await factory.connect(alice).depositUsdc(amount);
      await factory.connect(alice).withdrawUsdc(amount);
      
      const [balance] = await factory.getInternalBalances(alice.address);
      expect(balance).to.equal(0);
    });

    it("Should fail to withdraw more than balance", async function () {
      await factory.connect(alice).depositUsdc("100000000");
      await expect(
        factory.connect(alice).withdrawUsdc("200000000")
      ).to.be.revertedWith("Insufficient internal USDC");
    });
  });

  // ============================================
  // BET CREATION TESTS
  // ============================================

  describe("Bet Creation", function () {
    it("Should create a bet", async function () {
      const bet = await depositAndCreateBet(alice);
      
      expect(await bet.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await factory.isBetFromFactory(await bet.getAddress())).to.be.true;
      expect(await bet.creator()).to.equal(alice.address);
      expect(await bet.currentStatus()).to.equal(0); // OPEN_FOR_BETS
    });

    it("Should emit BetCreated event", async function () {
      await factory.connect(alice).depositProof(BigInt(CREATION_FEE) + BigInt("100000000000000000000"));
      await factory.connect(alice).depositUsdc(BigInt(PROOF_COLLATERAL) + BigInt("500000000"));
      await increaseTime(DEPOSIT_LOCK_PERIOD + 1);
      
      const details = await createValidBetDetails();
      await expect(factory.connect(alice).createBet(details))
        .to.emit(factory, "BetCreated");
    });

    it("Should fail without collateral", async function () {
      await factory.connect(alice).depositProof(BigInt(CREATION_FEE) + BigInt("100000000000000000000")); // Extra PROOF
      // Don't deposit USDC collateral - this is what should cause the failure
      await increaseTime(DEPOSIT_LOCK_PERIOD + 1);
      
      const details = await createValidBetDetails();
      await expect(
        factory.connect(alice).createBet(details)
      ).to.be.revertedWith("Insufficient collateral");
    });

    it("Should fail with past deadline", async function () {
      await factory.connect(alice).depositProof(BigInt(CREATION_FEE) + BigInt("100000000000000000000"));
      await factory.connect(alice).depositUsdc(BigInt(PROOF_COLLATERAL) + BigInt("100000000"));
      await increaseTime(DEPOSIT_LOCK_PERIOD + 1);
      
      const latestBlock = await ethers.provider.getBlock("latest");
      const now = latestBlock.timestamp;
      const details = await createValidBetDetails();
      details.bettingDeadline = now - 1; // Past deadline
      
      await expect(
        factory.connect(alice).createBet(details)
      ).to.be.revertedWith("Betting deadline must be future");
    });

    it("Should fail with empty title", async function () {
      await factory.connect(alice).depositProof(BigInt(CREATION_FEE) + BigInt("100000000000000000000"));
      await factory.connect(alice).depositUsdc(BigInt(PROOF_COLLATERAL) + BigInt("100000000"));
      await increaseTime(DEPOSIT_LOCK_PERIOD + 1);
      
      const details = await createValidBetDetails();
      details.title = "";
      
      await expect(
        factory.connect(alice).createBet(details)
      ).to.be.revertedWith("Empty title");
    });

    it("Should burn fees on creation", async function () {
      const burnPercentage = await proofToken.feeBurnPercentage();
      const baseFee = await factory.creationFeeProof();
      const feeCollectorAddr = await factory.feeCollector();
      
      console.log("\n=== BEFORE ===");
      console.log("Burn percentage:", burnPercentage.toString());
      console.log("Base creation fee:", baseFee.toString());
      console.log("Fee collector:", feeCollectorAddr);
      
      const totalSupplyBefore = await proofToken.totalSupply();
      const factoryBalBefore = await proofToken.balanceOf(await factory.getAddress());
      const feeCollectorBalBefore = await proofToken.balanceOf(feeCollectorAddr);
      
      console.log("Total supply before:", totalSupplyBefore.toString());
      console.log("Factory balance before:", factoryBalBefore.toString());
      console.log("Fee collector balance before:", feeCollectorBalBefore.toString());
      
      // Create bet
      await factory.connect(alice).depositProof(BigInt(baseFee) * BigInt(3)); // 30 PROOF to be safe
      await factory.connect(alice).depositUsdc(BigInt(PROOF_COLLATERAL) + BigInt("500000000"));
      await increaseTime(DEPOSIT_LOCK_PERIOD + 1);
      
      const details = await createValidBetDetails();
      
      // Check what the dynamic fee will be
      const dynamicFee = await factory.calculateDynamicCreationFee(details);
      console.log("Dynamic fee for this bet:", dynamicFee.toString());
      
      await factory.connect(alice).createBet(details);
      
      console.log("\n=== AFTER ===");
      const totalSupplyAfter = await proofToken.totalSupply();
      const factoryBalAfter = await proofToken.balanceOf(await factory.getAddress());
      const feeCollectorBalAfter = await proofToken.balanceOf(feeCollectorAddr);
      
      console.log("Total supply after:", totalSupplyAfter.toString());
      console.log("Factory balance after:", factoryBalAfter.toString());
      console.log("Fee collector balance after:", feeCollectorBalAfter.toString());
      
      const expectedBurn = (BigInt(dynamicFee) * BigInt(burnPercentage)) / BigInt(100);
      const actualBurned = totalSupplyBefore - totalSupplyAfter;
      const feeCollectorGained = feeCollectorBalAfter - feeCollectorBalBefore;
      
      console.log("\n=== RESULTS ===");
      console.log("Expected burn (50% of dynamic fee):", expectedBurn.toString());
      console.log("Actual burned:", actualBurned.toString());
      console.log("Fee collector gained:", feeCollectorGained.toString());
      console.log("Total accounted:", (actualBurned + feeCollectorGained).toString());
      
      expect(actualBurned).to.equal(expectedBurn);
    });
  });

  // ============================================
  // FLASH LOAN PROTECTION TESTS
  // ============================================

  describe("Flash Loan Protection", function () {
    it("Should prevent immediate bet creation after deposit", async function () {
      await factory.connect(alice).depositProof(CREATION_FEE);
      await factory.connect(alice).depositUsdc(PROOF_COLLATERAL);
      
      const details = await createValidBetDetails();
      await expect(
        factory.connect(alice).createBet(details)
      ).to.be.revertedWith("Funds locked (flash loan protection)");
    });

    it("Should allow bet creation after lock period", async function () {
      await factory.connect(alice).depositProof(BigInt(CREATION_FEE) + BigInt("100000000000000000000"));
      await factory.connect(alice).depositUsdc(BigInt(PROOF_COLLATERAL) + BigInt("100000000"));
      
      await increaseTime(DEPOSIT_LOCK_PERIOD + 1);
      
      const details = await createValidBetDetails();
      const tx = await factory.connect(alice).createBet(details);
      await expect(tx).to.emit(factory, "BetCreated");
    });
  });

  // ============================================
  // BETTING PHASE TESTS
  // ============================================

  describe("Betting Phase", function () {
    it("Should place a bet", async function () {
      const bet = await depositAndCreateBet(alice);
      const betAmount = "50000000"; // 50 USDC
      
      await placeBet(bet, bob, 1, betAmount); // Side.YES = 1
      
      expect(await bet.totalYesStake()).to.equal(betAmount);
    });

    it("Should place bets on both sides", async function () {
      const bet = await depositAndCreateBet(alice);
      
      await placeBet(bet, bob, 1, "60000000"); // YES
      await placeBet(bet, charlie, 2, "70000000"); // NO
      
      expect(await bet.totalYesStake()).to.equal("60000000");
      expect(await bet.totalNoStake()).to.equal("70000000");
    });

    it("Should fail to bet after deadline", async function () {
      const bet = await depositAndCreateBet(alice);
      
      await increaseTime(8 * 24 * 3600); // 8 days
      
      await expect(
        placeBet(bet, bob, 1, "50000000")
      ).to.be.revertedWith("Betting closed");
    });
  });

  // ============================================
  // PROOF SUBMISSION TESTS
  // ============================================

  describe("Proof Submission", function () {
    it("Should submit valid proof", async function () {
      const bet = await depositAndCreateBet(alice);
      
      await placeBet(bet, bob, 1, "60000000");
      await placeBet(bet, charlie, 2, "70000000");
      
      await increaseTime(8 * 24 * 3600);
      await bet.checkAndCloseBetting();
      
      await submitProof(bet, alice, "https://ipfs.io/ipfs/QmTest123");
      
      expect(await bet.currentStatus()).to.equal(2); // VOTING
      expect(await bet.proofUrl()).to.equal("https://ipfs.io/ipfs/QmTest123");
    });

    it("Should fail with invalid proof URL", async function () {
      const bet = await depositAndCreateBet(alice);
      
      await placeBet(bet, bob, 1, "60000000");
      await placeBet(bet, charlie, 2, "70000000");
      
      await increaseTime(8 * 24 * 3600);
      await bet.checkAndCloseBetting();
      
      await expect(
        submitProof(bet, alice, "x")
      ).to.be.revertedWith("Proof URL too short");
    });

    it("Should fail with HTTP scheme", async function () {
      const bet = await depositAndCreateBet(alice);
      
      await placeBet(bet, bob, 1, "60000000");
      await placeBet(bet, charlie, 2, "70000000");
      
      await increaseTime(8 * 24 * 3600);
      await bet.checkAndCloseBetting();
      
      await expect(
        submitProof(bet, alice, "http://example.com/proof")
      ).to.be.revertedWith("Invalid URL scheme (use https:// or ipfs://)");
    });
  });

  // ============================================
  // VOTING PHASE TESTS
  // ============================================

  describe("Voting Phase", function () {
    it("Should cast a vote", async function () {
      const bet = await depositAndCreateBet(alice);
      
      await placeBet(bet, bob, 1, "60000000");
      await placeBet(bet, charlie, 2, "70000000");
      
      await increaseTime(8 * 24 * 3600);
      await bet.checkAndCloseBetting();
      
      await submitProof(bet, alice, "https://ipfs.io/ipfs/QmTest123");
      
      await vote(bet, dave, 1); // YES
      
      expect(await bet.yesVotes()).to.equal(1);
    });

    it("Should fail if bettor tries to vote", async function () {
      const bet = await depositAndCreateBet(alice);
      
      await placeBet(bet, bob, 1, "60000000");
      await placeBet(bet, charlie, 2, "70000000");
      
      await increaseTime(8 * 24 * 3600);
      await bet.checkAndCloseBetting();
      
      await submitProof(bet, alice, "https://ipfs.io/ipfs/QmTest123");
      
      await expect(
        vote(bet, bob, 1)
      ).to.be.revertedWith("Bettors cannot vote");
    });
  });

  // ============================================
  // ATOMICITY TEST (Critical Fix Verification)
  // ============================================

  describe("Atomicity", function () {
    it("Should not lose collateral if initialize fails", async function () {
      await factory.connect(alice).depositProof(BigInt(CREATION_FEE) + BigInt("100000000000000000000"));
      await factory.connect(alice).depositUsdc(BigInt(PROOF_COLLATERAL) + BigInt("100000000"));
      await increaseTime(DEPOSIT_LOCK_PERIOD + 1);
      
      const details = await createValidBetDetails();
      details.title = ""; // Invalid - will cause initialize to fail
      
      const [balanceBefore] = await factory.getInternalBalances(alice.address);
      
      await expect(
        factory.connect(alice).createBet(details)
      ).to.be.revertedWith("Empty title");
      
      const [balanceAfter] = await factory.getInternalBalances(alice.address);
      
      // ✅ Critical: Collateral should NOT be deducted
      expect(balanceBefore).to.equal(balanceAfter);
    });
  });
});