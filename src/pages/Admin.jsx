
import React, { useState, useEffect } from "react";
import { AppSettings } from "@/api/entities";
import { User } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Save, Shield, Lock, Settings } from "lucide-react"; 
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import TokenomicsPanel from "../components/admin/TokenomicsPanel";

export default function AdminPage() {
    const navigate = useNavigate();
    const [settings, setSettings] = useState(null);
    const [initialSettings, setInitialSettings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [isAuthorized, setIsAuthorized] = useState(false);

    useEffect(() => {
        const checkAuthAndLoadSettings = async () => {
            try {
                const currentUser = await User.me();
                if (currentUser && currentUser.role === 'admin') {
                    setIsAuthorized(true);
                    const settingsData = await AppSettings.list();
                    if (settingsData.length > 0) {
                        setSettings(settingsData[0]);
                        setInitialSettings(settingsData[0]);
                    } else {
                        // Create initial settings if they don't exist
                        const newSettings = await AppSettings.create({ 
                            max_active_bets_per_user: 3,
                            bet_creation_fee_proof: 10,
                            voter_reward_percentage: 5,
                            platform_fee_percentage: 3,
                            // Centralized voter stake amount
                            vote_stake_amount_proof: 100, // Default value for consolidated voter stake
                            // Removed: min_stake_to_vote_proof and max_stake_per_vote_proof as they are consolidated
                            min_bet_amount_usd: 1,
                            max_bet_amount_usd: 1000,
                            token_name: "TBD Coin",
                            token_symbol: "TBDC",
                            total_supply: 1000000000,
                            initial_distribution_admin_wallet_percentage: 10,
                            initial_distribution_liquidity_pool_percentage: 5,
                            initial_distribution_community_rewards_percentage: 5,
                            staking_reward_rate_percentage: 10,
                            unstaking_fee_percentage: 2,
                            // ENS Integration fields removed
                        });
                        setSettings(newSettings);
                        setInitialSettings(newSettings);
                    }
                } else {
                    setIsAuthorized(false);
                }
            } catch (e) {
                setIsAuthorized(false);
                console.error("Authorization check failed:", e);
            }
            setLoading(false);
        };

        checkAuthAndLoadSettings();
    }, []);

    const handleInputChange = (field, value) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        if (!settings) return;
        setSaving(true);
        setError("");
        setSuccess("");
        try {
            // Create a mutable copy of settings to avoid read-only errors
            let updatedSettings = { ...settings };
            
            // Go through all known float keys and parse them
            const floatKeys = [
                'bet_creation_fee_proof',
                'voter_reward_percentage',
                'platform_fee_percentage',
                'min_bet_amount_usd',
                'max_bet_amount_usd',
                'vote_stake_amount_proof', // Consolidated voter stake
                'initial_distribution_admin_wallet_percentage',
                'initial_distribution_liquidity_pool_percentage',
                'initial_distribution_community_rewards_percentage',
                'staking_reward_rate_percentage',
                'unstaking_fee_percentage',
                // Removed ENS fields
            ];

            // Go through all known integer keys and parse them
            const intKeys = [
                'max_active_bets_per_user',
                'total_supply',
                // Removed ENS fields
            ];

            floatKeys.forEach(key => {
                if (updatedSettings[key] !== undefined && updatedSettings[key] !== null && updatedSettings[key] !== '') {
                    updatedSettings[key] = parseFloat(updatedSettings[key]);
                }
            });

            intKeys.forEach(key => {
                if (updatedSettings[key] !== undefined && updatedSettings[key] !== null && updatedSettings[key] !== '') {
                    updatedSettings[key] = parseInt(updatedSettings[key]);
                }
            });

            // Ensure old fields (now consolidated) are not sent to the backend
            delete updatedSettings.min_stake_to_vote_proof;
            delete updatedSettings.max_stake_per_vote_proof;

            // Remove id from the payload before sending, as it's not part of the schema
            const idToUpdate = updatedSettings.id;
            delete updatedSettings.id;
            delete updatedSettings.created_date;
            delete updatedSettings.updated_date;
            delete updatedSettings.created_by;

            await AppSettings.update(idToUpdate, updatedSettings);
            
            // Reload settings to get the fresh copy from the DB
            const reloadedSettings = await AppSettings.get(idToUpdate);
            setSettings(reloadedSettings);
            setInitialSettings(reloadedSettings);

            setSuccess("Settings saved successfully!");
            setTimeout(() => setSuccess(""), 3000);

        } catch (err) {
            setError("Failed to save settings. Please try again.");
            console.error(err);
        }
        setSaving(false);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 p-6 flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-cyan-500"></div>
            </div>
        );
    }

    if (!isAuthorized) {
        return (
            <div className="min-h-screen bg-gray-900 p-6 flex items-center justify-center">
                <Card className="bg-gray-800 border-red-500/30 w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-red-400">
                            <Lock className="w-5 h-5" />
                            Access Denied
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-gray-300">You do not have permission to view this page. This area is for administrators only.</p>
                        <Button onClick={() => navigate(createPageUrl("Dashboard"))} className="mt-6 w-full">
                            Go to Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 p-6">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="flex items-center gap-3">
                    <Shield className="w-8 h-8 text-cyan-400" />
                    <div>
                        <h1 className="text-3xl font-bold text-white">Admin Settings</h1>
                        <p className="text-gray-400">Manage global settings and restrictions for the platform.</p>
                    </div>
                </div>

                {error && (
                    <Alert variant="destructive" className="bg-red-900/20 border-red-500/50">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-red-200">{error}</AlertDescription>
                    </Alert>
                )}
                {success && (
                    <Alert className="bg-green-900/20 border-green-500/50">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-green-200">{success}</AlertDescription>
                    </Alert>
                )}

                <Tabs defaultValue="general" className="space-y-6 w-full"> 
                    <TabsList className="bg-gray-800 border border-gray-700 grid w-full grid-cols-2"> 
                        <TabsTrigger value="general" className="data-[state=active]:bg-cyan-600"><Settings className="w-4 h-4 mr-2" />General</TabsTrigger>
                        <TabsTrigger value="tokenomics" className="data-[state=active]:bg-cyan-600"><Shield className="w-4 h-4 mr-2" />Tokenomics</TabsTrigger>
                    </TabsList>
                    
                    <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                        <div className="mt-6">
                            <TabsContent value="general">
                                <Card className="bg-gray-800 border-gray-700">
                                    <CardHeader>
                                        <CardTitle className="text-white">Platform Settings</CardTitle>
                                        <CardDescription className="text-gray-400">Control the rules and fees for the platform.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        {settings && (
                                            <div className="space-y-6">
                                                <div className="space-y-2">
                                                    <Label htmlFor="max_active_bets" className="text-gray-300">Max Active Bets Per User</Label>
                                                    <Input
                                                        id="max_active_bets"
                                                        type="number"
                                                        min="1"
                                                        value={settings.max_active_bets_per_user}
                                                        onChange={(e) => handleInputChange('max_active_bets_per_user', e.target.value)}
                                                        className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 max-w-xs"
                                                    />
                                                    <p className="text-sm text-gray-400">
                                                        The maximum number of bets a user can have in an 'active' state.
                                                    </p>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label htmlFor="bet_creation_fee" className="text-gray-300">Bet Creation Fee (PROOF Tokens)</Label>
                                                    <Input
                                                        id="bet_creation_fee"
                                                        type="number"
                                                        step="1"
                                                        min="0"
                                                        value={settings.bet_creation_fee_proof || 0}
                                                        onChange={(e) => handleInputChange('bet_creation_fee_proof', e.target.value)}
                                                        className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 max-w-xs"
                                                    />
                                                    <p className="text-sm text-gray-400">
                                                        The fee paid in PROOF tokens to the platform by the creator for each new bet.
                                                    </p>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="voter_reward" className="text-gray-300">Voter Reward (%)</Label>
                                                        <Input
                                                            id="voter_reward"
                                                            type="number"
                                                            step="0.1"
                                                            min="0"
                                                            max="100"
                                                            value={settings.voter_reward_percentage}
                                                            onChange={(e) => handleInputChange('voter_reward_percentage', e.target.value)}
                                                            className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                                                        />
                                                        <p className="text-sm text-gray-400">
                                                            Percentage of total USDC winnings distributed to voters.
                                                        </p>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <Label htmlFor="platform_fee_pct" className="text-gray-300">Platform Fee (%)</Label>
                                                        <Input
                                                            id="platform_fee_pct"
                                                            type="number"
                                                            step="0.1"
                                                            min="0"
                                                            max="100"
                                                            value={settings.platform_fee_percentage}
                                                            onChange={(e) => handleInputChange('platform_fee_percentage', e.target.value)}
                                                            className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                                                        />
                                                        <p className="text-sm text-gray-400">
                                                            Percentage of total USDC winnings taken as platform fee.
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                                    <h4 className="font-semibold text-blue-200 mb-2">Revenue Distribution Preview</h4>
                                                    <div className="text-sm text-blue-300 space-y-1">
                                                        <p>• Voters: {parseFloat(settings.voter_reward_percentage) || 0}% of total USDC winnings</p>
                                                        <p>• Platform: {parseFloat(settings.platform_fee_percentage) || 0}% of total USDC winnings</p>
                                                        <p>• Winners: {(100 - (parseFloat(settings.voter_reward_percentage) || 0) - (parseFloat(settings.platform_fee_percentage) || 0))}% of total USDC winnings</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="tokenomics">
                                <TokenomicsPanel 
                                    settings={settings}
                                    onSettingsChange={handleInputChange}
                                />
                            </TabsContent>
                        </div>
                        <div className="flex justify-end mt-8">
                            <Button
                                type="submit" 
                                disabled={saving}
                                className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700 text-white font-semibold"
                            >
                                <Save className="w-4 h-4 mr-2" />
                                {saving ? 'Saving...' : 'Save Settings'}
                            </Button>
                        </div>
                    </form>
                </Tabs>
            </div>
        </div>
    );
}
