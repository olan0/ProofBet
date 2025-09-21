
import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TokenBurn } from "@/api/entities";
import { InflationMint } from "@/api/entities";
import { Flame, TrendingUp, Calendar, Coins, DollarSign, Target } from "lucide-react";
import { format } from "date-fns";

export default function TokenomicsPanel({ settings, onSettingsChange }) {
  const [burns, setBurns] = useState([]);
  const [mints, setMints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTokenomicsData();
  }, []);

  const loadTokenomicsData = async () => {
    setLoading(true);
    try {
      const [burnData, mintData] = await Promise.all([
        TokenBurn.list("-created_date", 50),
        InflationMint.list("-created_date", 20)
      ]);
      setBurns(burnData);
      setMints(mintData);
    } catch (error) {
      console.error("Error loading tokenomics data:", error);
    }
    setLoading(false);
  };

  const totalBurned = burns.reduce((sum, burn) => sum + (burn.burned_amount || 0), 0);
  const totalMinted = mints.reduce((sum, mint) => sum + (mint.minted_amount || 0), 0);
  const netSupplyChange = totalMinted - totalBurned;

  const simulateInflation = () => {
    const currentSupply = 100000000; // Assume 100M initial supply
    const inflationRate = settings?.annual_inflation_rate || 5;
    const annualInflation = (currentSupply * inflationRate) / 100;
    return annualInflation;
  };

  const annualBurnEstimate = () => {
    // Calculate average burn from available data (up to last 12 entries for a yearly estimate)
    // For a more accurate estimation, we'd need actual date ranges or a consistent period.
    const avgMonthlyBurns = burns.length > 0 ? totalBurned / Math.min(burns.length, 12) : 0;
    return avgMonthlyBurns * 12; // Project to annual burn
  };

  return (
    <div className="space-y-6">
      {/* Tokenomics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-red-500/10 border-red-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-300 flex items-center gap-2">
              <Flame className="w-4 h-4" />
              Total Burned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-400">{totalBurned.toLocaleString()}</div>
            <p className="text-xs text-red-300/80 mt-1">PROOF tokens removed forever</p>
          </CardContent>
        </Card>

        <Card className="bg-green-500/10 border-green-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-300 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Total Minted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400">{totalMinted.toLocaleString()}</div>
            <p className="text-xs text-green-300/80 mt-1">PROOF tokens from inflation</p>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/10 border-blue-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-blue-300 flex items-center gap-2">
              <Target className="w-4 h-4" />
              Net Supply Change
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${netSupplyChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {netSupplyChange >= 0 ? '+' : ''}{netSupplyChange.toLocaleString()}
            </div>
            <p className="text-xs text-blue-300/80 mt-1">Inflation - Burns</p>
          </CardContent>
        </Card>

        <Card className="bg-purple-500/10 border-purple-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-purple-300 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Annual Projection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-purple-400">
              +{simulateInflation().toLocaleString()}
            </div>
            <div className="text-lg font-bold text-red-400 mt-1">
              -{annualBurnEstimate().toLocaleString()}
            </div>
            <p className="text-xs text-purple-300/80 mt-1">Estimated mint vs burn</p>
          </CardContent>
        </Card>
      </div>

      {/* Configuration Panel */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Coins className="w-5 h-5 text-yellow-500" />
            Platform Limits & Fees Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Betting Limits */}
            <div className="space-y-2">
              <Label htmlFor="min_bet_usd" className="text-gray-300">Minimum Bet Amount (USDC)</Label>
              <Input
                id="min_bet_usd"
                type="number"
                step="0.01"
                min="0"
                value={settings?.min_bet_amount_usd || 1}
                onChange={(e) => onSettingsChange('min_bet_amount_usd', parseFloat(e.target.value))}
                className="bg-gray-700 border-gray-600 text-white"
              />
              <p className="text-sm text-gray-400">
                Minimum USDC amount users can bet on any market
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_bet_usd" className="text-gray-300">Maximum Bet Amount (USDC)</Label>
              <Input
                id="max_bet_usd"
                type="number"
                step="0.01"
                min="0"
                value={settings?.max_bet_amount_usd || 10000}
                onChange={(e) => onSettingsChange('max_bet_amount_usd', parseFloat(e.target.value))}
                className="bg-gray-700 border-gray-600 text-white"
              />
              <p className="text-sm text-gray-400">
                Maximum USDC amount users can bet on any market
              </p>
            </div>

            {/* Voting Stakes */}
            <div className="space-y-2">
              <Label htmlFor="vote_stake_proof" className="text-gray-300">Global Vote Stake (PROOF)</Label>
              <Input
                id="vote_stake_proof"
                type="number"
                step="1"
                min="0"
                value={settings?.vote_stake_amount_proof || 10}
                onChange={(e) => onSettingsChange('vote_stake_amount_proof', parseFloat(e.target.value))}
                className="bg-gray-700 border-gray-600 text-white"
              />
              <p className="text-sm text-gray-400">
                PROOF tokens required to cast any vote on the platform.
              </p>
            </div>

            {/* Creation Fee */}
            <div className="space-y-2">
              <Label htmlFor="bet_creation_fee_proof" className="text-gray-300">Bet Creation Fee (PROOF)</Label>
              <Input
                  id="bet_creation_fee_proof"
                  type="number"
                  min="0"
                  value={settings?.bet_creation_fee_proof || ''}
                  onChange={(e) => onSettingsChange('bet_creation_fee_proof', e.target.value)}
                  className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
              />
              <p className="text-sm text-gray-400">
                  The fee in PROOF tokens for creating a new prediction market.
              </p>
            </div>


            {/* Tokenomics */}
            <div className="space-y-2">
              <Label htmlFor="inflation_rate" className="text-gray-300">Annual Inflation Rate (%)</Label>
              <Input
                id="inflation_rate"
                type="number"
                step="0.1"
                min="0"
                max="20"
                value={settings?.annual_inflation_rate || 5}
                onChange={(e) => onSettingsChange('annual_inflation_rate', parseFloat(e.target.value))}
                className="bg-gray-700 border-gray-600 text-white"
              />
              <p className="text-sm text-gray-400">
                Percentage of total PROOF supply minted annually
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="burn_rate" className="text-gray-300">Fee Burn Percentage (%)</Label>
              <Input
                id="burn_rate"
                type="number"
                step="1"
                min="0"
                max="100"
                value={settings?.fee_burn_percentage || 50}
                onChange={(e) => onSettingsChange('fee_burn_percentage', parseFloat(e.target.value))}
                className="bg-gray-700 border-gray-600 text-white"
              />
              <p className="text-sm text-gray-400">
                Percentage of PROOF fees burned vs kept by platform
              </p>
            </div>
          </div>

          <Alert className="bg-yellow-500/10 border-yellow-500/20">
            <Target className="h-4 w-4 text-yellow-400" />
            <AlertDescription className="text-yellow-200">
              <strong>Tokenomics Balance:</strong> {settings?.annual_inflation_rate || 5}% inflation vs ~{settings?.fee_burn_percentage || 50}% of fees burned.
              {netSupplyChange >= 0 ? ' Currently inflationary.' : ' Currently deflationary.'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Tabs defaultValue="burns" className="space-y-6">
        <TabsList className="bg-gray-800 border border-gray-700">
          <TabsTrigger value="burns">Token Burns ({burns.length})</TabsTrigger>
          <TabsTrigger value="mints">Inflation Mints ({mints.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="burns">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Flame className="w-5 h-5 text-red-400" />
                Recent Token Burns
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-gray-400">Loading burn history...</div>
              ) : burns.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {burns.map((burn, index) => (
                    <div key={burn.id || index} className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className="bg-red-500/20 text-red-300 capitalize">
                            {burn.transaction_type.replace('_', ' ')}
                          </Badge>
                          <span className="text-red-400 font-semibold">
                            -{burn.burned_amount.toLocaleString()} PROOF
                          </span>
                        </div>
                        <div className="text-xs text-gray-400">
                          {burn.burn_percentage}% of {burn.original_fee_amount} PROOF fee burned
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-300">
                          {format(new Date(burn.created_date), 'MMM d, yyyy')}
                        </div>
                        <div className="text-xs text-gray-400">
                          Platform kept: {burn.remaining_amount} PROOF
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">No burns recorded yet</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mints">
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                Inflation Minting History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-gray-400">Loading mint history...</div>
              ) : mints.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {mints.map((mint, index) => (
                    <div key={mint.id || index} className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className="bg-green-500/20 text-green-300">
                            Year {mint.mint_year}
                          </Badge>
                          <span className="text-green-400 font-semibold">
                            +{mint.minted_amount.toLocaleString()} PROOF
                          </span>
                        </div>
                        <div className="text-xs text-gray-400">
                          {mint.inflation_rate}% inflation • Supply: {mint.total_supply_before.toLocaleString()} → {mint.total_supply_after.toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-300">
                          {format(new Date(mint.created_date), 'MMM d, yyyy')}
                        </div>
                        <div className="text-xs text-gray-400 font-mono">
                          To: {mint.recipient_address.substring(0, 8)}...
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">No inflation mints yet</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
