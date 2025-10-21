
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, PlayCircle, DatabaseZap, Terminal } from "lucide-react";
import { ethers } from "ethers";
import { 
    getBetFactoryContract,
    getBetContract,
    getProofTokenContract,
    getUsdcTokenContract,
} from "../blockchain/contracts";

// --- Hardhat Time-Travel Helpers ---
async function advanceTime(provider, seconds) {
  await provider.send("evm_increaseTime", [seconds]);
  await provider.send("evm_mine");
}

export default function MarketSeederPanel({ walletAddress }) {
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState("");
  const [logs, setLogs] = useState([]);

  const addLog = (message) => {
    setLogs(prev => [...prev, message]);
  };

  const handleRunE2ETest = async () => {
    setSeeding(true);
    setError("");
    setLogs([]);

    let provider;
    try {
        addLog("▶️ Starting E2E Seeding Script for Hardhat Network...");
        
        // --- 1. Setup ---
        addLog("\n[1/4] Connecting to Hardhat and preparing accounts...");
        provider = new ethers.JsonRpcProvider("http://127.00.1:8545");
        
        const accountAddresses = (await provider.listAccounts()).map(acc => acc.address);
        
        // We now need 9 accounts: deployer, 2 creators, 2 bettors, 3 voters, and 1 keeper
        if (accountAddresses.length < 9) {
            throw new Error("Not enough Hardhat accounts. Need at least 9.");
        }

        const signers = await Promise.all(accountAddresses.map(address => provider.getSigner(address)));
        const [deployer, creator1, creator2, bettorYes, bettorNo, voter1, voter2, voter3, keeper] = signers;
        
        addLog("  ✅ Accounts prepared.");

        // --- 2. Funding ---
        addLog("\n[2/4] Funding accounts with mUSDC and PROOF...");
        const usdc = getUsdcTokenContract(true).connect(deployer);
        const proof = getProofTokenContract(true).connect(deployer);
        const usdcAmount = ethers.parseUnits("10000", 6);
        const proofAmount = ethers.parseEther("50000");

        // Include the new 'keeper' account for funding
        const accountsToFund = [creator1, creator2, bettorYes, bettorNo, voter1, voter2, voter3, keeper];
        for (const acc of accountsToFund) {
            const addr = await acc.getAddress();
            addLog(`  - Funding ${addr.substring(0,10)}...`);
            await (await usdc.mint(addr, usdcAmount)).wait();
            // FIX: Transfer PROOF from the deployer's balance, not mint.
            await (await proof.transfer(addr, proofAmount)).wait();
        }
        addLog("  ✅ All accounts funded.");
        
        // --- 3. Internal Wallet Deposits ---
        addLog("\n[3/4] Depositing funds into internal wallets...");
        const factory = getBetFactoryContract(true);
        for (const acc of accountsToFund) {
            const addr = await acc.getAddress();
            addLog(`  - ${addr.substring(0,10)}... depositing...`);
            await (await usdc.connect(acc).approve(await factory.getAddress(), usdcAmount)).wait();
            await (await factory.connect(acc).depositUsdc(usdcAmount)).wait();
            await (await proof.connect(acc).approve(await factory.getAddress(), proofAmount)).wait();
            await (await factory.connect(acc).depositProof(proofAmount)).wait();
        }
        addLog("  ✅ All accounts have deposited funds.");

        // --- 4. Market Creation Scenarios ---
        addLog("\n[4/4] Creating markets with various statuses...");
        
        // Helper to robustly get bet address from receipt
        const getBetAddressFromReceipt = (receipt) => {
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

        // --- Scenario 1: Open for Betting ---
        addLog("\n  --- Creating Market 1: Open for Betting ---");
        currentTimestamp = (await provider.getBlock('latest')).timestamp;
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
        addLog(`    ✅ Market created: ${betAddress}`);
        betContract = getBetContract(betAddress, true);
        await (await betContract.connect(bettorYes).placeBet(1, ethers.parseUnits("150", 6))).wait();
        await (await betContract.connect(bettorNo).placeBet(2, ethers.parseUnits("120", 6))).wait();
        addLog("    ✅ Bets placed. Market is now OPEN.");

        // --- Scenario 2: Awaiting Proof ---
        addLog("\n  --- Creating Market 2: Awaiting Proof ---");
        currentTimestamp = (await provider.getBlock('latest')).timestamp;
        details.title = "Is 'Awaiting Proof' the current status of this market?";
        details.bettingDeadline = currentTimestamp + 60;
        details.proofDeadline = currentTimestamp + 1200;
        details.votingDeadline = currentTimestamp + 2400;
        createTx = await factory.connect(creator1).createBet(details);
        receipt = await createTx.wait();
        betAddress = getBetAddressFromReceipt(receipt);
        addLog(`    ✅ Market created: ${betAddress}`);
        betContract = getBetContract(betAddress, true);
        await (await betContract.connect(bettorYes).placeBet(1, ethers.parseUnits("200", 6))).wait();
        await (await betContract.connect(bettorNo).placeBet(2, ethers.parseUnits("250", 6))).wait();
        addLog("    - Advancing time past betting deadline...");
        await advanceTime(provider, 61);
        // Keeper calls checkAndCloseBetting
        await (await betContract.connect(keeper).checkAndCloseBetting()).wait();
        addLog("    ✅ Betting closed. Market is now AWAITING PROOF.");

        // --- Scenario 3: Voting ---
        addLog("\n  --- Creating Market 3: Voting ---");
        currentTimestamp = (await provider.getBlock('latest')).timestamp;
        details.title = "Should smart contract documentation be a top priority for developers?";
        details.bettingDeadline = currentTimestamp + 60;
        details.proofDeadline = currentTimestamp + 120;
        details.votingDeadline = currentTimestamp + 1200;
        createTx = await factory.connect(creator2).createBet(details);
        receipt = await createTx.wait();
        betAddress = getBetAddressFromReceipt(receipt);
        addLog(`    ✅ Market created: ${betAddress}`);
        betContract = getBetContract(betAddress, true);
        await (await betContract.connect(bettorYes).placeBet(1, ethers.parseUnits("300", 6))).wait();
        await (await betContract.connect(bettorNo).placeBet(2, ethers.parseUnits("100", 6))).wait();
        await advanceTime(provider, 61);
        // Keeper calls checkAndCloseBetting
        await (await betContract.connect(keeper).checkAndCloseBetting()).wait();
        await (await betContract.connect(creator2).submitProof("https://ethereum.org/en/developers/docs/")).wait();
        addLog("    ✅ Proof submitted. Market is now VOTING.");

        // --- Scenario 4: Completed (YES wins) ---
        addLog("\n  --- Creating Market 4: Completed ---");
        currentTimestamp = (await provider.getBlock('latest')).timestamp;
        details.title = "Was this test script executed successfully?";
        details.bettingDeadline = currentTimestamp + 60;
        details.proofDeadline = currentTimestamp + 120;
        details.votingDeadline = currentTimestamp + 180;
        createTx = await factory.connect(creator2).createBet(details);
        receipt = await createTx.wait();
        betAddress = getBetAddressFromReceipt(receipt);
        addLog(`    ✅ Market created: ${betAddress}`);
        betContract = getBetContract(betAddress, true);
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
        addLog("    ✅ Market resolved. Market is now COMPLETED.");

        // --- Scenario 5: Cancelled (No Proof) ---
        addLog("\n  --- Creating Market 5: Cancelled (No Proof) ---");
        currentTimestamp = (await provider.getBlock('latest')).timestamp;
        details.title = "Will this market be cancelled if the creator fails to provide proof?";
        details.bettingDeadline = currentTimestamp + 60;
        details.proofDeadline = currentTimestamp + 120;
        details.votingDeadline = currentTimestamp + 1800;
        createTx = await factory.connect(creator1).createBet(details);
        receipt = await createTx.wait();
        betAddress = getBetAddressFromReceipt(receipt);
        addLog(`    ✅ Market created: ${betAddress}`);
        betContract = getBetContract(betAddress, true);
        await (await betContract.connect(bettorYes).placeBet(1, ethers.parseUnits("100", 6))).wait();
        await (await betContract.connect(bettorNo).placeBet(2, ethers.parseUnits("100", 6))).wait();
        await advanceTime(provider, 121); // Advance past proof deadline
        // Keeper calls checkAndCloseBetting
        await (await betContract.connect(keeper).checkAndCloseBetting()).wait(); 
        // Keeper calls checkAndCancelForProof
        await (await betContract.connect(keeper).checkAndCancelForProof()).wait();
        addLog("    ✅ No proof submitted. Market is now CANCELLED.");

        // --- Scenario 6: Cancelled (Vote Tie) ---
        addLog("\n  --- Creating Market 6: Cancelled (Vote Tie) ---");
        currentTimestamp = (await provider.getBlock('latest')).timestamp;
        details.title = "If the vote is a tie, does the market get cancelled?";
        details.bettingDeadline = currentTimestamp + 60;
        details.proofDeadline = currentTimestamp + 120;
        details.votingDeadline = currentTimestamp + 180;
        createTx = await factory.connect(creator2).createBet(details);
        receipt = await createTx.wait();
        betAddress = getBetAddressFromReceipt(receipt);
        addLog(`    ✅ Market created: ${betAddress}`);
        betContract = getBetContract(betAddress, true);
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
        addLog("    ✅ Vote was a tie. Market is now CANCELLED.");

        // --- NEW Scenario 7: About to Close ---
        addLog("\n  --- Creating Market 7: About to Close ---");
        currentTimestamp = (await provider.getBlock('latest')).timestamp;
        details.title = "Will this market close in the next minute?";
        details.bettingDeadline = currentTimestamp + 60; // Closes soon
        details.proofDeadline = currentTimestamp + 86400;
        details.votingDeadline = currentTimestamp + 86400 * 2;
        createTx = await factory.connect(creator1).createBet(details);
        receipt = await createTx.wait();
        betAddress = getBetAddressFromReceipt(receipt);
        addLog(`    ✅ Market created: ${betAddress}`);
        betContract = getBetContract(betAddress, true);
        await (await betContract.connect(bettorYes).placeBet(1, ethers.parseUnits("50", 6))).wait();
        addLog("    ✅ Bets placed. Market is OPEN (closes soon).");
        
        // --- NEW Scenario 8: High Minimum Bet ---
        addLog("\n  --- Creating Market 8: High Minimum Bet ---");
        currentTimestamp = (await provider.getBlock('latest')).timestamp;
        details.title = "Is a $1000 minimum bet too high for a prediction market?";
        details.bettingDeadline = currentTimestamp + 86400 * 3;
        details.proofDeadline = currentTimestamp + 86400 * 4;
        details.votingDeadline = currentTimestamp + 86400 * 5;
        details.minimumBetAmount = ethers.parseUnits("1000", 6);
        createTx = await factory.connect(creator2).createBet(details);
        receipt = await createTx.wait();
        betAddress = getBetAddressFromReceipt(receipt);
        addLog(`    ✅ Market created with $1000 min bet: ${betAddress}`);


        addLog("\n\n🎉 Seeding Completed Successfully! Refresh the page to see all the new markets.");

    } catch (err) {
      console.error("Failed to run E2E script:", err);
      const message = err.reason || err.message || "Operation failed. Check the browser console for details.";
      setError(message);
      addLog(`❌ Error: ${message}`);
    } finally {
        setSeeding(false);
    }
  };

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <DatabaseZap className="w-5 h-5 text-cyan-400" />
          Hardhat Market Seeder
        </CardTitle>
        <CardDescription className="text-gray-400">
          Populate your local Hardhat network with markets in various states.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert variant="destructive" className="bg-yellow-900/40 border-yellow-500/50 text-yellow-300">
          <AlertCircle className="h-4 w-4 !text-yellow-400" />
          <AlertTitle>Hardhat Local Network Only</AlertTitle>
          <AlertDescription>
            This script connects directly to `http://127.0.0.1:8545`. Restarting your local chain will clear all seeded markets.
          </AlertDescription>
        </Alert>

        <Button
          onClick={handleRunE2ETest}
          disabled={seeding}
          className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-base"
        >
          {seeding ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Seeding Markets...
            </>
          ) : (
            <>
              <PlayCircle className="mr-2 h-5 w-5" />
              Run Market Seeder
            </>
          )}
        </Button>

        {error && (
            <div className="p-3 bg-red-900/20 border-red-500/30 rounded-md flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-1" />
                <div>
                    <p className="font-bold text-red-300">An Error Occurred</p>
                    <p className="text-sm text-red-300">{error}</p>
                </div>
            </div>
        )}

        {logs.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-gray-300 font-semibold">Seeder Logs:</h4>
            <div className="p-4 bg-gray-900 rounded-md max-h-96 overflow-y-auto font-mono">
              <pre className="text-sm text-gray-400 whitespace-pre-wrap break-all">
                {logs.join('\n')}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
