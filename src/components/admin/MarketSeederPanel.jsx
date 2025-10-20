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
// These functions send RPC commands directly to the Hardhat node.
// They will ONLY work on a local Hardhat network.

async function advanceTime(provider, seconds) {
  await provider.send("evm_increaseTime", [seconds]);
  await provider.send("evm_mine");
}

// --- E2E Test Script ---

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
        addLog("▶️ Starting E2E Test Script for Hardhat Network...");
        
        // Step 1: Connect directly to Hardhat node and get signers
        addLog("\n[1/7] Connecting to Hardhat provider and getting signers...");
        provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
        const deployer = await provider.getSigner(0);
        const creator = await provider.getSigner(1);
        const bettorYes = await provider.getSigner(2);
        const bettorNo = await provider.getSigner(3);
        const voter = await provider.getSigner(4);
        addLog(`  ✅ Deployer: ${await deployer.getAddress()}`);
        addLog(`  ✅ Creator: ${await creator.getAddress()}`);
        addLog(`  ✅ Bettor (YES): ${await bettorYes.getAddress()}`);
        addLog(`  ✅ Bettor (NO): ${await bettorNo.getAddress()}`);
        addLog(`  ✅ Voter: ${await voter.getAddress()}`);

        // Step 2: Fund all accounts from the deployer
        addLog("\n[2/7] Funding accounts with mUSDC and PROOF...");
        const usdc = getUsdcTokenContract(true).connect(deployer);
        const proof = getProofTokenContract(true).connect(deployer);

        const usdcAmount = ethers.parseUnits("10000", 6); // 10k USDC
        const proofAmount = ethers.parseEther("50000");    // 50k PROOF

        for (const acc of [creator, bettorYes, bettorNo, voter]) {
            const addr = await acc.getAddress();
            addLog(`  - Funding ${addr}...`);
            await (await usdc.mint(addr, usdcAmount)).wait();
            await (await proof.transfer(addr, proofAmount)).wait();
        }
        addLog("  ✅ All accounts funded.");

        // Step 3: All accounts deposit to the BetFactory internal wallet
        addLog("\n[3/7] Depositing funds into internal wallets...");
        const factory = getBetFactoryContract(true);
        for (const acc of [creator, bettorYes, bettorNo, voter]) {
            const addr = await acc.getAddress();
            addLog(`  - ${addr} depositing...`);
            await (await usdc.connect(acc).approve(await factory.getAddress(), usdcAmount)).wait();
            await (await factory.connect(acc).depositUsdc(usdcAmount)).wait();
            await (await proof.connect(acc).approve(await factory.getAddress(), proofAmount)).wait();
            await (await factory.connect(acc).depositProof(proofAmount)).wait();
        }
        addLog("  ✅ All accounts have deposited funds.");
        
        // Step 4: Create the Bet
        addLog("\n[4/7] Creating the prediction market...");
        const now = (await provider.getBlock('latest')).timestamp;
        const bettingDeadline = now + 3600; // 1 hour from now
        
        const betDetails = {
            creator: await creator.getAddress(),
            title: "Will Hardhat Time-Travel Test Succeed?",
            description: "A market created and resolved entirely by an automated script.",
            bettingDeadline: bettingDeadline,
            proofDeadline: bettingDeadline + 3600, // 1 hour after betting
            votingDeadline: bettingDeadline + 7200, // 2 hours after betting
            minimumBetAmount: ethers.parseUnits("10", 6),
            minimumSideStake: ethers.parseUnits("100", 6),
            minimumTrustScore: 0,
            voterRewardPercentage: 5,
            platformFeePercentage: 3,
            minimumVotes: 1,
        };

        const createTx = await factory.connect(creator).createBet(betDetails);
        const receipt = await createTx.wait();
        const betAddress = receipt.logs.find(log => log.eventName === 'BetCreated').args.betAddress;
        addLog(`  ✅ Market created at address: ${betAddress}`);

        const betContract = getBetContract(betAddress, true);

        // Step 5: Place Bets
        addLog("\n[5/7] Placing bets and time-traveling...");
        await (await betContract.connect(bettorYes).placeBet(1, ethers.parseUnits("500", 6))).wait(); // YES
        addLog("  - Bettor placed 500 USDC on YES.");
        await (await betContract.connect(bettorNo).placeBet(2, ethers.parseUnits("300", 6))).wait(); // NO
        addLog("  - Bettor placed 300 USDC on NO.");

        addLog("  - Advancing time past betting deadline...");
        await advanceTime(provider, 3601); // Advance 1 hour + 1 sec
        
        await (await betContract.connect(creator).checkAndCloseBetting()).wait();
        addLog("  ✅ Betting closed. Market status: AWAITING_PROOF");

        // Step 6: Submit Proof
        addLog("\n[6/7] Submitting proof and casting votes...");
        await (await betContract.connect(creator).submitProof("https://hardhat.org/")).wait();
        addLog("  - Proof submitted. Market status: VOTING");

        await (await betContract.connect(voter).vote(1)).wait(); // Vote YES
        addLog("  - Voter cast vote for YES.");

        // Step 7: Resolve the Bet
        addLog("\n[7/7] Time-traveling past voting deadline and resolving market...");
        addLog("  - Advancing time...");
        await advanceTime(provider, 3601); // Advance another hour

        await (await betContract.connect(creator).checkAndResolve()).wait();
        addLog("  ✅ Market resolved.");

        const winningSide = await betContract.winningSide();
        addLog(`  🏆 Winning Side: ${Number(winningSide) === 1 ? 'YES' : 'NO'}`);

        addLog("\n\n🎉 E2E Test Completed Successfully!");

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
          <Terminal className="w-5 h-5 text-cyan-400" />
          Hardhat E2E Test Runner
        </CardTitle>
        <CardDescription className="text-gray-400">
          Run a full end-to-end lifecycle test directly on your local Hardhat node.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert variant="destructive" className="bg-yellow-900/40 border-yellow-500/50 text-yellow-300">
          <AlertCircle className="h-4 w-4 !text-yellow-400" />
          <AlertTitle>Hardhat Local Network Only</AlertTitle>
          <AlertDescription>
            This script bypasses MetaMask and connects directly to `http://127.0.0.1:8545`. It will fail on any other network.
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
              Running Test Script...
            </>
          ) : (
            <>
              <PlayCircle className="mr-2 h-5 w-5" />
              Run Full Lifecycle Test
            </>
          )}
        </Button>

        {error && (
            <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-md flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-1" />
                <div>
                    <p className="font-bold text-red-300">An Error Occurred</p>
                    <p className="text-sm text-red-300">{error}</p>
                </div>
            </div>
        )}

        {logs.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-gray-300 font-semibold">Test Logs:</h4>
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