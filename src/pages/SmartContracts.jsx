import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code, Copy, Check, Terminal } from "lucide-react";
import {
  BET_FACTORY_ABI,
  BET_ABI,
  ERC20_ABI,
  TRUST_SCORE_ABI,
  CONTRACT_ADDRESSES,
} from "../components/blockchain/contracts";

const contractsData = [
  {
    name: "BetFactory",
    address: CONTRACT_ADDRESSES.BetFactory,
    abi: BET_FACTORY_ABI,
    description: "The main factory contract responsible for creating new Bet markets, managing internal wallets, and setting platform-wide fees."
  },
  {
    name: "Bet",
    address: "Dynamically Deployed",
    abi: BET_ABI,
    description: "The contract for an individual prediction market. A new instance is deployed by the BetFactory for each market created."
  },
  {
    name: "ProofToken (PROOF)",
    address: CONTRACT_ADDRESSES.ProofToken,
    abi: ERC20_ABI,
    description: "The ERC-20 utility token for the platform, used for paying creation fees, staking on votes, and future governance."
  },
  {
    name: "MockUSDC (USDC)",
    address: CONTRACT_ADDRESSES.USDC,
    abi: ERC20_ABI,
    description: "The ERC-20 stablecoin used for placing all bets, providing a stable unit of account for market participants."
  },
  {
    name: "TrustScore",
    address: CONTRACT_ADDRESSES.TrustScore,
    abi: TRUST_SCORE_ABI,
    description: "A placeholder contract for the future reputation system that will track user participation and honesty."
  }
];

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button onClick={handleCopy} className="absolute top-2 right-2 p-1.5 bg-gray-700 rounded-md hover:bg-gray-600">
      {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
    </button>
  );
};


export default function SmartContractsPage() {

  return (
    <div className="bg-gray-900 text-white min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Code className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">Smart Contracts</h1>
              <p className="text-cyan-200 text-lg">Technical details for developers and auditors.</p>
            </div>
        </div>

        <Tabs defaultValue="BetFactory" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 bg-gray-800 border-gray-700">
            {contractsData.map(c => <TabsTrigger key={c.name} value={c.name}>{c.name}</TabsTrigger>)}
          </TabsList>
          
          {contractsData.map(contract => (
            <TabsContent key={contract.name} value={contract.name} className="mt-6">
              <Card className="bg-gray-800 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-2xl text-white flex items-center gap-3">
                    <Terminal className="w-6 h-6 text-cyan-400"/>
                    {contract.name}
                  </CardTitle>
                  <CardDescription className="text-gray-400 pt-2">{contract.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Contract Address</h3>
                    <div className="relative">
                      <pre className="bg-gray-900 p-4 rounded-md text-cyan-300 font-mono text-sm overflow-x-auto">
                        <code>{contract.address}</code>
                      </pre>
                      <CopyButton text={contract.address} />
                    </div>
                  </div>
                   <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Contract ABI</h3>
                     <div className="relative">
                      <pre className="bg-gray-900 p-4 rounded-md text-purple-300 font-mono text-xs max-h-96 overflow-y-auto">
                        <code>{JSON.stringify(contract.abi, null, 2)}</code>
                      </pre>
                      <CopyButton text={JSON.stringify(contract.abi, null, 2)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}