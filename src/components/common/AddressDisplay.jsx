import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function AddressDisplay({ address, maxLength = 10 }) {
  const [isCopied, setIsCopied] = useState(false);

  if (!address) {
    return null;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Always show truncated address format: 0x1234...5678
  const truncatedAddress = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2 font-mono text-sm text-gray-300">
            <span>{truncatedAddress}</span>
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
          <p>{isCopied ? 'Copied to clipboard!' : address}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}