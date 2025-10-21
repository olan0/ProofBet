
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileQuestion, AlertCircle, Clock, AlertTriangle, LinkIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ProofPanel({ bet, isCreator, onProofSubmit }) {
  const [manualProofUrl, setManualProofUrl] = useState("");

  const handleManualProofSubmit = () => {
    if (manualProofUrl) {
      onProofSubmit(manualProofUrl);
    }
  };

  if (bet.proofUrl) {
    return (
        <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
                <CardTitle className="text-white">Submitted Proof</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-4 bg-gray-900 p-3 rounded-md">
                    <LinkIcon className="w-5 h-5 text-cyan-400" />
                    <a href={bet.proofUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 truncate">
                        {bet.proofUrl}
                    </a>
                </div>
            </CardContent>
        </Card>
    );
  }

  if (bet.effectiveStatus === 'awaiting_cancellation_no_proof') {
      return (
            <Card className="bg-orange-900/30 border-orange-500/40">
                <CardHeader>
                    <CardTitle className="text-orange-300 flex items-center gap-2">
                      <AlertTriangle /> Proof Deadline Missed
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-orange-400">The deadline for submitting proof has passed. This market is now pending cancellation by a keeper.</p>
                </CardContent>
            </Card>
      );
  }

  if (bet.effectiveStatus !== 'betting_closed') {
    return (
        <div className="text-center p-8 border-2 border-dashed border-gray-700 rounded-lg space-y-4 bg-gray-800/50">
            <FileQuestion className="w-12 h-12 text-gray-600 mx-auto" />
            <h3 className="text-xl font-semibold text-white">Proof Submission Not Yet Active</h3>
            <p className="text-gray-400">Proof can be submitted after the betting deadline has passed.</p>
        </div>
    );
  }

  // Now we know effectiveStatus is 'betting_closed'
  if (!isCreator) {
    return (
        <div className="text-center p-8 border-2 border-dashed border-gray-700 rounded-lg space-y-4 bg-gray-800/50">
            <Clock className="w-12 h-12 text-yellow-500 mx-auto" />
            <h3 className="text-xl font-semibold text-white">Waiting for Creator to Submit Proof</h3>
            <p className="text-gray-400">The betting period has ended. The creator must now submit proof of the outcome.</p>
        </div>
    );
  }
  
  // Is creator and status is betting_closed
  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
         <CardTitle className="text-white">Submit Proof of Outcome</CardTitle>
         <p className="text-gray-400">Provide a URL linking to the proof.</p>
      </CardHeader>
      <CardContent className="space-y-3">
         <Label htmlFor="proofUrl" className="text-gray-300">Proof URL</Label>
         <Input
           id="proofUrl"
           value={manualProofUrl}
           onChange={(e) => setManualProofUrl(e.target.value)}
           placeholder="https://example.com/proof.mp4"
           className="bg-gray-700 border-gray-600 text-white"
         />
         <Button onClick={handleManualProofSubmit} disabled={!manualProofUrl} className="w-full">
           <Upload className="w-4 h-4 mr-2" />
           Submit Proof
         </Button>
      </CardContent>
    </Card>
  );
}
