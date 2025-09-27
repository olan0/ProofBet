import { network } from "hardhat";

const { ethers } = await network.connect({
  network: "localhost",
  chainType: "l1",
});

const proofToken = await ethers.getContractAt("ProofToken", "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512");
const trustScore = await ethers.getContractAt("TrustScore", "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0");
const betFactory = await ethers.getContractAt("BetFactory", "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9");


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