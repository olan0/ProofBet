
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import AddressDisplay from "../common/AddressDisplay"; // Added import

export default function VoteHistory({ votes }) {
  if (!votes || votes.length === 0) {
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white">Public Votes</CardTitle>
          <p className="text-gray-400 text-sm">Votes from neutral observers (non-bettors)</p>
        </CardHeader>
        <CardContent>
          <p className="text-gray-400 text-center py-4">No votes have been cast yet.</p>
        </CardContent>
      </Card>
    );
  }

  const yesVotes = votes.filter(v => v.vote === 'yes').length;
  const noVotes = votes.filter(v => v.vote === 'no').length;

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white">Public Votes ({votes.length})</CardTitle>
        <p className="text-gray-400 text-sm">
          Votes from neutral observers • YES: {yesVotes} | NO: {noVotes}
        </p>
      </CardHeader>
      <CardContent>
        <div className="max-h-96 overflow-y-auto">
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
                    {/* Replaced direct address display with AddressDisplay component */}
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
      </CardContent>
    </Card>
  );
}
