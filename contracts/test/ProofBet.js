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
  const PRIVATE_BET_FEE = "5000000000000000000"; // 5 PROOF
  const PROOF_COLLATERAL = "100000000"; // 100 USDC
  const INITIAL_VOTE_STAKE = "5000000000000000000"; // 5 PROOF
  const MAX_ACTIVE_BETS = 10;
  const INITIAL_PROOF_SUPPLY = "1000000000000000000000"; // 1000 PROOF
  const INITIAL_USDC_SUPPLY = "10000000000"; // 10,000 USDC

  // TrustScore constants (must match TrustScore.sol)
  const DECAY_PERIOD = 30 * 24 * 3600; // 30 days in seconds
  const BAN_THRESHOLD = -20;
  const PENALTY_POINTS = 5;

  before(async function () {
    const networkConnection = await network.connect({
      network: "hardhatMainnet",
      chainType: "l1",
    });
    ethers = networkConnection.ethers;

    signers = await ethers.getSigners();
    [deployer, alice, bob, charlie, dave, eve] = signers;
  });

  beforeEach(async function () {
    // 1. Deploy MockERC20 (USDC)
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    usdc = await MockERC20.deploy("Mock USDC", "mUSDC");
    await usdc.waitForDeployment();
    await usdc.mint(deployer.address, "10000000000");

    // 2. Deploy ProofToken
    const ProofToken = await ethers.getContractFactory("ProofToken");
    proofToken = await ProofToken.deploy();
    await proofToken.waitForDeployment();

    // 3. Deploy TrustScore
    const TrustScore = await ethers.getContractFactory("TrustScore");
    trustScore = await TrustScore.deploy();
    await trustScore.waitForDeployment();

    // 4. Deploy Bet implementation
    const Bet = await ethers.getContractFactory("Bet");
    betImplementation = await Bet.deploy();
    await betImplementation.waitForDeployment();

    // 5. Deploy BetFactory
    const BetFactory = await ethers.getContractFactory("BetFactory");
    factory = await BetFactory.deploy(
      await trustScore.getAddress(),
      await usdc.getAddress(),
      await proofToken.getAddress(),
      deployer.address,
      CREATION_FEE,
      PROOF_COLLATERAL,
      INITIAL_VOTE_STAKE,
      MAX_ACTIVE_BETS,
      await betImplementation.getAddress()
    );
    await factory.waitForDeployment();

    // 6. Authorize factory
    await proofToken.authorizeBurner(await factory.getAddress(), true);
    await trustScore.authorizeContract(await factory.getAddress(), true);

    // 7. Distribute tokens to test users
    const users = [alice, bob, charlie, dave, eve];
    for (const user of users) {
      await proofToken.transfer(user.address, INITIAL_PROOF_SUPPLY);
      await usdc.mint(user.address, INITIAL_USDC_SUPPLY);
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
      category: 1,
      proofType: 1
    };
  }

  async function increaseTime(seconds) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine");
  }

  async function depositAndCreateBet(user) {
    await factory.connect(user).depositProof(BigInt(CREATION_FEE) + BigInt("100000000000000000000"));
    await factory.connect(user).depositUsdc(BigInt(PROOF_COLLATERAL) + BigInt("500000000"));

    const details = await createValidBetDetails();
    const tx = await factory.connect(user).createBet(details, false, ethers.ZeroHash);
    const receipt = await tx.wait();

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
      expect(await factory.privateBetFeeProof()).to.equal(0);
      expect(await factory.proofCollateralUsdc()).to.equal(PROOF_COLLATERAL);
      expect(await factory.maxActiveBetsPerUser()).to.equal(MAX_ACTIVE_BETS);
    });

    it("getFactoryConfig should include privateBetFee", async function () {
      const cfg = await factory.getFactoryConfig();
      expect(cfg.creationFee).to.equal(CREATION_FEE);
      expect(cfg.privateBetFee).to.equal(0);
      expect(cfg.voteStakeAmount).to.equal(INITIAL_VOTE_STAKE);
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
      const amount = "100000000";
      await factory.connect(alice).depositUsdc(amount);

      const [balance] = await factory.getInternalBalances(alice.address);
      expect(balance).to.equal(amount);
    });

    it("Should deposit PROOF", async function () {
      const amount = "100000000000000000000";
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

      const details = await createValidBetDetails();
      await expect(factory.connect(alice).createBet(details, false, ethers.ZeroHash))
        .to.emit(factory, "BetCreated");
    });

    it("Should fail without collateral", async function () {
      await factory.connect(alice).depositProof(BigInt(CREATION_FEE) + BigInt("100000000000000000000"));

      const details = await createValidBetDetails();
      await expect(
        factory.connect(alice).createBet(details, false, ethers.ZeroHash)
      ).to.be.revertedWith("Insufficient collateral");
    });

    it("Should fail with past deadline", async function () {
      await factory.connect(alice).depositProof(BigInt(CREATION_FEE) + BigInt("100000000000000000000"));
      await factory.connect(alice).depositUsdc(BigInt(PROOF_COLLATERAL) + BigInt("100000000"));

      const latestBlock = await ethers.provider.getBlock("latest");
      const now = latestBlock.timestamp;
      const details = await createValidBetDetails();
      details.bettingDeadline = now - 1;

      await expect(
        factory.connect(alice).createBet(details, false, ethers.ZeroHash)
      ).to.be.revertedWith("Betting deadline must be future");
    });

    it("Should fail with empty title", async function () {
      await factory.connect(alice).depositProof(BigInt(CREATION_FEE) + BigInt("100000000000000000000"));
      await factory.connect(alice).depositUsdc(BigInt(PROOF_COLLATERAL) + BigInt("100000000"));

      const details = await createValidBetDetails();
      details.title = "";

      await expect(
        factory.connect(alice).createBet(details, false, ethers.ZeroHash)
      ).to.be.revertedWith("Empty title");
    });

    it("Should increase trust score on bet creation", async function () {
      const scoreBefore = await trustScore.getScore(alice.address);
      await depositAndCreateBet(alice);
      const scoreAfter = await trustScore.getScore(alice.address);

      expect(scoreAfter).to.equal(scoreBefore + BigInt(2)); // CREATE_BET_POINTS = 2
    });

    it("Should burn fees on creation", async function () {
      const burnPercentage = await proofToken.feeBurnPercentage();
      const baseFee = await factory.creationFeeProof();
      const feeCollectorAddr = await factory.feeCollector();

      const totalSupplyBefore = await proofToken.totalSupply();
      const feeCollectorBalBefore = await proofToken.balanceOf(feeCollectorAddr);

      await factory.connect(alice).depositProof(BigInt(baseFee) * BigInt(3));
      await factory.connect(alice).depositUsdc(BigInt(PROOF_COLLATERAL) + BigInt("500000000"));

      const details = await createValidBetDetails();
      const dynamicFee = await factory.calculateDynamicCreationFee(details);
      await factory.connect(alice).createBet(details, false, ethers.ZeroHash);

      const totalSupplyAfter = await proofToken.totalSupply();
      const feeCollectorBalAfter = await proofToken.balanceOf(feeCollectorAddr);

      const expectedBurn = (BigInt(dynamicFee) * BigInt(burnPercentage)) / BigInt(100);
      const actualBurned = totalSupplyBefore - totalSupplyAfter;
      const feeCollectorGained = feeCollectorBalAfter - feeCollectorBalBefore;

      expect(actualBurned).to.equal(expectedBurn);
      expect(actualBurned + feeCollectorGained).to.equal(dynamicFee);
    });
  });

  // ============================================
  // BETTING PHASE TESTS
  // ============================================

  describe("Betting Phase", function () {
    it("Should place a bet", async function () {
      const bet = await depositAndCreateBet(alice);
      const betAmount = "50000000";

      await placeBet(bet, bob, 1, betAmount);

      expect(await bet.totalYesStake()).to.equal(betAmount);
    });

    it("Should place bets on both sides", async function () {
      const bet = await depositAndCreateBet(alice);

      await placeBet(bet, bob, 1, "60000000");
      await placeBet(bet, charlie, 2, "70000000");

      expect(await bet.totalYesStake()).to.equal("60000000");
      expect(await bet.totalNoStake()).to.equal("70000000");
    });

    it("Should fail to bet after deadline", async function () {
      const bet = await depositAndCreateBet(alice);

      await increaseTime(8 * 24 * 3600);

      await expect(
        placeBet(bet, bob, 1, "50000000")
      ).to.be.revertedWith("Betting closed");
    });

    it("Should increase trust score on participation", async function () {
      const bet = await depositAndCreateBet(alice);
      const scoreBefore = await trustScore.getScore(bob.address);

      await placeBet(bet, bob, 1, "50000000");
      const scoreAfter = await trustScore.getScore(bob.address);

      expect(scoreAfter).to.equal(scoreBefore + BigInt(1)); // PARTICIPATE_POINTS = 1
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

      await vote(bet, dave, 1);

      expect(await bet.yesVotes()).to.equal(1);
    });

    it("Should increase trust score on vote", async function () {
      const bet = await depositAndCreateBet(alice);

      await placeBet(bet, bob, 1, "60000000");
      await placeBet(bet, charlie, 2, "70000000");

      await increaseTime(8 * 24 * 3600);
      await bet.checkAndCloseBetting();
      await submitProof(bet, alice, "https://ipfs.io/ipfs/QmTest123");

      const scoreBefore = await trustScore.getScore(dave.address);
      await vote(bet, dave, 1);
      const scoreAfter = await trustScore.getScore(dave.address);

      expect(scoreAfter).to.equal(scoreBefore + BigInt(1)); // VOTE_POINTS = 1
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
  // TRUST SCORE TESTS
  // ============================================

  describe("Trust Score", function () {
    it("Should start with zero score", async function () {
      expect(await trustScore.getScore(alice.address)).to.equal(0);
    });

    it("Should apply penalty and reduce score", async function () {
      // Give alice some score first via bet creation
      await depositAndCreateBet(alice); // +2 points
      const scoreBefore = await trustScore.getScore(alice.address);

      await trustScore.connect(deployer).authorizeContract(deployer.address, true);
      await trustScore.connect(deployer).applyPenalty(alice.address); // -5 points

      const scoreAfter = await trustScore.getScore(alice.address);
      expect(scoreAfter).to.equal(scoreBefore - BigInt(PENALTY_POINTS));
    });

    it("Should allow score to go negative", async function () {
      await trustScore.authorizeContract(deployer.address, true);

      // Apply 3 penalties on a fresh user (0 - 15 = -15)
      await trustScore.applyPenalty(alice.address);
      await trustScore.applyPenalty(alice.address);
      await trustScore.applyPenalty(alice.address);

      const score = await trustScore.getScore(alice.address);
      expect(score).to.equal(-15);
    });

    it("Should return true from applyPenalty when ban threshold is crossed", async function () {
      await trustScore.authorizeContract(deployer.address, true);

      // Apply 4 penalties: 0 - 20 = -20 (hits threshold)
      await trustScore.applyPenalty(alice.address);
      await trustScore.applyPenalty(alice.address);
      await trustScore.applyPenalty(alice.address);
      const result = await trustScore.applyPenalty.staticCall(alice.address);
      expect(result).to.be.true;
    });

    it("Should not decay score before DECAY_PERIOD", async function () {
      await depositAndCreateBet(alice); // +2 points → score = 2

      // Advance 29 days (less than DECAY_PERIOD)
      await increaseTime(29 * 24 * 3600);

      const score = await trustScore.getScore(alice.address);
      expect(score).to.equal(2); // no decay yet
    });

    it("Should decay score by 1 after one DECAY_PERIOD", async function () {
      await depositAndCreateBet(alice); // score = 2

      // Advance exactly 30 days
      await increaseTime(DECAY_PERIOD);

      const score = await trustScore.getScore(alice.address);
      expect(score).to.equal(1); // 2 - 1 decay
    });

    it("Should decay score by 2 after two DECAY_PERIODs", async function () {
      await depositAndCreateBet(alice); // score = 2
      await depositAndCreateBet(alice); // score = 4

      // Advance 60 days (two full periods)
      await increaseTime(2 * DECAY_PERIOD);

      const score = await trustScore.getScore(alice.address);
      expect(score).to.equal(2); // 4 - 2 decay
    });

    it("Should continue decaying below zero", async function () {
      // Start alice at 0 (fresh), apply 2 penalties → score stored as -10
      await trustScore.authorizeContract(deployer.address, true);
      await trustScore.applyPenalty(alice.address); // -5
      await trustScore.applyPenalty(alice.address); // -10

      expect(await trustScore.scores(alice.address)).to.equal(-10);

      // Advance 30 days — decay should bring it to -11
      await increaseTime(DECAY_PERIOD);

      const score = await trustScore.getScore(alice.address);
      expect(score).to.equal(-11);
    });

    it("Should stop decay at BAN_THRESHOLD", async function () {
      await trustScore.authorizeContract(deployer.address, true);

      // Bring alice to -18 (3 penalties = -15, then manually set via repeated penalties)
      // 4 penalties = -20, right at threshold — but let's use 3 then decay
      await trustScore.applyPenalty(alice.address); // -5
      await trustScore.applyPenalty(alice.address); // -10
      await trustScore.applyPenalty(alice.address); // -15

      // After 10 decay periods (300 days), score should not go below -20
      await increaseTime(10 * DECAY_PERIOD);

      const score = await trustScore.getScore(alice.address);
      expect(score).to.equal(BigInt(BAN_THRESHOLD));
    });

    it("Should reset decay timer on activity", async function () {
      await depositAndCreateBet(alice); // score = 2

      // Advance 20 days (no decay yet)
      await increaseTime(20 * 24 * 3600);

      // Create another bet — resets lastActivityTime, adds +2
      await depositAndCreateBet(alice); // score = 4

      // Advance 25 days from the second bet (total 45 days from first, but only 25 from last activity)
      await increaseTime(25 * 24 * 3600);

      // 25 days < DECAY_PERIOD, so no decay should have applied
      const score = await trustScore.getScore(alice.address);
      expect(score).to.equal(4);
    });

    it("Should apply decay correctly when writing score back via applyDecay", async function () {
      await depositAndCreateBet(alice); // score = 2

      await increaseTime(DECAY_PERIOD);

      // getScore reflects decay virtually — stored score is still 2
      expect(await trustScore.scores(alice.address)).to.equal(2);
      expect(await trustScore.getScore(alice.address)).to.equal(1);

      // applyDecay writes the decayed value to storage
      await trustScore.applyDecay(alice.address);
      expect(await trustScore.scores(alice.address)).to.equal(1);
    });

    it("Should not ban owner via applyPenalty", async function () {
      await trustScore.authorizeContract(deployer.address, true);

      // Apply many penalties to owner
      for (let i = 0; i < 5; i++) {
        await trustScore.applyPenalty(deployer.address);
      }

      // Owner score should remain 0 (skipped)
      expect(await trustScore.getScore(deployer.address)).to.equal(0);
    });

    it("Should reset score to 0 on resetScore", async function () {
      await depositAndCreateBet(alice); // score = 2
      await trustScore.resetScore(alice.address);
      expect(await trustScore.getScore(alice.address)).to.equal(0);
    });
  });

  // ============================================
  // ATOMICITY TEST
  // ============================================

  describe("Atomicity", function () {
    it("Should not lose collateral if initialize fails", async function () {
      await factory.connect(alice).depositProof(BigInt(CREATION_FEE) + BigInt("100000000000000000000"));
      await factory.connect(alice).depositUsdc(BigInt(PROOF_COLLATERAL) + BigInt("100000000"));

      const details = await createValidBetDetails();
      details.title = "";

      const [balanceBefore] = await factory.getInternalBalances(alice.address);

      await expect(
        factory.connect(alice).createBet(details, false, ethers.ZeroHash)
      ).to.be.revertedWith("Empty title");

      const [balanceAfter] = await factory.getInternalBalances(alice.address);
      expect(balanceBefore).to.equal(balanceAfter);
    });
  });

  // ============================================
  // PRIVATE BETS TESTS
  // ============================================

  describe("Private Bets", function () {

    // ─── Helpers ──────────────────────────────────────────────────────────────

    /** Generate a random 32-byte invite key and its on-chain hash. */
    function makeKey() {
      const inviteKey = ethers.hexlify(ethers.randomBytes(32));
      const inviteKeyHash = ethers.keccak256(inviteKey);
      return { inviteKey, inviteKeyHash };
    }

    /** Deposit funds and create a PRIVATE bet as `user`, returning { bet, inviteKey }. */
    async function depositAndCreatePrivateBet(user) {
      await factory.connect(user).depositProof(BigInt(CREATION_FEE) + BigInt("100000000000000000000"));
      await factory.connect(user).depositUsdc(BigInt(PROOF_COLLATERAL) + BigInt("500000000"));

      const { inviteKey, inviteKeyHash } = makeKey();
      const details = await createValidBetDetails();
      details.title = "[PRIVATE]";
      details.description = "[PRIVATE]";

      const tx = await factory.connect(user).createBet(details, true, inviteKeyHash);
      const receipt = await tx.wait();

      const event = receipt.logs.find(log => {
        try {
          return factory.interface.parseLog(log)?.name === "BetCreated";
        } catch { return false; }
      });
      const betAddress = factory.interface.parseLog(event).args[0];
      const bet = await ethers.getContractAt("Bet", betAddress);
      return { bet, inviteKey, inviteKeyHash };
    }

    // ─── Creation ─────────────────────────────────────────────────────────────

    it("Should create a private bet with isPrivate = true", async function () {
      const { bet } = await depositAndCreatePrivateBet(alice);
      expect(await bet.isPrivate()).to.equal(true);
    });

    it("Should store the correct inviteKeyHash on-chain", async function () {
      const { inviteKeyHash, bet } = await depositAndCreatePrivateBet(alice);
      expect(await bet.inviteKeyHash()).to.equal(inviteKeyHash);
    });

    it("Should create a public bet with isPrivate = false", async function () {
      const bet = await depositAndCreateBet(alice);
      expect(await bet.isPrivate()).to.equal(false);
    });

    it("Should emit BetCreated with isPrivate = true", async function () {
      await factory.connect(alice).depositProof(BigInt(CREATION_FEE) + BigInt("100000000000000000000"));
      await factory.connect(alice).depositUsdc(BigInt(PROOF_COLLATERAL) + BigInt("500000000"));

      const { inviteKeyHash } = makeKey();
      const details = await createValidBetDetails();
      details.title = "[PRIVATE]";
      details.description = "[PRIVATE]";

      await expect(
        factory.connect(alice).createBet(details, true, inviteKeyHash)
      ).to.emit(factory, "BetCreated").withArgs(
        (v) => v !== ethers.ZeroAddress,
        alice.address,
        true,
        inviteKeyHash
      );
    });

    it("Should reject private bet creation with zero keyHash", async function () {
      await factory.connect(alice).depositProof(BigInt(CREATION_FEE) + BigInt("100000000000000000000"));
      await factory.connect(alice).depositUsdc(BigInt(PROOF_COLLATERAL) + BigInt("500000000"));

      const details = await createValidBetDetails();
      details.title = "[PRIVATE]";

      await expect(
        factory.connect(alice).createBet(details, true, ethers.ZeroHash)
      ).to.be.revertedWith("Private bet requires key hash");
    });

    // ─── Registration ─────────────────────────────────────────────────────────

    it("Should allow self-registration with the correct key", async function () {
      const { bet, inviteKey } = await depositAndCreatePrivateBet(alice);

      expect(await bet.isRegistered(bob.address)).to.equal(false);
      await bet.connect(bob).registerWithKey(inviteKey);
      expect(await bet.isRegistered(bob.address)).to.equal(true);
    });

    it("Should reject registration with a wrong key", async function () {
      const { bet } = await depositAndCreatePrivateBet(alice);
      const wrongKey = ethers.hexlify(ethers.randomBytes(32));

      await expect(
        bet.connect(bob).registerWithKey(wrongKey)
      ).to.be.revertedWith("Invalid invite key");
    });

    it("Should reject double registration", async function () {
      const { bet, inviteKey } = await depositAndCreatePrivateBet(alice);

      await bet.connect(bob).registerWithKey(inviteKey);
      await expect(
        bet.connect(bob).registerWithKey(inviteKey)
      ).to.be.revertedWith("Already registered");
    });

    it("Should reject registerWithKey on a public bet", async function () {
      const bet = await depositAndCreateBet(alice);
      const { inviteKey } = makeKey();

      await expect(
        bet.connect(bob).registerWithKey(inviteKey)
      ).to.be.revertedWith("Not a private bet");
    });

    // ─── Access control ───────────────────────────────────────────────────────

    it("Should block an unregistered user from placing a bet", async function () {
      const { bet } = await depositAndCreatePrivateBet(alice);
      await factory.connect(bob).depositUsdc("200000000");

      await expect(
        bet.connect(bob).placeBet(1, "50000000")
      ).to.be.revertedWith("Private bet: need invite key to participate");
    });

    it("Should allow a registered user to place a bet", async function () {
      const { bet, inviteKey } = await depositAndCreatePrivateBet(alice);

      // Bob registers
      await bet.connect(bob).registerWithKey(inviteKey);

      // Bob places a bet
      await placeBet(bet, bob, 1, "60000000");
      expect(await bet.totalYesStake()).to.equal("60000000");
    });

    it("Creator can place a bet without registering", async function () {
      const { bet } = await depositAndCreatePrivateBet(alice);
      await placeBet(bet, alice, 1, "60000000");
      expect(await bet.totalYesStake()).to.equal("60000000");
    });

    it("Should block an unregistered user from voting", async function () {
      const { bet, inviteKey } = await depositAndCreatePrivateBet(alice);

      // Set up: bob and charlie register and bet so the round can reach voting
      await bet.connect(bob).registerWithKey(inviteKey);
      await bet.connect(charlie).registerWithKey(inviteKey);
      await placeBet(bet, bob, 1, "60000000");
      await placeBet(bet, charlie, 2, "70000000");

      await increaseTime(8 * 24 * 3600);
      await bet.checkAndCloseBetting();
      await submitProof(bet, alice, "https://ipfs.io/ipfs/QmPrivateProof");

      // dave is NOT registered
      await factory.connect(dave).depositProof("100000000000000000000");
      await expect(
        bet.connect(dave).vote(1)
      ).to.be.revertedWith("Private bet: need invite key to participate");
    });

    it("Should allow a registered user to vote", async function () {
      const { bet, inviteKey } = await depositAndCreatePrivateBet(alice);

      await bet.connect(bob).registerWithKey(inviteKey);
      await bet.connect(charlie).registerWithKey(inviteKey);
      await bet.connect(dave).registerWithKey(inviteKey);

      await placeBet(bet, bob, 1, "60000000");
      await placeBet(bet, charlie, 2, "70000000");

      await increaseTime(8 * 24 * 3600);
      await bet.checkAndCloseBetting();
      await submitProof(bet, alice, "https://ipfs.io/ipfs/QmPrivateProof");

      await vote(bet, dave, 1);
      expect(await bet.yesVotes()).to.equal(1);
    });

    // ─── Encrypted proof URL ──────────────────────────────────────────────────

    it("Should accept an enc:// proof URL for a private bet", async function () {
      const { bet, inviteKey } = await depositAndCreatePrivateBet(alice);

      await bet.connect(bob).registerWithKey(inviteKey);
      await bet.connect(charlie).registerWithKey(inviteKey);
      await placeBet(bet, bob, 1, "60000000");
      await placeBet(bet, charlie, 2, "70000000");

      await increaseTime(8 * 24 * 3600);
      await bet.checkAndCloseBetting();

      // enc:// is a valid scheme for encrypted private-bet proofs
      const encProofUrl = "enc://SGVsbG9Xb3JsZEFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUE=";
      await submitProof(bet, alice, encProofUrl);

      expect(await bet.currentStatus()).to.equal(2); // VOTING
      expect(await bet.proofUrl()).to.equal(encProofUrl);
    });

    it("Should reject a plain http:// proof URL even on a private bet", async function () {
      const { bet, inviteKey } = await depositAndCreatePrivateBet(alice);

      await bet.connect(bob).registerWithKey(inviteKey);
      await bet.connect(charlie).registerWithKey(inviteKey);
      await placeBet(bet, bob, 1, "60000000");
      await placeBet(bet, charlie, 2, "70000000");

      await increaseTime(8 * 24 * 3600);
      await bet.checkAndCloseBetting();

      await expect(
        submitProof(bet, alice, "http://example.com/proof")
      ).to.be.revertedWith("Invalid URL scheme (use https:// or ipfs://)");
    });

    // ─── Private bet fee ──────────────────────────────────────────────────────

    it("privateBetFeeProof starts at zero", async function () {
      expect(await factory.privateBetFeeProof()).to.equal(0);
    });

    it("Owner can set the private bet fee", async function () {
      await factory.connect(deployer).setPrivateBetFee(PRIVATE_BET_FEE);
      expect(await factory.privateBetFeeProof()).to.equal(PRIVATE_BET_FEE);
    });

    it("setPrivateBetFee emits PrivateBetFeeChanged", async function () {
      await expect(factory.connect(deployer).setPrivateBetFee(PRIVATE_BET_FEE))
        .to.emit(factory, "PrivateBetFeeChanged")
        .withArgs(0, PRIVATE_BET_FEE);
    });

    it("Non-owner cannot set the private bet fee", async function () {
      await expect(
        factory.connect(alice).setPrivateBetFee(PRIVATE_BET_FEE)
      ).to.be.revert(ethers);
    });

    it("Private bet charges dynamic fee + privateBetFeeProof", async function () {
      await factory.connect(deployer).setPrivateBetFee(PRIVATE_BET_FEE);

      const details = await createValidBetDetails();
      details.title = "[PRIVATE]";
      details.description = "[PRIVATE]";
      const dynamicFee = await factory.calculateDynamicCreationFee(details);
      const expectedTotal = BigInt(dynamicFee) + BigInt(PRIVATE_BET_FEE);

      const depositAmount = expectedTotal + BigInt("50000000000000000000");
      await factory.connect(alice).depositProof(depositAmount);
      await factory.connect(alice).depositUsdc(BigInt(PROOF_COLLATERAL) + BigInt("500000000"));

      const [, proofBefore] = await factory.getInternalBalances(alice.address);
      const { inviteKeyHash } = makeKey();
      await factory.connect(alice).createBet(details, true, inviteKeyHash);
      const [, proofAfter] = await factory.getInternalBalances(alice.address);

      expect(proofBefore - proofAfter).to.equal(expectedTotal);
    });

    it("Public bet does not charge privateBetFeeProof", async function () {
      await factory.connect(deployer).setPrivateBetFee(PRIVATE_BET_FEE);

      const details = await createValidBetDetails();
      const dynamicFee = await factory.calculateDynamicCreationFee(details);

      const depositAmount = BigInt(dynamicFee) + BigInt("50000000000000000000");
      await factory.connect(alice).depositProof(depositAmount);
      await factory.connect(alice).depositUsdc(BigInt(PROOF_COLLATERAL) + BigInt("500000000"));

      const [, proofBefore] = await factory.getInternalBalances(alice.address);
      await factory.connect(alice).createBet(details, false, ethers.ZeroHash);
      const [, proofAfter] = await factory.getInternalBalances(alice.address);

      expect(proofBefore - proofAfter).to.equal(dynamicFee);
    });

    it("Fails to create private bet when PROOF balance is short by privateBetFeeProof", async function () {
      await factory.connect(deployer).setPrivateBetFee(PRIVATE_BET_FEE);

      const details = await createValidBetDetails();
      details.title = "[PRIVATE]";
      details.description = "[PRIVATE]";
      const dynamicFee = await factory.calculateDynamicCreationFee(details);

      // Deposit only enough for the base dynamic fee, not the private fee
      await factory.connect(alice).depositProof(BigInt(dynamicFee));
      await factory.connect(alice).depositUsdc(BigInt(PROOF_COLLATERAL) + BigInt("500000000"));

      const { inviteKeyHash } = makeKey();
      await expect(
        factory.connect(alice).createBet(details, true, inviteKeyHash)
      ).to.be.revertedWith("Insufficient PROOF");
    });

    it("getFactoryConfig returns updated privateBetFee after setPrivateBetFee", async function () {
      await factory.connect(deployer).setPrivateBetFee(PRIVATE_BET_FEE);
      const cfg = await factory.getFactoryConfig();
      expect(cfg.privateBetFee).to.equal(PRIVATE_BET_FEE);
    });

    // ─── Full private flow ────────────────────────────────────────────────────

    it("Full flow: create → register → bet → enc:// proof → vote → resolve", async function () {
      const { bet, inviteKey } = await depositAndCreatePrivateBet(alice);

      // Invite and register bob, charlie, dave
      await bet.connect(bob).registerWithKey(inviteKey);
      await bet.connect(charlie).registerWithKey(inviteKey);
      await bet.connect(dave).registerWithKey(inviteKey);
      await bet.connect(eve).registerWithKey(inviteKey);

      // Betting phase
      await placeBet(bet, bob, 1, "60000000");    // YES
      await placeBet(bet, charlie, 2, "70000000"); // NO

      // Close betting
      await increaseTime(8 * 24 * 3600);
      await bet.checkAndCloseBetting();
      expect(await bet.currentStatus()).to.equal(1); // AWAITING_PROOF

      // Proof (encrypted)
      const encProofUrl = "enc://U29tZUVuY3J5cHRlZFByb29mQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQQ==";
      await submitProof(bet, alice, encProofUrl);
      expect(await bet.currentStatus()).to.equal(2); // VOTING
      expect(await bet.proofUrl()).to.equal(encProofUrl);

      // Set up frank (signers[6]) who is not in the global beforeEach
      const frank = signers[6];
      await proofToken.transfer(frank.address, "100000000000000000000");
      await proofToken.connect(frank).approve(await factory.getAddress(), ethers.MaxUint256);
      await usdc.mint(frank.address, "500000000");
      await usdc.connect(frank).approve(await factory.getAddress(), ethers.MaxUint256);

      // Voting phase — dave and eve vote YES, frank votes NO
      await bet.connect(frank).registerWithKey(inviteKey);
      await vote(bet, dave, 1);
      await vote(bet, eve, 1);
      await vote(bet, frank, 2);

      // Resolve
      await increaseTime(15 * 24 * 3600);
      await bet.checkAndResolve();
      expect(await bet.currentStatus()).to.equal(3); // COMPLETED

      // YES wins (2 vs 1 votes)
      expect(await bet.outcomeSide()).to.equal(1); // Side.YES

      // Winners (bob) can claim
      expect(await bet.hasBettor(bob.address)).to.equal(true);
    });
  });
});
