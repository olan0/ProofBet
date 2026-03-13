// test/DebugTest.js
import { expect } from "chai";
import { network } from "hardhat";

describe("Debug ProofBet", function () {
  let factory, betImplementation, proofToken, trustScore, usdc;
  let ethers;
  let deployer, alice;

  before(async function () {
    const networkConnection = await network.connect({
      network: "hardhatMainnet",
      chainType: "l1",
    });
    ethers = networkConnection.ethers;
    
    const signers = await ethers.getSigners();
    [deployer, alice] = signers;
  });

  it("Should deploy all contracts", async function () {
    console.log("Deploying MockERC20...");
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    usdc = await MockERC20.deploy("Mock USDC", "mUSDC");
    await usdc.waitForDeployment();
    console.log("✓ MockERC20 deployed:", await usdc.getAddress());

    console.log("\nDeploying ProofToken...");
    const ProofToken = await ethers.getContractFactory("ProofToken");
    proofToken = await ProofToken.deploy();
    await proofToken.waitForDeployment();
    console.log("✓ ProofToken deployed:", await proofToken.getAddress());

    console.log("\nDeploying TrustScore...");
    const TrustScore = await ethers.getContractFactory("TrustScore");
    trustScore = await TrustScore.deploy();
    await trustScore.waitForDeployment();
    console.log("✓ TrustScore deployed:", await trustScore.getAddress());

    console.log("\nDeploying Bet implementation...");
    const Bet = await ethers.getContractFactory("Bet");
    betImplementation = await Bet.deploy();
    await betImplementation.waitForDeployment();
    console.log("✓ Bet deployed:", await betImplementation.getAddress());

    console.log("\nDeploying BetFactory...");
    const BetFactory = await ethers.getContractFactory("BetFactory");
    factory = await BetFactory.deploy(
      await trustScore.getAddress(),
      await usdc.getAddress(),
      await proofToken.getAddress(),
      deployer.address,
      "10000000000000000000", // 10 PROOF
      "100000000", // 100 USDC
      "5000000000000000000", // 5 PROOF
      10,
      await betImplementation.getAddress()
    );
    await factory.waitForDeployment();
    console.log("✓ BetFactory deployed:", await factory.getAddress());

    console.log("\nAuthorizing...");
    await proofToken.authorizeBurner(await factory.getAddress(), true);
    console.log("✓ Authorized burner");
    await trustScore.authorizeContract(await factory.getAddress(), true);
    console.log("✓ Authorized contract");

    expect(await factory.getAddress()).to.not.equal(ethers.ZeroAddress);
  });

  it("Should deposit funds", async function () {
    console.log("\nMinting USDC to alice...");
    await usdc.mint(alice.address, "1000000000");
    console.log("✓ Minted");

    console.log("\nTransferring PROOF to alice...");
    await proofToken.transfer(alice.address, "100000000000000000000");
    console.log("✓ Transferred");

    console.log("\nApproving factory...");
    await proofToken.connect(alice).approve(await factory.getAddress(), ethers.MaxUint256);
    await usdc.connect(alice).approve(await factory.getAddress(), ethers.MaxUint256);
    console.log("✓ Approved");

    console.log("\nDepositing PROOF...");
    await factory.connect(alice).depositProof("20000000000000000000");
    console.log("✓ Deposited PROOF");

    console.log("\nDepositing USDC...");
    await factory.connect(alice).depositUsdc("200000000");
    console.log("✓ Deposited USDC");

    const [usdcBal, proofBal] = await factory.getInternalBalances(alice.address);
    console.log("\nInternal Balances:");
    console.log("  USDC:", usdcBal.toString());
    console.log("  PROOF:", proofBal.toString());

    expect(usdcBal).to.equal("200000000");
    expect(proofBal).to.equal("20000000000000000000");
  });

  it("Should create a bet after lock period", async function () {
    console.log("\nWaiting for lock period...");
    await ethers.provider.send("evm_increaseTime", [3601]);
    await ethers.provider.send("evm_mine");
    console.log("✓ Time increased");

    const latestBlock = await ethers.provider.getBlock("latest");
    const now = latestBlock.timestamp;
    
    const details = {
      title: "Test Bet",
      description: "Testing",
      bettingDeadline: now + 7 * 24 * 3600,
      proofDeadline: now + 14 * 24 * 3600,
      votingDeadline: now + 21 * 24 * 3600,
      minimumBetAmount: "10000000",
      minimumSideStake: "50000000",
      minimumTrustScore: 0,
      minimumVotes: 3,
      category: 1,
      proofType: 1
    };

    console.log("\nBet details:");
    console.log("  Title:", details.title);
    console.log("  Betting deadline:", new Date(details.bettingDeadline * 1000).toISOString());
    console.log("  Current time:", new Date(now * 1000).toISOString());

    console.log("\nCreating bet...");
    try {
      const tx = await factory.connect(alice).createBet(details, false, ethers.ZeroHash);
      console.log("✓ Transaction sent:", tx.hash);
      
      const receipt = await tx.wait();
      console.log("✓ Transaction mined");
      
      const event = receipt.logs.find(log => {
        try {
          const parsed = factory.interface.parseLog(log);
          return parsed && parsed.name === 'BetCreated';
        } catch {
          return false;
        }
      });
      
      if (event) {
        const betAddress = factory.interface.parseLog(event).args[0];
        console.log("✓ Bet created at:", betAddress);
        expect(betAddress).to.not.equal(ethers.ZeroAddress);
      } else {
        console.log("⚠ No BetCreated event found");
        console.log("Events:", receipt.logs.length);
      }
    } catch (error) {
      console.log("\n❌ ERROR:", error.message);
      if (error.data) {
        console.log("Error data:", error.data);
      }
      throw error;
    }
  });
});