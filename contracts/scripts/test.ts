import { network } from "hardhat";

const { ethers } = await network.connect({
  network: "localhost",
  chainType: "l1",
});

const proofToken = await ethers.getContractAt("ProofToken", "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");
const trustScore = await ethers.getContractAt("TrustScore", "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0");
const betFactory = await ethers.getContractAt("BetFactory", "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9");

/*
// Check if BetFactory is authorized to burn PROOF tokens
console.log("BetFactory authorized to burn:", await proofToken.authorizedBurners(await betFactory.getAddress()));

// Check if BetFactory is authorized to update trust scores  
console.log("BetFactory authorized for trust scores:", await trustScore.authorizedContracts(await betFactory.getAddress()));

const signers = await ethers.getSigners();

  for (let i = 0; i < signers.length; i++) {
    const addr = await signers[i].getAddress();
    const balance = await ethers.provider.getBalance(addr);
    console.log(i, addr);
  }
  /*var betDetails = {
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
*/
const block = await ethers.provider.getBlock("latest");
if (!block) {
  console.log("No block returned from provider");
} else {
  console.log("Block timestamp:", block.timestamp);
  console.log("Readable time:", new Date(block.timestamp * 1000).toISOString());
}