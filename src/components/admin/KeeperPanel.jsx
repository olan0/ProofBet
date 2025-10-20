import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, PlayCircle, Bot, Zap } from "lucide-react";
import { ethers } from "ethers";
import { getBetFactoryContract, getBetContract } from "../blockchain/contracts";

const STATUS_ENUM = { OPEN_FOR_BETS: 0, AWAITING_PROOF: 1, VOTING: 2, COMPLETED: 3, CANCELLED: 4 };

export default function KeeperPanel({ walletAddress }) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [logs, setLogs] = useState([]);

  const addLog = (message) => {
    setLogs(prev => [...prev, message]);
  };

  const handleRunKeeper = async () => {
    setRunning(true);
    setError("");
    setLogs([]);

    try {
        addLog("🤖 Keeper script started...");
        const factory = getBetFactoryContract(true);
        const betAddresses = await factory.getBets();
        addLog(`🔎 Found ${betAddresses.length} markets to check.`);

        if (betAddresses.length === 0) {
            addLog("✅ No markets to process. Exiting.");
            setRunning(false);
            return;
        }

        let actionsTaken = 0;

        for (const address of betAddresses) {
            addLog(`\n--- Checking market: ${address.substring(0, 10)}...`);
            const betContract = getBetContract(address, true);
            const status = await betContract.currentStatus();
            const details = await betContract.details();
            const now = Math.floor(Date.now() / 1000);

            if (Number(status) === STATUS_ENUM.OPEN_FOR_BETS && now > details.bettingDeadline) {
                addLog("  - Status: OPEN. Deadline passed. Triggering 'checkAndCloseBetting'...");
                const tx = await betContract.checkAndCloseBetting();
                await tx.wait();
                addLog("  ✅ Market state advanced.");
                actionsTaken++;
            } else if (Number(status) === STATUS_ENUM.AWAITING_PROOF && now > details.proofDeadline) {
                addLog("  - Status: AWAITING PROOF. Deadline passed. Triggering 'checkAndCancelForProof'...");
                const tx = await betContract.checkAndCancelForProof();
                await tx.wait();
                addLog("  ✅ Market state advanced.");
                actionsTaken++;
            } else if (Number(status) === STATUS_ENUM.VOTING && now > details.votingDeadline) {
                addLog("  - Status: VOTING. Deadline passed. Triggering 'checkAndResolve'...");
                const tx = await betContract.checkAndResolve();
                await tx.wait();
                addLog("  ✅ Market state advanced.");
                actionsTaken++;
            } else {
                addLog("  - No action needed at this time.");
            }
        }
        
        addLog(`\n\n🎉 Keeper script finished. ${actionsTaken} action(s) taken.`);

    } catch (err) {
      console.error("Failed to run keeper script:", err);
      const message = err.reason || err.message || "Operation failed. Check the browser console for details.";
      setError(message);
      addLog(`❌ Error: ${message}`);
    } finally {
        setRunning(false);
    }
  };

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Bot className="w-5 h-5 text-cyan-400" />
          Keeper Bot Simulator
        </CardTitle>
        <CardDescription className="text-gray-400">
          Run a script to update the state of all markets whose deadlines have passed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert className="bg-blue-900/40 border-blue-500/50 text-blue-300">
          <Zap className="h-4 w-4 !text-blue-400" />
          <AlertTitle>How It Works</AlertTitle>
          <AlertDescription>
            This simulates an off-chain "keeper" by checking all markets and sending transactions to update any that have passed their deadlines.
          </AlertDescription>
        </Alert>

        <Button
          onClick={handleRunKeeper}
          disabled={running}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-base"
        >
          {running ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running Keeper Check...
            </>
          ) : (
            <>
              <PlayCircle className="mr-2 h-5 w-5" />
              Run Keeper Check
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
            <h4 className="text-gray-300 font-semibold">Keeper Logs:</h4>
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