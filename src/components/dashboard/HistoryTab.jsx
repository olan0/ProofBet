
import React, { useState, useEffect } from 'react';
import { Loader2, Book, FolderOpen } from 'lucide-react';
import { getBetFactoryContract, getBetContract } from '../blockchain/contracts';
import { ethers } from 'ethers';
import BetRow from './BetRow';

export default function HistoryTab({ walletAddress }) {
  const [loading, setLoading] = useState(true);
  const [historicalBets, setHistoricalBets] = useState([]);

  useEffect(() => {
    if (!walletAddress) {
      setLoading(false);
      return;
    }

    const loadHistory = async () => {
      setLoading(true);
      try {
        const factory = getBetFactoryContract();
        const betAddresses = await factory.getBets();

        const betPromises = betAddresses.map(async (address) => {
          try {
            const betContract = getBetContract(address);
            
            const [
              betInfo,
              userParticipant,
            ] = await Promise.all([
              betContract.getBetInfo(),
              betContract.participants(walletAddress)
            ]);

            const [title, description, creator, status, totalYes, totalNo, creationTime] = betInfo;
            const { yesStake, noStake, hasWithdrawn } = userParticipant;
            
            const isResolvedOrCancelled = Number(status) === 2 || Number(status) === 3;

            // Calculate total user stake and determine position
            const userYesStake = parseFloat(ethers.formatUnits(yesStake, 6));
            const userNoStake = parseFloat(ethers.formatUnits(noStake, 6));
            const totalUserStake = userYesStake + userNoStake;
            
            let userPosition = null;
            if (userYesStake > 0) userPosition = 'yes';
            else if (userNoStake > 0) userPosition = 'no';

            // Only include resolved/cancelled bets relevant to this user
            if (isResolvedOrCancelled && (creator.toLowerCase() === walletAddress.toLowerCase() || totalUserStake > 0)) {
               return {
                address: address,
                title: title,
                creator: creator,
                status: Number(status),
                totalYesStake: parseFloat(ethers.formatUnits(totalYes, 6)),
                totalNoStake: parseFloat(ethers.formatUnits(totalNo, 6)),
                creationTimestamp: Number(creationTime),
                userStake: totalUserStake,
                userPosition: userPosition,
              };
            }
            return null;
          } catch (e) {
            console.error(`Failed to fetch history for bet at ${address}:`, e);
            return null;
          }
        });

        const allHistoricalBets = (await Promise.all(betPromises)).filter(b => b !== null).reverse();
        setHistoricalBets(allHistoricalBets);

      } catch (error) {
        console.error("Could not load user's bet history:", error);
      }
      setLoading(false);
    };

    loadHistory();
  }, [walletAddress]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
       <div className="flex items-center gap-3 p-4 bg-gray-800 rounded-lg border border-gray-700">
         <Book className="w-6 h-6 text-cyan-400" />
         <div>
            <h3 className="text-xl font-semibold text-white">Betting History</h3>
            <p className="text-gray-400">A record of your resolved and cancelled bets.</p>
         </div>
       </div>

      {historicalBets.length > 0 ? (
        <div className="space-y-3">
          {historicalBets.map(bet => (
            <BetRow key={bet.address} bet={bet} walletAddress={walletAddress} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-gray-800/50 rounded-lg">
          <FolderOpen className="w-16 h-16 text-gray-600 mx-auto mb-6" />
          <h3 className="text-xl font-semibold text-gray-300 mb-2">No History Yet</h3>
          <p className="text-gray-400">Your past activity will appear here once your bets are resolved.</p>
        </div>
      )}
    </div>
  );
}
