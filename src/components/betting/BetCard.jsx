import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Vote, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import moment from 'moment';

const StatusBadge = ({ status }) => {
    const statusInfo = {
        open_for_bets: { text: 'Open', color: 'bg-green-500/20 text-green-300 border-green-500/30' },
        betting_closed: { text: 'Awaiting Proof', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
        voting: { text: 'Voting', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
        awaiting_resolution: { text: 'Resolving', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
        completed: { text: 'Completed', color: 'bg-gray-500/20 text-gray-300 border-gray-500/30' },
        cancelled: { text: 'Cancelled', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
        awaiting_cancellation_no_proof: { text: 'Cancelling', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
    };

    const info = statusInfo[status] || statusInfo.completed;

    return <Badge className={`px-2 py-1 ${info.color}`}>{info.text}</Badge>;
};

const CountdownTimer = ({ deadline, status, prefix }) => {
    const deadlineMoment = moment.unix(deadline);
    const now = moment();

    if (now.isAfter(deadlineMoment)) {
        if (status === 'open_for_bets') return <span className="text-yellow-400">Betting Closed</span>;
        if (status === 'betting_closed' || status === 'awaiting_proof') return <span className="text-yellow-400">Proof Deadline Passed</span>;
        if (status === 'voting') return <span className="text-yellow-400">Voting Closed</span>;
        return <span className="text-gray-400">Finished</span>;
    }
    
    return <span className="text-gray-300">{prefix}{moment.unix(deadline).fromNow(true)}</span>;
}

export default function BetCard({ bet }) {
    const totalStake = (bet.total_yes_stake_usd || 0) + (bet.total_no_stake_usd || 0);

    const getDeadlineInfo = () => {
        switch(bet.effectiveStatus) {
            case 'open_for_bets': return { deadline: bet.bettingDeadline, prefix: 'Closes in ' };
            case 'betting_closed':
            case 'awaiting_proof': // Use the same deadline for both
                return { deadline: bet.proofDeadline, prefix: 'Proof due in ' };
            case 'voting': return { deadline: bet.votingDeadline, prefix: 'Voting ends in ' };
            default: return null;
        }
    }

    const deadlineInfo = getDeadlineInfo();

    return (
        <Link to={createPageUrl(`BetDetails?address=${bet.address}`)}>
            <Card className="bg-gray-800 border-gray-700 hover:border-cyan-500 transition-all duration-300 flex flex-col h-full">
                <CardHeader>
                    <div className="flex justify-between items-start gap-2">
                        <CardTitle className="text-lg font-bold text-white line-clamp-2">{bet.title}</CardTitle>
                        <StatusBadge status={bet.effectiveStatus} />
                    </div>
                </CardHeader>
                <CardContent className="flex-grow">
                    <p className="text-gray-400 text-sm mb-4 line-clamp-3">{bet.description}</p>
                    <div className="flex justify-between items-center text-sm text-gray-400">
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1.5"><Users className="w-4 h-4 text-cyan-400"/> {bet.participants_count || 0}</span>
                            <span className="flex items-center gap-1.5"><Vote className="w-4 h-4 text-purple-400"/> {bet.voters_count || 0}</span>
                        </div>
                        <span className="font-semibold text-white">${totalStake.toFixed(2)}</span>
                    </div>
                </CardContent>
                <CardFooter className="border-t border-gray-700 pt-3">
                    <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-gray-500" />
                        {deadlineInfo ? (
                            <CountdownTimer deadline={deadlineInfo.deadline} status={bet.effectiveStatus} prefix={deadlineInfo.prefix} />
                        ) : (
                            <span className="text-gray-400">Resolution in progress</span>
                        )}
                    </div>
                </CardFooter>
            </Card>
        </Link>
    );
}