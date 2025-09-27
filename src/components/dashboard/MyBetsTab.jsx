
import React, { useState, useEffect } from 'react';
import { Loader2, FolderOpen } from 'lucide-react';
import { getBetFactoryContract, getBetContract } from '../blockchain/contracts';
import { ethers } from 'ethers';
import BetRow from './BetRow';

const STATUS_MAP = ["Open", "Voting", "Resolved", "Cancelled"];

export default function MyBetsTab({ walletAddress }) {
  const [loading, setLoading] = useState(true);
  const [createdBets, setCreatedBets] = useState([]);
  const [participatedBets, setParticipatedBets] = useState([]);

  useEffect(() => {
    if (!walletAddress) {
      setLoading(false);
      return;
    }

    const loadMyBets = async () => {
      setLoading(true);
      try {
        const factory = getBetFactoryContract();
        const betAddresses = await factory.getBets();

        const betPromises = betAddresses.map(async (address) => {
          try {
            const betContract = getBetContract(address);
            
            // Fetch all data in parallel
            const [
              betInfo,
              userParticipant,
            ] = await Promise.all([
              betContract.getBetInfo(),
              betContract.participants(walletAddress)
            ]);

            const [title, description, creator, status, totalYes, totalNo, creationTime] = betInfo;
            const { yesStake, noStake, hasWithdrawn } = userParticipant;

            // Calculate total user stake and determine position
            const userYesStake = parseFloat(ethers.formatUnits(yesStake, 6));
            const userNoStake = parseFloat(ethers.formatUnits(noStake, 6));
            const totalUserStake = userYesStake + userNoStake;
            
            let userPosition = null;
            if (userYesStake > 0) userPosition = 'yes';
            else if (userNoStake > 0) userPosition = 'no';

            // Only include bets relevant to this user (creator or has stake)
            if (creator.toLowerCase() === walletAddress.toLowerCase() || totalUserStake > 0) {
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
            console.error(`Failed to fetch details for bet at ${address}:`, e);
            return null;
          }
        });

        const allUserBets = (await Promise.all(betPromises)).filter(b => b !== null).reverse();
        
        // Filter into created and participated bets
        setCreatedBets(allUserBets.filter(b => b.creator.toLowerCase() === walletAddress.toLowerCase()));
        setParticipatedBets(allUserBets.filter(b => b.creator.toLowerCase() !== walletAddress.toLowerCase()));

      } catch (error) {
        console.error("Could not load user's bets:", error);
      }
      setLoading(false);
    };

    loadMyBets();
  }, [walletAddress]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  const hasBets = createdBets.length > 0 || participatedBets.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-semibold text-white mb-4">Markets I Created</h3>
        {createdBets.length > 0 ? (
          <div className="space-y-3">
            {createdBets.map(bet => (
              <BetRow key={bet.address} bet={bet} walletAddress={walletAddress} />
            ))}
          </div>
        ) : (
          <p className="text-gray-400">You haven't created any markets yet.</p>
        )}
      </div>

      <div>
        <h3 className="text-xl font-semibold text-white mb-4">Markets I'm Betting On</h3>
        {participatedBets.length > 0 ? (
          <div className="space-y-3">
            {participatedBets.map(bet => (
              <BetRow key={bet.address} bet={bet} walletAddress={walletAddress} />
            ))}
          </div>
        ) : (
          <p className="text-gray-400">You haven't placed any bets yet.</p>
        )}
      </div>

      {!hasBets && !loading && (
        <div className="text-center py-16 bg-gray-800/50 rounded-lg">
          <FolderOpen className="w-16 h-16 text-gray-600 mx-auto mb-6" />
          <h3 className="text-xl font-semibold text-gray-300 mb-2">No Betting Activity</h3>
          <p className="text-gray-400">Create a market or place a bet to see your activity here.</p>
        </div>
      )}
    </div>
  );
}
