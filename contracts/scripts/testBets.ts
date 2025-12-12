import { network } from "hardhat";

async function advanceTime(provider: any, seconds: number) {
  await provider.send("evm_increaseTime", [seconds]);
  await provider.send("evm_mine");
}

async function main() {
      const { ethers } = await network.connect({
      network: "localhost",
      chainType: "l1",
    });

    const provider = ethers.provider;

    const proofToken = await ethers.getContractAt("ProofToken", "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0");
    const trustScore = await ethers.getContractAt("TrustScore", "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9");
    const factory = await ethers.getContractAt("BetFactory", "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9");
    const usdcToken = await ethers.getContractAt("MockERC20", "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");
    const accountAddresses = await ethers.getSigners()
     console.log("\n--- Starting test script ---");
      // We now need 9 accounts: deployer, 2 creators, 2 bettors, 3 voters, and 1 keeper
      if (accountAddresses.length < 9) {
          throw new Error("Not enough Hardhat accounts. Need at least 9.");
      }
      const [deployer, creator1, creator2, bettorYes, bettorNo, voter1, voter2, voter3, keeper] = accountAddresses; 

      console.log("  ✅ Accounts prepared.");
      
        // --- 2. Funding ---
        console.log("\n[2/4] Funding accounts with mUSDC and PROOF...");
        const usdc = usdcToken.connect(deployer) as any;
        const proof = proofToken.connect(deployer) as any;
        const usdcAmount = ethers.parseUnits("10000", 6);
        const proofAmount = ethers.parseEther("50000");
       // Include the new 'keeper' account for funding
        const accountsToFund = [creator1, creator2, bettorYes, bettorNo, voter1, voter2, voter3, keeper];
        for (const acc of accountsToFund) {
            const addr = await acc.getAddress();
            console.log(`  - Funding ${addr}...`);
            await (await usdc.mint(addr, usdcAmount)).wait();
            // FIX: Transfer PROOF from the deployer's balance, not mint.
            await (await proof.transfer(addr, proofAmount)).wait();
        }
        console.log("  ✅ All accounts funded.");
        
        // --- 3. Internal Wallet Deposits ---
        console.log("\n[3/4] Depositing funds into internal wallets...");
       
        for (const acc of accountsToFund) {
            const addr = await acc.getAddress();
            console.log(`  - ${addr.substring(0,10)}... depositing...`);
            await (await usdc.connect(acc).approve(await factory.getAddress(), usdcAmount)).wait();
            await (await factory.connect(acc).depositUsdc(usdcAmount)).wait();
            await (await proof.connect(acc).approve(await factory.getAddress(), proofAmount)).wait();
            await (await factory.connect(acc).depositProof(proofAmount)).wait();
        }
        console.log("  ✅ All accounts have deposited funds.");
        console.log("\n[4/4] Creating markets with various statuses...");
        
        // Helper to robustly get bet address from receipt
        const getBetAddressFromReceipt = (receipt: any) => {
            for (const log of receipt.logs) {
                try {
                    const parsedLog = factory.interface.parseLog(log);
                    if (parsedLog && parsedLog.name === "BetCreated") {
                        return parsedLog.args.betAddress;
                    }
                } catch (e) {
                    // Ignore logs that aren't from the factory's ABI
                }
            }
            throw new Error("BetCreated event not found in transaction receipt.");
        };

        let details, createTx, receipt, betAddress, betContract, currentTimestamp;
        console.log("\n  --- Creating Market 1: Open for Betting ---");
        {
            const block = await provider.getBlock('latest');
            if (!block) {
                throw new Error("Failed to fetch latest block.");
            }
            currentTimestamp = block.timestamp;
        }
        details = {
            title: "Will Ethereum reach $5,000 by the end of the next quarter?",
            description: "This market resolves based on the price of ETH on major exchanges at the end of the next calendar quarter.",
            bettingDeadline: currentTimestamp + 86400 * 7, // 1 week
            proofDeadline: currentTimestamp + 86400 * 8,
            votingDeadline: currentTimestamp + 86400 * 9,
            minimumBetAmount: ethers.parseUnits("10", 6), minimumSideStake: ethers.parseUnits("100", 6), minimumTrustScore: 0, minimumVotes: 1,
        };
        createTx = await factory.connect(creator1).createBet(details);
        receipt = await createTx.wait();
        betAddress = getBetAddressFromReceipt(receipt);
        console.log(`    ✅ Market created: ${betAddress}`);
        betContract =  await ethers.getContractAt("Bet",betAddress);
        await (await betContract.connect(bettorYes).placeBet(1, ethers.parseUnits("150", 6))).wait();
        await (await betContract.connect(bettorNo).placeBet(2, ethers.parseUnits("120", 6))).wait();
        console.log("    ✅ Bets placed. Market is now OPEN.");

// --- Scenario 2: Awaiting Proof ---
        console.log("\n  --- Creating Market 2: Awaiting Proof ---");
        {
            const block = await provider.getBlock('latest');
            if (!block) {
                throw new Error("Failed to fetch latest block.");
            }
            currentTimestamp = block.timestamp;
        }
        details.title = "Is 'Awaiting Proof' the current status of this market?";
        details.bettingDeadline = currentTimestamp + 60;
        details.proofDeadline = currentTimestamp + 1200;
        details.votingDeadline = currentTimestamp + 2400;
        createTx = await factory.connect(creator1).createBet(details);
        receipt = await createTx.wait();
        betAddress = getBetAddressFromReceipt(receipt);
        console.log(`    ✅ Market created: ${betAddress}`);
        betContract = await ethers.getContractAt("Bet",betAddress);;
        await (await betContract.connect(bettorYes).placeBet(1, ethers.parseUnits("200", 6))).wait();
        await (await betContract.connect(bettorNo).placeBet(2, ethers.parseUnits("250", 6))).wait();
        console.log("    - Advancing time past betting deadline...");
        await advanceTime(provider, 61);
        // Keeper calls checkAndCloseBetting
        await (await betContract.connect(keeper).checkAndCloseBetting()).wait();
        console.log("    ✅ Betting closed. Market is now AWAITING PROOF.");

        // --- Scenario 3: Voting ---
        console.log("\n  --- Creating Market 3: Voting ---");
        {
            const block = await provider.getBlock('latest');
            if (!block) {
                throw new Error("Failed to fetch latest block.");
            }
            currentTimestamp = block.timestamp;
        }
        details.title = "Should smart contract documentation be a top priority for developers?";
        details.bettingDeadline = currentTimestamp + 60;
        details.proofDeadline = currentTimestamp + 120;
        details.votingDeadline = currentTimestamp + 1200;
        createTx = await factory.connect(creator2).createBet(details);
        receipt = await createTx.wait();
        betAddress = getBetAddressFromReceipt(receipt);
        console.log(`    ✅ Market created: ${betAddress}`);
        betContract = await ethers.getContractAt("Bet",betAddress);;
        await (await betContract.connect(bettorYes).placeBet(1, ethers.parseUnits("300", 6))).wait();
        await (await betContract.connect(bettorNo).placeBet(2, ethers.parseUnits("100", 6))).wait();
        await advanceTime(provider, 61);
        // Keeper calls checkAndCloseBetting
        await (await betContract.connect(keeper).checkAndCloseBetting()).wait();
        await (await betContract.connect(creator2).submitProof("https://ethereum.org/en/developers/docs/")).wait();
        console.log("    ✅ Proof submitted. Market is now VOTING.");

        // --- Scenario 4: Completed (YES wins) ---
        console.log("\n  --- Creating Market 4: Completed ---");
        {
            const block = await provider.getBlock('latest');
            if (!block) {
                throw new Error("Failed to fetch latest block.");
            }
            currentTimestamp = block.timestamp;
        }
        details.title = "Was this test script executed successfully?";
        details.bettingDeadline = currentTimestamp + 60;
        details.proofDeadline = currentTimestamp + 120;
        details.votingDeadline = currentTimestamp + 180;
        createTx = await factory.connect(creator2).createBet(details);
        receipt = await createTx.wait();
        betAddress = getBetAddressFromReceipt(receipt);
        console.log(`    ✅ Market created: ${betAddress}`);
        betContract = await ethers.getContractAt("Bet",betAddress);;
        await (await betContract.connect(bettorYes).placeBet(1, ethers.parseUnits("500", 6))).wait();
        // FIX: Increase the 'NO' stake to meet the minimumSideStake requirement
        await (await betContract.connect(bettorNo).placeBet(2, ethers.parseUnits("150", 6))).wait();
        await advanceTime(provider, 61);
        // Keeper calls checkAndCloseBetting
        await (await betContract.connect(keeper).checkAndCloseBetting()).wait();
        await (await betContract.connect(creator2).submitProof("https://github.com")).wait();
        await (await betContract.connect(voter1).vote(1)).wait(); // Vote YES
        await (await betContract.connect(voter2).vote(1)).wait(); // Vote YES
        await advanceTime(provider, 61); // Advance past voting deadline
        // Keeper calls checkAndResolve
        await (await betContract.connect(keeper).checkAndResolve()).wait();
        console.log("    ✅ Market resolved. Market is now COMPLETED.");

        // --- Scenario 5: Cancelled (No Proof) ---
        console.log("\n  --- Creating Market 5: Cancelled (No Proof) ---");
        {
            const block = await provider.getBlock('latest');
            if (!block) {
                throw new Error("Failed to fetch latest block.");
            }
            currentTimestamp = block.timestamp;
        }
        details.title = "Will this market be cancelled if the creator fails to provide proof?";
        details.bettingDeadline = currentTimestamp + 60;
        details.proofDeadline = currentTimestamp + 120;
        details.votingDeadline = currentTimestamp + 1800;
        createTx = await factory.connect(creator1).createBet(details);
        receipt = await createTx.wait();
        betAddress = getBetAddressFromReceipt(receipt);
        console.log(`    ✅ Market created: ${betAddress}`);
        betContract = await ethers.getContractAt("Bet",betAddress);;
        await (await betContract.connect(bettorYes).placeBet(1, ethers.parseUnits("100", 6))).wait();
        await (await betContract.connect(bettorNo).placeBet(2, ethers.parseUnits("100", 6))).wait();
        await advanceTime(provider, 121); // Advance past proof deadline
        // Keeper calls checkAndCloseBetting
        await (await betContract.connect(keeper).checkAndCloseBetting()).wait(); 
        // Keeper calls checkAndCancelForProof
        await (await betContract.connect(keeper).checkAndCancelForProof()).wait();
        console.log("    ✅ No proof submitted. Market is now CANCELLED.");

        // --- Scenario 6: Cancelled (Vote Tie) ---
        console.log("\n  --- Creating Market 6: Cancelled (Vote Tie) ---");
       {
            const block = await provider.getBlock('latest');
            if (!block) {
                throw new Error("Failed to fetch latest block.");
            }
            currentTimestamp = block.timestamp;
        }
        details.title = "If the vote is a tie, does the market get cancelled?";
        details.bettingDeadline = currentTimestamp + 60;
        details.proofDeadline = currentTimestamp + 120;
        details.votingDeadline = currentTimestamp + 180;
        createTx = await factory.connect(creator2).createBet(details);
        receipt = await createTx.wait();
        betAddress = getBetAddressFromReceipt(receipt);
        console.log(`    ✅ Market created: ${betAddress}`);
        betContract = await ethers.getContractAt("Bet",betAddress);;
        await (await betContract.connect(bettorYes).placeBet(1, ethers.parseUnits("100", 6))).wait();
        await (await betContract.connect(bettorNo).placeBet(2, ethers.parseUnits("100", 6))).wait();
        await advanceTime(provider, 61);
        // Keeper calls checkAndCloseBetting
        await (await betContract.connect(keeper).checkAndCloseBetting()).wait();
        await (await betContract.connect(creator2).submitProof("https://en.wikipedia.org/wiki/Tie")).wait();
        await (await betContract.connect(voter1).vote(1)).wait(); // Vote YES
        await (await betContract.connect(voter2).vote(2)).wait(); // Vote NO
        await advanceTime(provider, 61); // Advance past voting deadline
        // Keeper calls checkAndResolve
        await (await betContract.connect(keeper).checkAndResolve()).wait();
        console.log("    ✅ Vote was a tie. Market is now CANCELLED.");

        // --- NEW Scenario 7: About to Close ---
        console.log("\n  --- Creating Market 7: About to Close ---");
        {
            const block = await provider.getBlock('latest');
            if (!block) {
                throw new Error("Failed to fetch latest block.");
            }
            currentTimestamp = block.timestamp;
        }
        details.title = "Will this market close in the next minute?";
        details.bettingDeadline = currentTimestamp + 60; // Closes soon
        details.proofDeadline = currentTimestamp + 86400;
        details.votingDeadline = currentTimestamp + 86400 * 2;
        createTx = await factory.connect(creator1).createBet(details);
        receipt = await createTx.wait();
        betAddress = getBetAddressFromReceipt(receipt);
        console.log(`    ✅ Market created: ${betAddress}`);
        betContract = await ethers.getContractAt("Bet",betAddress);;
        await (await betContract.connect(bettorYes).placeBet(1, ethers.parseUnits("50", 6))).wait();
        console.log("    ✅ Bets placed. Market is OPEN (closes soon).");
        
        // --- NEW Scenario 8: High Minimum Bet ---
        console.log("\n  --- Creating Market 8: High Minimum Bet ---");
       {
            const block = await provider.getBlock('latest');
            if (!block) {
                throw new Error("Failed to fetch latest block.");
            }
            currentTimestamp = block.timestamp;
        }
        details.title = "Is a $1000 minimum bet too high for a prediction market?";
        details.bettingDeadline = currentTimestamp + 86400 * 3;
        details.proofDeadline = currentTimestamp + 86400 * 4;
        details.votingDeadline = currentTimestamp + 86400 * 5;
        details.minimumBetAmount = ethers.parseUnits("1000", 6);
        createTx = await factory.connect(creator2).createBet(details);
        receipt = await createTx.wait();
        betAddress = getBetAddressFromReceipt(receipt);
        console.log(`    ✅ Market created with $1000 min bet: ${betAddress}`);





/*
       const signers = await ethers.getSigners();

      for (let i = 0; i < signers.length; i++) {
        const addr = await signers[i].getAddress();
        const balance = await provider.getBalance(addr);
        console.log(i, addr);
      }
      var betDetails = {
              creator: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
              title: "Test Bet from scriptkjl",
              description: "This is a test bet created from a scriptlhlhlhl",
              bettingDeadline: Math.floor(Date.now() / 1000) + 86400, // 24 hours from now
              proofDeadline: Math.floor(Date.now() / 1000) + 172800, // 48 hours from now
              votingDeadline: Math.floor(Date.now() / 1000) + 259200, // 72 hours from now
              minimumBetAmount: ethers.parseUnits("10", 6), // 10 USDC
              minimumSideStake: ethers.parseUnits("5", 6), // 5 USDC
              minimumTrustScore: 10,
              voterRewardPercentage: 5,
              platformFeePercentage: 3,
              minimumVotes: 3,
            };

            var betDetails1 = {
              bettingDeadline: 1760673600, // Jan 16, 2025
              creator: "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266",
              description: "Will the price of ETH be above $2000 on Jan 20, 2025?",
              minimumBetAmount: 10000000n, // 10 USDC
              minimumSideStake: 50000000n, // 5 USDC
              minimumTrustScore: 0,
              minimumVotes: 5,
              platformFeePercentage: 3,
              proofDeadline: 1760760000, // Jan 20, 2025
              title: "ETH Price Bet",
              voterRewardPercentage: 5,
              votingDeadline: 1760760000 // Jan 21, 2025
              };

          console.log("Creating bet with details:", betDetails);
            // Create the bet on the blockchain - The contract now handles the fee deduction.
            const createTx = await betFactory.createBet(betDetails1);
            const receipt = await createTx.wait();
            if (receipt == null || receipt.status !== 1) {
              throw new Error("Bet creation transaction failed");
            }
            console.log("Bet created in tx:", createTx.hash);
            const betCreatedLog = receipt?.logs?.find((log) => {
              try {
                const parsed = betFactory.interface.parseLog(log);
                return parsed?.name === "BetCreated";
              } catch {
                return false;
              }
            });
            const betCreatedEvent = betCreatedLog ? betFactory.interface.parseLog(betCreatedLog) : undefined;

    const block = await provider.getBlock("latest");
    if (!block) {
      console.log("No block returned from provider");
    } else {
      console.log("Block timestamp:", block.timestamp);
      console.log("Readable time:", new Date(block.timestamp * 1000).toISOString());
    }*/
}
main().catch((err) => {
  console.error("❌ Seed script crashed:", err);
  process.exitCode = 1;
});