import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Video, Camera, Image as ImageIcon, User } from "lucide-react";
import AddressDisplay from "../common/AddressDisplay";

const categoryColors = {
  sports: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  politics: "bg-red-500/20 text-red-400 border-red-500/30",
  entertainment: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  crypto: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  personal: "bg-green-500/20 text-green-400 border-green-500/30",
  other: "bg-gray-500/20 text-gray-400 border-gray-500/30"
};

const statusColors = {
  active: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  voting: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  completed: "bg-green-500/20 text-green-400 border-green-500/30",
  cancelled: "bg-red-500/20 text-red-400 border-red-500/30"
};

const proofIcons = {
  video: Video,
  live_stream: Camera,
  photo: ImageIcon
};

export default function BetDetailHeader({ bet }) {
  const ProofIcon = proofIcons[bet.proof_type] || Video;

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardContent className="p-6">
        <div className="flex items-center gap-4 mb-4">
          <Badge className={categoryColors[bet.category] || categoryColors.other}>{bet.category}</Badge>
          <Badge className={statusColors[bet.status] || statusColors.active}>{bet.status}</Badge>
          <div className="flex items-center gap-1 text-gray-400 ml-auto">
            <ProofIcon className="w-4 h-4" />
            <span className="text-xs capitalize">{bet.proof_type?.replace('_', ' ')}</span>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">{bet.title}</h1>
        <p className="text-gray-400 mb-4">{bet.description}</p>
        
        {/* Creator Information - Now Prominent */}
        <div className="flex items-center gap-2 p-3 bg-gray-700/30 rounded-lg border border-gray-600">
          <User className="w-5 h-5 text-cyan-400" />
          <span className="text-gray-300 font-medium">Created by:</span>
          <AddressDisplay address={bet.creator_address} />
        </div>
      </CardContent>
    </Card>
  );
}