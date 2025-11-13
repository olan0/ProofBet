
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  BookOpen, 
  TrendingUp, 
  Coins, 
  Shield, 
  Users, 
  Code, 
  Zap,
  DollarSign,
  Vote,
  Trophy,
  FileText,
  ArrowRight,
  CheckCircle,
  PieChart,
  Lock,
  Wallet,
  Download,
  Upload,
  PlayCircle, // New Icon
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";


export default function DocumentationPage() {
  const [activeSection, setActiveSection] = useState("overview");

  const sections = [
    { id: "overview", title: "Platform Overview", icon: BookOpen },
    { id: "tokenomics", title: "Tokenomics", icon: Coins },
    { id: "user-guide", title: "User Guide", icon: Users },
    { id: "trust-score", title: "Trust Score System", icon: Shield },
    { id: "smart-contracts", title: "Smart Contracts", icon: Code },
    { id: "api", title: "Technical Specs", icon: FileText },
    { id: "roadmap", title: "Roadmap", icon: TrendingUp }
  ];

  const vestingSchedules = [
    {
      beneficiary: 'Team & Advisors',
      total_allocation: '200,000,000',
      allocation_percentage: 20,
      cliff_duration_months: 12,
      vesting_duration_months: 48,
      status: { label: "Vesting", icon: <PlayCircle className="w-4 h-4 text-blue-400" />, color: "bg-blue-500/10 text-blue-300" },
      unlocked: '25.00'
    },
    {
      beneficiary: 'Seed Investors',
      total_allocation: '150,000,000',
      allocation_percentage: 15,
      cliff_duration_months: 6,
      vesting_duration_months: 24,
      status: { label: "Vesting", icon: <PlayCircle className="w-4 h-4 text-blue-400" />, color: "bg-blue-500/10 text-blue-300" },
      unlocked: '50.00'
    },
    {
      beneficiary: 'Foundation Treasury',
      total_allocation: '100,000,000',
      allocation_percentage: 10,
      cliff_duration_months: 0,
      vesting_duration_months: 60,
      status: { label: "Vesting", icon: <PlayCircle className="w-4 h-4 text-blue-400" />, color: "bg-blue-500/10 text-blue-300" },
      unlocked: '10.00'
    },
     {
      beneficiary: 'Community & Ecosystem',
      total_allocation: '450,000,000',
      allocation_percentage: 45,
      cliff_duration_months: 0,
      vesting_duration_months: 72,
      status: { label: "Locked", icon: <Lock className="w-4 h-4 text-red-400" />, color: "bg-red-500/10 text-red-300" },
      unlocked: '0.00'
    }
  ];

  return (
    <div className="bg-gray-900 text-white min-h-screen">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-900 to-purple-900 border-b border-gray-800 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl flex items-center justify-center">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">ProofBet Documentation</h1>
              <p className="text-cyan-200 text-lg">Decentralized Prediction Markets with Proof-Based Resolution</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-gray-300">Dual-token system (USDC + PROOF)</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-gray-300">Community-driven verification</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-gray-300">Smart contract powered</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:w-64 flex-shrink-0">
            <Card className="bg-gray-800 border-gray-700 sticky top-8">
              <CardHeader>
                <CardTitle className="text-white text-lg">Navigation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {sections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <Button
                      key={section.id}
                      variant={activeSection === section.id ? "default" : "ghost"}
                      className={`w-full justify-start ${
                        activeSection === section.id 
                          ? 'bg-cyan-600 hover:bg-cyan-700 text-white' 
                          : 'text-gray-300 hover:text-white hover:bg-gray-700'
                      }`}
                      onClick={() => setActiveSection(section.id)}
                    >
                      <Icon className="w-4 h-4 mr-3" />
                      {section.title}
                    </Button>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {/* Platform Overview */}
            {activeSection === "overview" && (
              <div className="space-y-8">
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-2xl text-white flex items-center gap-2">
                      <BookOpen className="w-6 h-6 text-cyan-400" />
                      What is ProofBet?
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <p className="text-gray-300 text-lg leading-relaxed">
                      ProofBet is a decentralized prediction market platform where users can create, bet on, and verify outcomes of real-world events. Unlike traditional betting platforms, ProofBet requires creators to provide verifiable proof of outcomes, which is then validated by the community through a democratic voting system.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                        <Trophy className="w-8 h-8 text-cyan-400 mb-3" />
                        <h3 className="font-semibold text-white mb-2">Proof-Based Resolution</h3>
                        <p className="text-gray-300 text-sm">
                          Every bet requires the creator to submit verifiable proof (video, photo, or live stream) when claiming victory.
                        </p>
                      </div>
                      <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                        <Users className="w-8 h-8 text-purple-400 mb-3" />
                        <h3 className="font-semibold text-white mb-2">Community Verification</h3>
                        <p className="text-gray-300 text-sm">
                          Neutral observers vote on submitted proof to determine the true outcome, earning rewards for honest participation.
                        </p>
                      </div>
                      <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <DollarSign className="w-8 h-8 text-green-400 mb-3" />
                        <h3 className="font-semibold text-white mb-2">Stable Currency</h3>
                        <p className="text-gray-300 text-sm">
                          All betting is done in USDC stablecoin, eliminating volatility risk and providing predictable payouts.
                        </p>
                      </div>
                      <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                        <Shield className="w-8 h-8 text-orange-400 mb-3" />
                        <h3 className="font-semibold text-white mb-2">Trust Score System</h3>
                        <p className="text-gray-300 text-sm">
                          Users build reputation through honest participation, unlocking access to exclusive high-stakes markets.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-xl text-white">How It Works</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {[
                        {
                          step: 1,
                          title: "Create a Bet",
                          description: "Pay creation fee in PROOF tokens and set your claim with deadlines and proof requirements.",
                          color: "cyan"
                        },
                        {
                          step: 2,
                          title: "Community Bets",
                          description: "Others stake USDC on YES or NO sides of your claim until the betting deadline.",
                          color: "purple"
                        },
                        {
                          step: 3,
                          title: "Submit Proof",
                          description: "After the event occurs, submit verifiable proof (video, photo, or stream) of the outcome.",
                          color: "green"
                        },
                        {
                          step: 4,
                          title: "Community Votes",
                          description: "Neutral observers stake PROOF tokens to vote on whether your proof is valid.",
                          color: "orange"
                        },
                        {
                          step: 5,
                          title: "Automatic Payout",
                          description: "Smart contracts automatically distribute winnings to correct bettors and reward honest voters.",
                          color: "pink"
                        }
                      ].map((step) => (
                        <div key={step.step} className="flex items-start gap-4">
                          <div className={`w-8 h-8 bg-${step.color}-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                            {step.step}
                          </div>
                          <div>
                            <h4 className="font-semibold text-white mb-1">{step.title}</h4>
                            <p className="text-gray-300 text-sm">{step.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Tokenomics */}
            {activeSection === "tokenomics" && (
              <div className="space-y-8">
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-2xl text-white flex items-center gap-2">
                      <Coins className="w-6 h-6 text-yellow-500" />
                      PROOF Tokenomics
                    </CardTitle>
                    <p className="text-gray-300 text-lg leading-relaxed pt-2">
                      The PROOF token is the backbone of the ProofBet ecosystem, designed for long-term utility, decentralized governance, and sustainable growth. The total supply is capped at 1 billion tokens.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-8">
                    {/* Allocation Section */}
                    <Card className="bg-gray-700 border-gray-600">
                      <CardHeader>
                        <CardTitle className="text-white text-xl flex items-center gap-2">
                          <PieChart className="w-5 h-5 text-cyan-400"/>
                          Token Allocation
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {[
                          { name: 'Community & Ecosystem', percentage: '45%', color: 'cyan' },
                          { name: 'Team & Advisors', percentage: '20%', color: 'purple' },
                          { name: 'Seed Investors', percentage: '15%', color: 'green' },
                          { name: 'Foundation Treasury', percentage: '10%', color: 'orange' },
                          { name: 'Public Sale & Liquidity', percentage: '10%', color: 'pink' }
                        ].map(item => (
                          <div key={item.name} className={`p-4 border border-${item.color}-500/30 bg-${item.color}-500/10 rounded-lg text-center`}>
                            <h3 className={`font-bold text-2xl text-${item.color}-300`}>{item.percentage}</h3>
                            <p className="text-sm text-gray-300 mt-1">{item.name}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    {/* Vesting Schedule Section */}
                    <Card className="bg-gray-700 border-gray-600">
                      <CardHeader>
                        <CardTitle className="text-white text-xl flex items-center gap-2">
                          <Lock className="w-5 h-5 text-red-400"/>
                           Vesting & Release Schedule
                        </CardTitle>
                        <p className="text-gray-400 pt-2">
                          To ensure long-term commitment and prevent market manipulation, team and investor tokens are subject to a multi-year vesting schedule. This table displays the planned release schedule for all allocated tokens.
                        </p>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <Table className="bg-gray-800 border-gray-700 rounded-lg">
                            <TableHeader>
                              <TableRow className="border-b-gray-700">
                                <TableHead className="text-white">Beneficiary</TableHead>
                                <TableHead className="text-white">Total Allocation (PROOF)</TableHead>
                                <TableHead className="text-white">Cliff</TableHead>
                                <TableHead className="text-white">Vesting Period</TableHead>
                                <TableHead className="text-white">Status</TableHead>
                                <TableHead className="text-white text-right">Unlocked</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {vestingSchedules.map((schedule) => {
                                const status = schedule.status;
                                const unlocked = schedule.unlocked;
                                return (
                                  <TableRow key={schedule.beneficiary} className="border-b-gray-700/50">
                                    <TableCell className="font-medium text-gray-200">{schedule.beneficiary}</TableCell>
                                    <TableCell className="text-gray-300">
                                      {schedule.total_allocation} 
                                      <span className="text-gray-400 ml-2">({schedule.allocation_percentage}%)</span>
                                    </TableCell>
                                    <TableCell className="text-gray-300">{schedule.cliff_duration_months} months</TableCell>
                                    <TableCell className="text-gray-300">{schedule.vesting_duration_months} months</TableCell>
                                    <TableCell>
                                      <Badge className={`flex items-center gap-2 ${status.color}`}>
                                        {status.icon}
                                        {status.label}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right text-gray-300">{unlocked}%</TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Core Mechanics */}
                    <Card className="bg-gray-700 border-gray-600">
                      <CardHeader>
                        <CardTitle className="text-white text-xl flex items-center gap-2">
                          <Zap className="w-5 h-5 text-yellow-400"/>
                          Core Mechanics
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
                         <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <h4 className="font-semibold text-white mb-2">Fee Burning</h4>
                            <p className="text-gray-300 text-sm">50% of all PROOF platform fees are permanently burned, creating a deflationary pressure on the token supply.</p>
                          </div>
                          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                            <h4 className="font-semibold text-white mb-2">Staking & Rewards</h4>
                            <p className="text-gray-300 text-sm">Users can stake PROOF tokens to participate in governance and earn a share of platform revenue.</p>
                          </div>
                          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                            <h4 className="font-semibold text-white mb-2">Governance</h4>
                            <p className="text-gray-300 text-sm">PROOF holders will be able to vote on key platform decisions, such as fee changes and feature development.</p>
                          </div>
                      </CardContent>
                    </Card>

                  </CardContent>
                </Card>
              </div>
            )}

            {/* User Guide */}
            {activeSection === "user-guide" && (
              <div className="space-y-8">
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-2xl text-white flex items-center gap-2">
                      <Users className="w-6 h-6 text-blue-400" />
                      Getting Started
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                          <span className="w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center text-sm">1</span>
                          Connect Wallet
                        </h3>
                        <p className="text-gray-300 text-sm">
                          Connect your Web3 wallet (e.g., MetaMask) to start interacting with the platform.
                        </p>
                      </div>
                      <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                          <span className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-sm">2</span>
                          Deposit Funds
                        </h3>
                        <p className="text-gray-300 text-sm">
                          Use the Wallet tab to deposit USDC and PROOF tokens from your personal wallet into your gas-efficient internal wallet.
                        </p>
                      </div>
                      <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                          <span className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-sm">3</span>
                          Start Participating
                        </h3>
                        <p className="text-gray-300 text-sm">
                          Browse markets, place bets, create markets, and vote on outcomes using your internal balances.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Tabs defaultValue="wallet" className="space-y-6">
                  <TabsList className="bg-gray-800 border border-gray-700 grid w-full grid-cols-4">
                    <TabsTrigger value="wallet">Internal Wallet</TabsTrigger>
                    <TabsTrigger value="betting">Placing Bets</TabsTrigger>
                    <TabsTrigger value="creating">Creating Markets</TabsTrigger>
                    <TabsTrigger value="voting">Voting</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="wallet">
                    <Card className="bg-gray-800 border-gray-700">
                      <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2"><Wallet className="w-5 h-5 text-cyan-400"/>The Internal Wallet System</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <p className="text-gray-300">
                          To save on gas fees and improve user experience, ProofBet uses an internal wallet system. Instead of approving every single transaction, you deposit funds once into the platform's smart contract, and all subsequent actions (betting, creating, voting) use this internal balance.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg space-y-3">
                            <h4 className="font-semibold text-white flex items-center gap-2"><Upload className="w-4 h-4"/>Depositing Funds</h4>
                             <p className="text-gray-300 text-sm">
                                1. Go to the "Wallet" tab on the main dashboard.
                                <br/>
                                2. Enter the amount of USDC or PROOF you wish to deposit.
                                <br/>
                                3. Approve the token transfer in your wallet.
                                <br/>
                                4. Confirm the deposit transaction. Your internal balance will update.
                             </p>
                          </div>
                           <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg space-y-3">
                            <h4 className="font-semibold text-white flex items-center gap-2"><Download className="w-4 h-4"/>Withdrawing Funds</h4>
                             <p className="text-gray-300 text-sm">
                                1. Go to the "Wallet" tab.
                                <br/>
                                2. In the "Withdraw" section, enter the amount to transfer back to your personal wallet.
                                <br/>
                                3. Confirm the withdrawal transaction.
                                <br/>
                                4. Your funds will be sent from the contract back to your connected wallet address.
                             </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="betting">
                    <Card className="bg-gray-800 border-gray-700">
                      <CardHeader>
                        <CardTitle className="text-white">How to Place Bets</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {[
                          "Browse the Markets tab to find active prediction markets",
                          "Check the bet details, deadlines, and minimum trust score requirements",
                          "Ensure you have sufficient USDC deposited in your internal wallet",
                          "Click 'Place Bet' and choose YES or NO side",
                          "Enter your stake amount (in USDC)",
                          "Confirm the transaction (no separate approval needed!)",
                          "Wait for outcome resolution to claim winnings"
                        ].map((step, index) => (
                          <div key={index} className="flex items-start gap-3">
                            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
                              {index + 1}
                            </div>
                            <p className="text-gray-300">{step}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="creating">
                    <Card className="bg-gray-800 border-gray-700">
                      <CardHeader>
                        <CardTitle className="text-white">Creating Prediction Markets</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                          <h4 className="font-semibold text-white mb-2">Requirements:</h4>
                          <ul className="space-y-1 text-gray-300 text-sm">
                            <li>• A creation fee in PROOF tokens (set by the contract) from your internal balance.</li>
                            <li>• Must provide a clear, verifiable claim with specific outcomes.</li>
                            <li>• Set appropriate deadlines for betting, proof submission, and voting.</li>
                          </ul>
                        </div>
                        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <h4 className="font-semibold text-white mb-2">Dynamic Creation Fee</h4>
                        <p className="text-gray-300 text-sm">
                          The required PROOF fee now scales based on how long the bet’s deadline is:
                          <br/>
                          <strong>• Less than 7 days:</strong> 1× base fee<br/>
                          <strong>• 7–14 days:</strong> 1.5× base fee<br/>
                          <strong>• More than 14 days:</strong> 2× base fee<br/>
                          <br/>
                          The default base duration (D) is 7 days, configurable by the platform.
                        </p>
                      </div>
                        <div className="space-y-4">
                          {[
                            "Navigate to 'Create Market' (requires wallet connection)",
                            "Fill in the market title and a detailed description",
                            "Set the category and the required proof type (e.g., video, photo)",
                            "Configure financial parameters like minimum bet amount", 
                            "Set the three key deadlines for the market lifecycle",
                            "Confirm the transaction. The PROOF fee will be deducted from your internal wallet.",
                            "Your market goes live immediately for others to participate."
                          ].map((step, index) => (
                            <div key={index} className="flex items-start gap-3">
                              <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
                                {index + 1}
                              </div>
                              <p className="text-gray-300">{step}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="voting">
                    <Card className="bg-gray-800 border-gray-700">
                      <CardHeader>
                        <CardTitle className="text-white">Community Voting System</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                          <h4 className="font-semibold text-white mb-2">Voting Requirements:</h4>
                          <ul className="space-y-1 text-gray-300 text-sm">
                            <li>• You cannot have a financial stake (bet) in the market you're voting on.</li>
                            <li>• You must have enough PROOF tokens in your internal balance for the vote stake.</li>
                            <li>• Vote honestly based on the provided evidence to earn rewards.</li>
                          </ul>
                        </div>

                        <div className="space-y-4">
                          {[
                            "Find markets in the 'Voting' tab",
                            "Carefully review the submitted proof link", 
                            "Ensure you haven't bet on this market",
                            "Click 'Vote' and choose YES if the proof is valid, or NO if it is not",
                            "Confirm the transaction. The PROOF stake will be deducted from your internal wallet.",
                            "Earn rewards and get your stake back if you vote with the majority.",
                            "Forfeit your stake if you vote against the consensus."
                          ].map((step, index) => (
                            <div key={index} className="flex items-start gap-3">
                              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
                                {index + 1}
                              </div>
                              <p className="text-gray-300">{step}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </div>
            )}
            
            {/* Trust Score System */}
            {activeSection === "trust-score" && (
              <div className="space-y-8">
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-2xl text-white flex items-center gap-2">
                      <Shield className="w-6 h-6 text-green-400" />
                      Trust Score System
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <p className="text-gray-300 text-lg leading-relaxed">
                      The Trust Score is a reputation system that tracks user behavior and rewards honest participation. Users with higher trust scores gain access to exclusive markets and are seen as more reliable by the community.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {[
                        { range: "0-25", color: "red", label: "New User", access: "Basic markets only" },
                        { range: "26-50", color: "yellow", label: "Active User", access: "Most markets" }, 
                        { range: "51-75", color: "blue", label: "Trusted User", access: "High-value markets" },
                        { range: "76-100", color: "green", label: "Elite User", access: "All markets + perks" }
                      ].map((tier) => (
                        <div key={tier.range} className={`p-4 bg-${tier.color}-500/10 border border-${tier.color}-500/20 rounded-lg text-center`}>
                          <div className={`w-12 h-12 bg-${tier.color}-500 rounded-full flex items-center justify-center mx-auto mb-3`}>
                            <Shield className="w-6 h-6 text-white" />
                          </div>
                          <h4 className="font-semibold text-white mb-1">{tier.label}</h4>
                          <div className="text-lg font-bold text-white mb-2">{tier.range}</div>
                          <p className="text-gray-300 text-xs">{tier.access}</p>
                        </div>
                      ))}
                    </div>

                    <Card className="bg-gray-700 border-gray-600">
                      <CardHeader>
                        <CardTitle className="text-white text-lg">How Trust Score is Calculated</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-semibold text-white mb-3">Positive Factors (Increase Score)</h4>
                            <ul className="space-y-2 text-gray-300 text-sm">
                              <li>• Account age (max 20 points)</li>
                              <li>• Bets participated in (max 30 points)</li>
                              <li>• Bets created (max 25 points)</li>
                              <li>• Voting accuracy (max 25 points)</li>
                              <li>• Consistent activity over time</li>
                            </ul>
                          </div>
                          <div>
                            <h4 className="font-semibold text-white mb-3">Score Benefits</h4>
                            <ul className="space-y-2 text-gray-300 text-sm">
                              <li>• Access to exclusive markets</li>
                              <li>• Higher betting limits</li>
                              <li>• Reduced platform fees</li>
                              <li>• Community recognition</li>
                              <li>• Future governance voting power</li>
                            </ul>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </CardContent>
                  <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                  <h4 className="font-semibold text-white mb-2">Impact on Voting Stake</h4>
                  <p className="text-gray-300 text-sm">
                    The higher your Trust Score and account age, the less PROOF you need to stake when voting. 
                    New or unproven accounts must stake more, encouraging long-term honest participation.
                  </p>
                </div>
                </Card>
              </div>
            )}

            {/* Smart Contracts */}
            {activeSection === "smart-contracts" && (
              <div className="space-y-8">
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-2xl text-white flex items-center gap-2">
                      <Code className="w-6 h-6 text-cyan-400" />
                      Smart Contract Architecture
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <p className="text-gray-300 text-lg leading-relaxed">
                      ProofBet runs on a modular system of smart contracts, ensuring transparency, security, and trustless execution. The core logic is split between a central factory and individual market contracts.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {[
                        {
                          name: "BetFactory.sol",
                          purpose: "The central hub for creating and managing all prediction markets.",
                          features: ["Creates new Bet contracts", "Manages internal USDC/PROOF wallets", "Sets platform-wide fees", "Maintains market registry"]
                        },
                        {
                          name: "Bet.sol", 
                          purpose: "An individual, self-contained contract for a single market.",
                          features: ["Handles all betting logic", "Manages proof submission", "Counts votes & determines outcome", "Processes claims & refunds"]
                        },
                        {
                          name: "ProofToken.sol",
                          purpose: "The platform's utility and governance token.",
                          features: ["ERC-20 standard token", "Used for fees and voting stakes", "Future governance capabilities"]
                        }
                      ].map((contract) => (
                        <div key={contract.name} className="p-4 bg-gray-700 border border-gray-600 rounded-lg">
                          <h4 className="font-semibold text-white mb-2">{contract.name}</h4>
                          <p className="text-gray-300 text-sm mb-3">{contract.purpose}</p>
                          <div className="space-y-1">
                            {contract.features.map((feature) => (
                              <div key={feature} className="flex items-center gap-2">
                                <div className="w-1 h-1 bg-cyan-400 rounded-full"></div>
                                <span className="text-gray-400 text-xs">{feature}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <Card className="bg-gray-700 border-gray-600">
                      <CardHeader>
                        <CardTitle className="text-white text-lg">Key Concepts</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-semibold text-white mb-3">Internal Wallet System</h4>
                            <p className="text-gray-300 text-sm">
                              Users deposit/withdraw funds into the `BetFactory` contract. This allows for gas-less internal transfers for betting and voting, requiring only a single transaction signature instead of multiple on-chain token approvals.
                            </p>
                          </div>
                          <div>
                            <h4 className="font-semibold text-white mb-3">Keeper Functions</h4>
                            <p className="text-gray-300 text-sm">
                               Functions like `checkAndCloseBetting` and `checkAndResolve` are public and can be called by anyone (a "keeper"). This allows for decentralized, automated maintenance of market statuses once deadlines have passed.
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </CardContent>
                </Card>
              </div>
            )}
            
            {/* Technical Specs */}
            {activeSection === "api" && (
              <div className="space-y-8">
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-2xl text-white flex items-center gap-2">
                      <FileText className="w-6 h-6 text-blue-400" />
                      Technical Specifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <h3 className="font-semibold text-white text-lg">Blockchain Details</h3>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-300">Network:</span>
                            <span className="text-white font-medium">Ethereum Mainnet</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-300">Solidity Version:</span>
                            <span className="text-white font-medium">^0.8.19</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-300">Token Standards:</span>
                            <span className="text-white font-medium">ERC-20</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-300">Security Audits:</span>
                            <span className="text-white font-medium">Planned</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <h3 className="font-semibold text-white text-lg">Token Addresses</h3>
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-300">USDC:</span>
                            <code className="text-cyan-400 font-mono">0xA0b8...6eB48</code>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-300">PROOF:</span>
                            <code className="text-purple-400 font-mono">TBD</code>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-300">BetFactory:</span>
                            <code className="text-green-400 font-mono">TBD</code>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-300">TrustScore:</span>
                            <code className="text-orange-400 font-mono">TBD</code>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Card className="bg-gray-700 border-gray-600">
                      <CardHeader>
                        <CardTitle className="text-white text-lg">Frontend Integration</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-semibold text-white mb-3">Required Libraries</h4>
                            <ul className="space-y-2 text-gray-300 text-sm font-mono">
                              <li>• ethers.js or web3.js</li>
                              <li>• @wagmi/core</li>
                              <li>• viem</li>
                              <li>• @rainbow-me/rainbowkit</li>
                            </ul>
                          </div>
                          <div>
                            <h4 className="font-semibold text-white mb-3">Key Functions</h4>
                            <ul className="space-y-2 text-gray-300 text-sm font-mono">
                              <li>• createBet(...)</li>
                              <li>• placeBet(betId, side, amount)</li>
                              <li>• submitProof(betId, proofUrl)</li>
                              <li>• vote(betId, vote)</li>
                            </ul>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Roadmap */}
            {activeSection === "roadmap" && (
              <div className="space-y-8">
                <Card className="bg-gray-800 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-2xl text-white flex items-center gap-2">
                      <TrendingUp className="w-6 h-6 text-green-400" />
                      Development Roadmap
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-8">
                    {[
                      {
                        phase: "Phase 1: Core Platform Launch",
                        status: "Completed",
                        color: "green",
                        timeline: "Q3 2025",
                        features: [
                          "Dual-token system (USDC & PROOF)",
                          "Core bet creation, betting, and voting logic",
                          "Internal wallet system for gasless actions",
                          "Smart contract architecture on local testnet",
                          "Web3 wallet connectivity and basic UI"
                        ]
                      },
                      {
                        phase: "Phase 2: UX & Feature Polish", 
                        status: "In Progress",
                        color: "blue",
                        timeline: "Q4 2025",
                        features: [
                          "Advanced market filtering and search capabilities",
                          "Mobile-first responsive design improvements",
                          "Social features (e.g., user aliases) and enhanced profiles",
                          "Real-time UI updates for market status changes",
                          "Comprehensive documentation portal"
                        ]
                      },
                      {
                        phase: "Phase 3: DeFi & Scalability",
                        status: "Planned",
                        color: "purple", 
                        timeline: "Q1-Q2 2026",
                        features: [
                          "PROOF token staking to earn yield from platform revenue",
                          "Lending protocol integration to enable betting without selling assets",
                          "Personalized analytics and statistics dashboard",
                          "Live streaming integration for real-time proof",
                          "Cross-chain support (e.g., Polygon, Arbitrum) for lower gas fees"
                        ]
                      },
                      {
                        phase: "Phase 4: Decentralized Governance",
                        status: "Vision",
                        color: "orange",
                        timeline: "Q3 2026 and beyond",
                        features: [
                          "DAO formation for community governance",
                          "On-chain voting with PROOF tokens for platform proposals",
                          "Community-managed treasury",
                          "Public API for third-party developers",
                          "Expansion into enterprise prediction solutions"
                        ]
                      }
                    ].map((phase) => (
                      <div key={phase.phase} className="relative">
                        <div className={`flex items-start gap-6 p-6 bg-${phase.color}-500/10 border border-${phase.color}-500/20 rounded-lg`}>
                          <div className={`w-12 h-12 bg-${phase.color}-500 rounded-full flex items-center justify-center flex-shrink-0`}>
                            <TrendingUp className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="font-semibold text-white text-lg">{phase.phase}</h3>
                              <div className="flex items-center gap-3">
                                <Badge className={`bg-${phase.color}-500/20 text-${phase.color}-300`}>
                                  {phase.status}
                                </Badge>
                                <span className="text-gray-400 text-sm">{phase.timeline}</span>
                              </div>
                            </div>
                            <ul className="space-y-2">
                              {phase.features.map((feature) => (
                                <li key={feature} className="flex items-start gap-2">
                                  <ArrowRight className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                  <span className="text-gray-300 text-sm">{feature}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
