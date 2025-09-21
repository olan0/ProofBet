
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
  ExternalLink,
  Copy,
  ArrowRight,
  CheckCircle
} from "lucide-react";

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
                      Dual-Token System
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* USDC */}
                      <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                            <DollarSign className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="font-bold text-white text-lg">USDC (USD Coin)</h3>
                            <p className="text-green-300 text-sm">Betting Currency</p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300 text-sm">Purpose:</span>
                            <span className="text-white font-medium">Betting stakes</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300 text-sm">Stability:</span>
                            <span className="text-white font-medium">Pegged to USD</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300 text-sm">Usage:</span>
                            <span className="text-white font-medium">Bet stakes & winnings</span>
                          </div>
                        </div>
                      </div>

                      {/* PROOF */}
                      <div className="p-6 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                            <Shield className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="font-bold text-white text-lg">PROOF Token</h3>
                            <p className="text-purple-300 text-sm">Platform Currency</p>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300 text-sm">Purpose:</span>
                            <span className="text-white font-medium">Platform fees</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300 text-sm">Supply:</span>
                            <span className="text-white font-medium">1B max supply</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-300 text-sm">Usage:</span>
                            <span className="text-white font-medium">Create bets & vote</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Card className="bg-gray-700 border-gray-600">
                      <CardHeader>
                        <CardTitle className="text-white text-lg">PROOF Token Mechanics</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="text-center p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-3">
                              <Zap className="w-6 h-6 text-white" />
                            </div>
                            <h4 className="font-semibold text-white mb-2">Fee Burning</h4>
                            <p className="text-gray-300 text-sm mb-2">50% of platform fees are permanently burned</p>
                            <Badge className="bg-red-500/20 text-red-300">Deflationary</Badge>
                          </div>
                          
                          <div className="text-center p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                              <TrendingUp className="w-6 h-6 text-white" />
                            </div>
                            <h4 className="font-semibold text-white mb-2">Annual Inflation</h4>
                            <p className="text-gray-300 text-sm mb-2">5% yearly mint for development & rewards</p>
                            <Badge className="bg-green-500/20 text-green-300">Growth Fund</Badge>
                          </div>
                          
                          <div className="text-center p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
                              <Trophy className="w-6 h-6 text-white" />
                            </div>
                            <h4 className="font-semibold text-white mb-2">Staking Rewards</h4>
                            <p className="text-gray-300 text-sm mb-2">Earn PROOF by participating in the ecosystem</p>
                            <Badge className="bg-blue-500/20 text-blue-300">Earn & Hold</Badge>
                          </div>
                        </div>

                        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                          <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
                            <Vote className="w-4 h-4 text-yellow-400" />
                            Token Distribution
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-300">Initial Supply:</span>
                              <div className="font-semibold text-white">100M PROOF</div>
                            </div>
                            <div>
                              <span className="text-gray-300">Annual Inflation:</span>
                              <div className="font-semibold text-white">5% per year</div>
                            </div>
                            <div>
                              <span className="text-gray-300">Fee Burn Rate:</span>
                              <div className="font-semibold text-white">50% of fees</div>
                            </div>
                            <div>
                              <span className="text-gray-300">Max Supply:</span>
                              <div className="font-semibold text-white">1B PROOF</div>
                            </div>
                          </div>
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
                          Connect your Web3 wallet (MetaMask, WalletConnect) to start interacting with the platform.
                        </p>
                      </div>
                      <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                          <span className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-sm">2</span>
                          Get Tokens
                        </h3>
                        <p className="text-gray-300 text-sm">
                          Acquire USDC for betting and PROOF tokens for platform fees through the deposit system.
                        </p>
                      </div>
                      <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                          <span className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-sm">3</span>
                          Start Participating
                        </h3>
                        <p className="text-gray-300 text-sm">
                          Browse markets, place bets, or create your own prediction markets for others to participate in.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Tabs defaultValue="betting" className="space-y-6">
                  <TabsList className="bg-gray-800 border border-gray-700 grid w-full grid-cols-4">
                    <TabsTrigger value="betting">Betting</TabsTrigger>
                    <TabsTrigger value="creating">Creating Bets</TabsTrigger>
                    <TabsTrigger value="voting">Voting</TabsTrigger>
                    <TabsTrigger value="wallet">Wallet Management</TabsTrigger>
                  </TabsList>

                  <TabsContent value="betting">
                    <Card className="bg-gray-800 border-gray-700">
                      <CardHeader>
                        <CardTitle className="text-white">How to Place Bets</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {[
                          "Browse the Markets tab to find active prediction markets",
                          "Check the bet details, deadlines, and minimum trust score requirements",
                          "Ensure you have sufficient USDC balance for betting",
                          "Click 'Place Bet' and choose YES or NO side",
                          "Enter your stake amount (minimum varies per bet)",
                          "Confirm the transaction in your wallet",
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
                            <li>• Creation fee: 100 PROOF tokens</li>
                            <li>• Maximum 3 active bets per user</li>
                            <li>• Must provide clear, verifiable claim</li>
                            <li>• Set appropriate deadlines and minimums</li>
                          </ul>
                        </div>
                        
                        <div className="space-y-4">
                          {[
                            "Navigate to 'Create Bet' (requires wallet connection)",
                            "Fill in bet title and detailed description",
                            "Set category and proof type (video, photo, stream)",
                            "Configure minimum bet amounts and trust score requirements", 
                            "Set betting, proof, and voting deadlines",
                            "Pay 100 PROOF token creation fee",
                            "Your bet goes live immediately for others to participate"
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
                            <li>• Cannot have bet on the market you're voting on</li>
                            <li>• Must stake 10 PROOF tokens per vote</li>
                            <li>• Meet minimum trust score (varies per bet)</li>
                            <li>• Vote based on provided proof evidence</li>
                          </ul>
                        </div>

                        <div className="space-y-4">
                          {[
                            "Find bets in 'Voting Phase' status",
                            "Review the submitted proof carefully", 
                            "Ensure you haven't bet on this market",
                            "Stake 10 PROOF tokens to cast your vote",
                            "Vote YES if proof validates the claim, NO if it doesn't",
                            "Earn rewards if you vote with the majority",
                            "Forfeit stake if you vote dishonestly (minority)"
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

                  <TabsContent value="wallet">
                    <Card className="bg-gray-800 border-gray-700">
                      <CardHeader>
                        <CardTitle className="text-white">Managing Your Funds</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                            <h4 className="font-semibold text-white mb-3">USDC Balance</h4>
                            <ul className="space-y-2 text-gray-300 text-sm">
                              <li>• Used for all betting activities</li>
                              <li>• Deposit via crypto exchanges</li>
                              <li>• Withdraw winnings anytime</li>
                              <li>• Stable 1:1 USD value</li>
                            </ul>
                          </div>
                          <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                            <h4 className="font-semibold text-white mb-3">PROOF Balance</h4>
                            <ul className="space-y-2 text-gray-300 text-sm">
                              <li>• Required for bet creation (100 tokens)</li>
                              <li>• Needed for voting (10 tokens per vote)</li>
                              <li>• Earn through platform participation</li>
                              <li>• 50% of fees burned, increasing value</li>
                            </ul>
                          </div>
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
                      ProofBet runs on Ethereum smart contracts, ensuring transparency, security, and trustless execution of all platform operations.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {[
                        {
                          name: "BetFactory.sol",
                          purpose: "Creates and manages all prediction markets",
                          features: ["Bet creation", "Fee handling", "Market registry"]
                        },
                        {
                          name: "Bet.sol", 
                          purpose: "Individual market contract with full lifecycle",
                          features: ["Betting logic", "Proof submission", "Vote counting", "Payouts"]
                        },
                        {
                          name: "ProofToken.sol",
                          purpose: "Platform token with tokenomics",
                          features: ["Fee burning", "Inflation minting", "Staking rewards"]
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
                        <CardTitle className="text-white text-lg">Key Features</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h4 className="font-semibold text-white mb-3">Security Features</h4>
                            <ul className="space-y-2 text-gray-300 text-sm">
                              <li>• Reentrancy protection on all functions</li>
                              <li>• Multi-signature admin controls</li>
                              <li>• Automated deadline enforcement</li>
                              <li>• Emergency pause mechanisms</li>
                              <li>• Comprehensive event logging</li>
                            </ul>
                          </div>
                          <div>
                            <h4 className="font-semibold text-white mb-3">Gas Optimizations</h4>
                            <ul className="space-y-2 text-gray-300 text-sm">
                              <li>• Efficient storage patterns</li>
                              <li>• Batch operations support</li>
                              <li>• Minimal external calls</li>
                              <li>• Optimized loops and mappings</li>
                              <li>• Event-based data retrieval</li>
                            </ul>
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
                        timeline: "Q2 2024",
                        features: [
                          "Dual-token system (USDC & PROOF)",
                          "Core bet creation, betting, and voting logic",
                          "Smart contract architecture defined",
                          "Trust score system V1 implementation",
                          "Web3 wallet connectivity"
                        ]
                      },
                      {
                        phase: "Phase 2: Feature Expansion", 
                        status: "In Progress",
                        color: "blue",
                        timeline: "Q3 2024",
                        features: [
                          "Live streaming integration for real-time proof",
                          "Advanced market filtering and search",
                          "Social features and enhanced user profiles",
                          "Personalized analytics and statistics dashboard",
                          "Mobile-first responsive design improvements"
                        ]
                      },
                      {
                        phase: "Phase 3: DeFi & Scalability",
                        status: "Planned",
                        color: "purple", 
                        timeline: "Q4 2024",
                        features: [
                          "PROOF token staking with yield rewards",
                          "Liquidity mining programs",
                          "Cross-chain support (e.g., Polygon, Arbitrum)",
                          "Integration with major DeFi protocols",
                          "Automated Market Makers (AMMs) for improved odds",
                          "Ethereum Name Service (ENS) integration for decentralized usernames"
                        ]
                      },
                      {
                        phase: "Phase 4: Decentralized Governance",
                        status: "Vision",
                        color: "orange",
                        timeline: "Q1 2025",
                        features: [
                          "DAO formation for community governance",
                          "On-chain voting with PROOF tokens",
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
