
import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
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

const CountdownTimer = ({ deadline, prefix }) => {
    const deadlineMoment = moment.unix(deadline);
    const now = moment();
    if (now.isAfter(deadlineMoment)) {
      return <span className="text-gray-400">Finished</span>;
    }
    return <span className="text-gray-300">{prefix}{moment.unix(deadline).fromNow(true)}</span>
}


export default function BetRow({ bet }) {
    const totalStake = (bet.total_yes_stake_usd || 0) + (bet.total_no_stake_usd || 0);

    const getDeadlineInfo = () => {
        switch(bet.effectiveStatus) {
            case 'open_for_bets': return { deadline: bet.bettingDeadline, prefix: 'Closes in ' };
            case 'betting_closed': return { deadline: bet.proofDeadline, prefix: 'Proof in ' };
            case 'voting': return { deadline: bet.votingDeadline, prefix: 'Voting ends in ' };
            default: return null;
        }
    }
    const deadlineInfo = getDeadlineInfo();

    return (
        <Link to={createPageUrl(`BetDetails?address=${bet.address}`)}>
            <Card className="bg-gray-800 border-gray-700 hover:border-cyan-500 transition-all duration-300">
                <CardContent className="p-4 grid grid-cols-12 items-center gap-4">
                    <div className="col-span-12 md:col-span-5">
                        <p className="text-white font-semibold truncate">{bet.title}</p>
                        <p className="text-gray-400 text-sm truncate">{bet.description}</p>
                    </div>
                    <div className="col-span-4 md:col-span-2 flex items-center gap-2">
                        <Users className="w-4 h-4 text-cyan-400 shrink-0"/>
                        <span className="text-gray-300">{bet.participants_count || 0}</span>
                    </div>
                     <div className="col-span-4 md:col-span-2 flex items-center gap-2">
                        <Vote className="w-4 h-4 text-purple-400 shrink-0"/>
                        <span className="text-gray-300">{bet.voters_count || 0}</span>
                    </div>
                    <div className="col-span-4 md:col-span-1 text-right">
                        <span className="font-semibold text-white">${totalStake.toFixed(2)}</span>
                    </div>
                    <div className="col-span-6 md:col-span-1 text-center">
                         <StatusBadge status={bet.effectiveStatus} />
                    </div>
                    <div className="col-span-6 md:col-span-1 text-right">
                       <div className="flex items-center gap-2 text-sm justify-end">
                            <Clock className="w-4 h-4 text-gray-500" />
                            {
                                bet.effectiveStatus === 'completed' ? (
                                    <span className="text-gray-400">Completed</span>
                                ) : bet.effectiveStatus === 'cancelled' ? (
                                    <span className="text-gray-400">Cancelled</span>
                                ) : bet.effectiveStatus === 'awaiting_cancellation_no_proof' ? (
                                    <span className="text-gray-400">Cancelling</span>
                                ) : bet.effectiveStatus === 'awaiting_resolution' ? (
                                    <span className="text-gray-400">Resolving</span>
                                ) : deadlineInfo ? (
                                    <CountdownTimer deadline={deadlineInfo.deadline} prefix={deadlineInfo.prefix} />
                                ) : (
                                    <span className="text-gray-400">N/A</span> // Fallback for any other unexpected status
                                )
                            }
                        </div>
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}

