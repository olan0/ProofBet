import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile } from '@/api/entities';
import { Copy, Check, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function AddressDisplay({ address, showAlias = true, maxAliasLength = 20 }) {
  const [isCopied, setIsCopied] = useState(false);
  const [alias, setAlias] = useState(null);
  const [loading, setLoading] = useState(showAlias);

  const loadAlias = useCallback(async () => {
    if (!showAlias || !address) return;
    
    try {
      const profiles = await UserProfile.filter({ wallet_address: address });
      if (profiles.length > 0 && profiles[0].alias) {
        setAlias(profiles[0].alias);
      }
    } catch (error) {
      console.error("Error loading alias:", error);
    } finally {
      setLoading(false);
    }
  }, [address, showAlias]);

  useEffect(() => {
    loadAlias();
  }, [loadAlias]);

  if (!address) {
    return null;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const truncatedAddress = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  const displayName = alias && showAlias ? 
    (alias.length > maxAliasLength ? `${alias.substring(0, maxAliasLength)}...` : alias) : 
    truncatedAddress;

  const tooltipContent = alias && showAlias ? 
    `${alias} (${address})` : 
    address;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 font-mono text-sm text-gray-300">
            {alias && showAlias && (
              <User className="w-3 h-3 text-cyan-400" />
            )}
            <span className={alias && showAlias ? "font-normal" : ""}>{displayName}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-gray-400 hover:text-white"
              onClick={handleCopy}
            >
              {isCopied ? (
                <Check className="h-4 w-4 text-green-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </TooltipTrigger>
        <TooltipContent className="bg-gray-700 border-gray-600 text-white max-w-xs">
          <p>{isCopied ? 'Copied to clipboard!' : tooltipContent}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}