import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Video, Camera, Image as ImageIcon, User, Clock, Users, Vote, Target } from "lucide-react";
import AddressDisplay from "../common/AddressDisplay";
import moment from 'moment';

const getStatusInfo = (status) => {
    const statuses = {
      open_for_bets: { text: 'Open for Betting', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
      betting_closed: { text: 'Awaiting Proof', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
      voting: { text: 'Voting Active', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
      completed: { text: 'Completed', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
      cancelled: { text: 'Cancelled', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
      awaiting_resolution: { text: 'Awaiting Resolution', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
      awaiting_cancellation_no_proof: { text: 'Pending Cancellation', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' }
    };
    return statuses[status] || { text: 'Unknown', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' };
};

export default function BetDetailHeader({ bet }) {
  const { text, color } = getStatusInfo(bet.effectiveStatus);

  // Convert Unix timestamps (seconds) to moment objects
  // Note: bet.bettingDeadline is already in seconds from the blockchain
  const deadlines = [
    { label: 'Betting Closes', date: moment.unix(bet.bettingDeadline) },
    { label: 'Proof Deadline', date: moment.unix(bet.proofDeadline) },
    { label: 'Voting Ends', date: moment.unix(bet.votingDeadline) },
  ];

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardContent className="p-6 space-y-4">
        <div className="flex justify-between items-start">
            <div>
                <Badge className={color}>{text}</Badge>
                <h1 className="text-3xl font-bold text-white mt-2">{bet.title}</h1>
                <p className="text-gray-400 mt-2">{bet.description}</p>
            </div>
            <div className="text-right flex-shrink-0">
                <span className="text-sm text-gray-400">Created by:</span>
                <AddressDisplay address={bet.creator_address} />
            </div>
        </div>
        
        <div className="border-t border-gray-700 pt-4 flex flex-wrap justify-between items-center gap-x-6 gap-y-3 text-sm text-gray-300">
            <div className="flex items-center gap-6">
                <span title="Participants" className="flex items-center gap-1.5"><Users className="w-4 h-4 text-cyan-400"/> {bet.participants_count || 0}</span>
                <span title="Voters" className="flex items-center gap-1.5"><Vote className="w-4 h-4 text-purple-400"/> {bet.voters_count || 0}</span>
                <span title="Min Votes" className="flex items-center gap-1.5"><Target className="w-4 h-4 text-gray-400"/> {bet.minimum_votes || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-4">
                {deadlines.map(d => (
                    <span key={d.label} className="flex items-center gap-1.5" title={d.date.format('LLLL')}>
                        <Clock className="w-4 h-4 text-gray-500"/> 
                        {d.label}: {d.date.fromNow()}
                    </span>
                ))}
            </div>
        </div>
      </CardContent>
    </Card>
  );
}