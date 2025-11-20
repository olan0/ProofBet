import { network } from "hardhat";
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

const stake = parseFloat(ethers.formatEther(await factory.proofCollateralUsdc()))
console.log("Creator stake (USDC): ", stake.toString());
await factory.connect(accountAddresses[0]).setProofCollateralUsdc(ethers.parseUnits("20", 6));
const newStake = parseFloat(ethers.formatEther(await factory.proofCollateralUsdc()))
console.log("New Creator stake (USDC): ", newStake.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});