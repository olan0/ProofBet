
import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import AddressDisplay from "../common/AddressDisplay";

export default function VoteHistory({ votes }) {
  if (!votes || votes.length === 0) {
    return (
      <p className="text-gray-400 text-center py-4">No votes have been cast yet.</p>
    );
  }

  const yesVotes = votes.filter(v => v.vote === 'yes').length;
  const noVotes = votes.filter(v => v.vote === 'no').length;

  return (
    <div>
      <p className="text-gray-400 text-sm mb-4">
        Votes from neutral observers • YES: {yesVotes} | NO: {noVotes}
      </p>
      <div className="max-h-96 overflow-y-auto border border-gray-700 rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-700 hover:bg-transparent">
              <TableHead className="text-gray-400">Vote</TableHead>
              <TableHead className="text-gray-400">Voter</TableHead>
              <TableHead className="text-gray-400 text-right">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {votes.map((vote) => (
              <TableRow key={vote.id} className="border-gray-700 hover:bg-gray-700/50">
                <TableCell>
                  <div className="flex items-center gap-2">
                    {vote.vote === 'yes' ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-400" />
                    )}
                    <span className={`font-semibold ${vote.vote === 'yes' ? 'text-green-400' : 'text-red-400'}`}>
                      {vote.vote.toUpperCase()}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <AddressDisplay address={vote.voter_address} />
                </TableCell>
                <TableCell className="text-right text-gray-400 text-xs">
                  {formatDistanceToNow(new Date(vote.created_date), { addSuffix: true })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
