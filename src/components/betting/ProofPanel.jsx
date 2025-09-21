
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
          </div>
        ) : (
          <div className="text-center p-8 border-2 border-dashed border-gray-700 rounded-lg space-y-4">
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
