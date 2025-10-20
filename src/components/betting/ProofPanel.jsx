
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Film, FileQuestion, Camera, CheckCircle, AlertCircle, Clock } from "lucide-react";
import StreamingPanel from "../streaming/StreamingPanel";
import { formatDistanceToNow, format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ProofPanel({ bet, isCreator = false, onProofSubmit }) {
  const [manualProofUrl, setManualProofUrl] = useState("");
  const hasProof = bet.proof_submitted && bet.proof_url;

  const deadline = bet.proof_deadline ? new Date(bet.proof_deadline) : null;
  const now = new Date();
  const isDeadlinePassed = deadline && now > deadline;

  const getProofTimeRemaining = () => {
    if (!deadline) return null;
    
    if (isDeadlinePassed) {
      return "Proof deadline passed";
    }

    return formatDistanceToNow(deadline, { addSuffix: true });
  };

  const handleManualProofSubmit = () => {
    if (manualProofUrl) {
      onProofSubmit(manualProofUrl);
    }
  };

  // If this is a live stream bet, show streaming panel
  if (bet.proof_type === 'live_stream' && !hasProof && isCreator && !isDeadlinePassed) {
    return (
      <StreamingPanel 
        bet={bet}
        isCreator={isCreator}
        onStreamStart={onProofSubmit}
        onStreamEnd={() => {}}
      />
    );
  }

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Film className="w-5 h-5 text-cyan-400" />
          Proof of Outcome
        </CardTitle>
        {bet.status === 'betting_closed' && deadline && !hasProof && (
          <p className={`text-sm mt-1 ${isDeadlinePassed ? 'text-red-500' : 'text-yellow-400'}`}>
            ⏰ 
            {isDeadlinePassed 
              ? "Proof submission deadline has passed. This bet will likely be cancelled."
              : `Creator must submit proof ${getProofTimeRemaining()}`}
          </p>
        )}
        {bet.status === 'voting' && hasProof && (
          <p className="text-sm mt-1 text-green-400 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Proof submitted! Public voting is now open.
          </p>
        )}
        {/* New: Header messages for final states */}
        {bet.status === 'resolved' && (
          <p className="text-sm mt-1 text-green-400 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Bet Resolved! Proof is available below.
          </p>
        )}
        {bet.status === 'cancelled' && (
          <p className="text-sm mt-1 text-red-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Bet Cancelled. Details below.
          </p>
        )}
        {bet.status === 'disputed' && (
          <p className="text-sm mt-1 text-yellow-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Bet Disputed. Details below.
          </p>
        )}
      </CardHeader>
      <CardContent>
        {hasProof ? (
          <div>
            {bet.proof_type === 'video' || bet.proof_type === 'photo' ? (
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                {bet.proof_type === 'video' ? (
                  <video src={bet.proof_url} controls className="w-full h-full object-contain" />
                ) : (
                  <img src={bet.proof_url} alt="Proof" className="w-full h-full object-contain" />
                )}
              </div>
            ) : (
              <div className="p-4 bg-gray-700/50 rounded-lg">
                <p className="text-gray-400 mb-2">Live stream recording:</p>
                <a href={bet.proof_url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline break-all">
                  {bet.proof_url}
                </a>
              </div>
            )}
            {bet.status === 'voting' && (
              <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-green-300 font-semibold">✓ Proof Accepted - Voting Phase Active</p>
                <p className="text-green-400 text-sm mt-1">
                  Review the proof above and cast your vote on whether the claim is true.
                </p>
              </div>
            )}
            {/* New: Messages for resolved/cancelled/disputed with proof */}
            {bet.status === 'resolved' && (
              <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-green-300 font-semibold">✓ Bet Resolved!</p>
                <p className="text-green-400 text-sm mt-1">
                  This bet has been successfully resolved based on the proof and voting outcome.
                </p>
              </div>
            )}
            {bet.status === 'cancelled' && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-300 font-semibold">✖ Bet Cancelled</p>
                <p className="text-red-400 text-sm mt-1">
                  This bet was cancelled. This could be due to invalid proof, deadline expiration, or other reasons.
                </p>
              </div>
            )}
            {bet.status === 'disputed' && (
              <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-yellow-300 font-semibold">⚠️ Bet Disputed</p>
                <p className="text-yellow-400 text-sm mt-1">
                  The outcome of this bet is currently under dispute and is awaiting moderation.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center p-8 border-2 border-dashed border-gray-700 rounded-lg space-y-4">
            {/* New: Main messages for final states when no proof */}
            {bet.status === 'cancelled' && (
                <>
                    <AlertCircle className="w-12 h-12 text-red-600 mx-auto" />
                    <h3 className="text-xl font-semibold text-red-400">Bet Cancelled</h3>
                    <p className="text-gray-400">This bet was cancelled, likely due to no proof being submitted by the deadline, or due to a dispute.</p>
                </>
            )}
            {bet.status === 'resolved' && ( // Should rarely happen without explicit proof being displayed, but good to cover
                <>
                    <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
                    <h3 className="text-xl font-semibold text-green-400">Bet Resolved</h3>
                    <p className="text-gray-400">This bet has been resolved, even without explicit proof being displayed here.</p>
                </>
            )}
            {bet.status === 'disputed' && ( // If disputed before proof submission
                <>
                    <AlertCircle className="w-12 h-12 text-yellow-600 mx-auto" />
                    <h3 className="text-xl font-semibold text-yellow-400">Bet Disputed</h3>
                    <p className="text-gray-400">The outcome of this bet is currently under dispute, and proof has not yet been submitted or accepted.</p>
                </>
            )}
            {/* Existing 'Waiting for Proof' messages - only show if not in a final state without proof */}
            {bet.status !== 'cancelled' && bet.status !== 'resolved' && bet.status !== 'disputed' && (
                <>
                    <FileQuestion className="w-12 h-12 text-gray-600 mx-auto" />
                    <div>
                        <h3 className="text-xl font-semibold text-white">
                          {bet.status === 'betting_closed' ? 'Waiting for Proof' : 'Proof Not Submitted Yet'}
                        </h3>
                        <p className="text-gray-400">
                          {bet.proof_type === 'live_stream' 
                            ? 'The creator will start a live stream to provide proof.'
                            : bet.status === 'betting_closed' && deadline
                              ? `Creator has until ${format(deadline, 'PPpp')} to submit proof.`
                              : 'The creator has not submitted proof for this bet.'}
                        </p>
                    </div>
                </>
            )}

            {bet.status === 'betting_closed' && isCreator && !hasProof && !isDeadlinePassed && bet.proof_type !== 'live_stream' && (
              <div className="space-y-3 pt-4 border-t border-gray-700/50">
                 <Label htmlFor="proofUrl" className="text-gray-300">Proof URL ({bet.proof_type})</Label>
                 <Input
                   id="proofUrl"
                   value={manualProofUrl}
                   onChange={(e) => setManualProofUrl(e.target.value)}
                   placeholder={`https://example.com/proof.${bet.proof_type === 'video' ? 'mp4' : 'jpg'}`}
                   className="bg-gray-700 border-gray-600 text-white"
                 />
                 <Button onClick={handleManualProofSubmit} disabled={!manualProofUrl}>
                   <Upload className="w-4 h-4 mr-2" />
                   Submit Proof
                 </Button>
              </div>
            )}

            {bet.status === 'betting_closed' && isCreator && isDeadlinePassed && (
              <div className="flex items-center gap-2 justify-center text-red-400 p-3 bg-red-500/10 rounded-lg">
                <AlertCircle className="w-4 h-4" />
                <p className="text-sm">Proof submission deadline has passed.</p>
              </div>
            )}
            
            {bet.status === 'betting_closed' && !isCreator && (
              <div className={`flex items-center gap-2 justify-center p-3 rounded-lg ${isDeadlinePassed ? 'text-red-400 bg-red-500/10' : 'text-yellow-400 bg-yellow-500/10'}`}>
                {isDeadlinePassed ? <AlertCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                <p className="text-sm">
                   {isDeadlinePassed
                      ? "The proof submission deadline has passed. This bet will likely be cancelled."
                      : "Waiting for the creator to submit proof."
                   }
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
