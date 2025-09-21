import React, { useState, useEffect } from "react";
import { UserProfile } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { User, Save, X, AlertCircle, CheckCircle } from "lucide-react";

export default function AliasManager({ walletAddress, userProfile, onProfileUpdate }) {
  const [alias, setAlias] = useState("");
  const [originalAlias, setOriginalAlias] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (userProfile?.alias) {
      setAlias(userProfile.alias);
      setOriginalAlias(userProfile.alias);
    }
  }, [userProfile]);

  const validateAlias = (aliasInput) => {
    if (!aliasInput) return null; // Empty is allowed (clears alias)
    
    if (aliasInput.length < 2) return "Alias must be at least 2 characters long";
    if (aliasInput.length > 30) return "Alias cannot exceed 30 characters";
    if (!/^[a-zA-Z0-9_\-\.]+$/.test(aliasInput)) {
      return "Alias can only contain letters, numbers, underscores, hyphens, and dots";
    }
    if (aliasInput.startsWith('.') || aliasInput.endsWith('.')) {
      return "Alias cannot start or end with a dot";
    }
    
    return null;
  };

  const checkAliasAvailability = async (aliasToCheck) => {
    if (!aliasToCheck || aliasToCheck === originalAlias) return true;
    
    try {
      const existingProfiles = await UserProfile.filter({ alias: aliasToCheck });
      return existingProfiles.length === 0;
    } catch (error) {
      console.error("Error checking alias availability:", error);
      return false;
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setError("");
    setSuccess("");

    // Validate format
    const validationError = validateAlias(alias);
    if (validationError) {
      setError(validationError);
      setLoading(false);
      return;
    }

    // Check availability
    const isAvailable = await checkAliasAvailability(alias);
    if (!isAvailable) {
      setError("This alias is already taken by another user");
      setLoading(false);
      return;
    }

    try {
      // Update profile
      const updatedProfile = await UserProfile.update(userProfile.id, {
        alias: alias.trim() || null // Store null if empty
      });
      
      setOriginalAlias(alias);
      setIsEditing(false);
      setSuccess(alias ? "Alias saved successfully!" : "Alias removed successfully!");
      
      // Notify parent component
      if (onProfileUpdate) {
        onProfileUpdate({ ...userProfile, alias: alias.trim() || null });
      }
    } catch (error) {
      console.error("Error saving alias:", error);
      setError("Failed to save alias. Please try again.");
    }
    
    setLoading(false);
    setTimeout(() => setSuccess(""), 3000);
  };

  const handleCancel = () => {
    setAlias(originalAlias);
    setIsEditing(false);
    setError("");
    setSuccess("");
  };

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <User className="w-5 h-5 text-cyan-400" />
          Display Name
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive" className="bg-red-900/20 border-red-500/50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-200">{error}</AlertDescription>
          </Alert>
        )}
        
        {success && (
          <Alert className="bg-green-900/20 border-green-500/50">
            <CheckCircle className="h-4 w-4 text-green-400" />
            <AlertDescription className="text-green-200">{success}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          {!isEditing ? (
            <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
              <div>
                <Label className="text-gray-300 text-sm">Current Display Name:</Label>
                <p className="text-white font-medium">
                  {originalAlias || <span className="text-gray-400 italic">No alias set</span>}
                </p>
                <p className="text-gray-400 text-xs mt-1">
                  {originalAlias ? "People will see this name instead of your wallet address" : "Using wallet address as display name"}
                </p>
              </div>
              <Button 
                onClick={() => setIsEditing(true)}
                variant="outline"
                className="border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10"
              >
                {originalAlias ? "Change" : "Set Alias"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label htmlFor="alias" className="text-gray-300">Display Name</Label>
                <Input
                  id="alias"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder="Enter your display name (optional)"
                  className="bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                  maxLength={30}
                />
                <p className="text-gray-400 text-xs mt-1">
                  Leave empty to use your wallet address. Only letters, numbers, underscores, hyphens, and dots allowed.
                </p>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleSave}
                  disabled={loading}
                  className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-700"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <h4 className="font-medium text-blue-200 text-sm mb-1">How Aliases Work</h4>
          <ul className="text-blue-300 text-xs space-y-1">
            <li>• Your alias appears on bets, votes, and leaderboards</li>
            <li>• Others can still see your wallet address by hovering over your name</li>
            <li>• Aliases must be unique across the platform</li>
            <li>• You can change or remove your alias at any time</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}