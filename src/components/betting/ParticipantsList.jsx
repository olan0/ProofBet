
import React from "react";
import { User, Users } from "lucide-react";
import AddressDisplay from "../common/AddressDisplay";

export default function ParticipantsList({ participants, bet }) {
  const yesParticipants = participants.filter(p => p.position === 'yes');
  const noParticipants = participants.filter(p => p.position === 'no');

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <ParticipantSideList title="YES Bettors" participants={yesParticipants} totalStake={bet.total_yes_stake_usd} />
      <ParticipantSideList title="NO Bettors" participants={noParticipants} totalStake={bet.total_no_stake_usd} />
    </div>
  );
}

const ParticipantSideList = ({ title, participants, totalStake }) => (
  <div className="space-y-3">
    <div className="flex justify-between items-baseline">
      <h3 className="font-semibold text-white">{title} ({participants.length})</h3>
      <span className="text-sm font-bold text-gray-300">${(totalStake || 0).toFixed(2)} Total</span>
    </div>
    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
      {participants.length > 0 ? (
        participants.map(p => (
          <div key={p.id} className="flex items-center justify-between bg-gray-700/50 p-2 rounded-lg">
            <AddressDisplay address={p.participant_address} />
            <span className="font-semibold text-cyan-300">${(p.stake_amount_usd || 0).toFixed(2)}</span>
          </div>
        ))
      ) : (
        <div className="text-center text-gray-500 py-4">No bettors on this side yet.</div>
      )}
    </div>
  </div>
);
