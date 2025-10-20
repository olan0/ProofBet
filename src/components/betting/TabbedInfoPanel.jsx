import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Users, MessageCircle, Vote } from 'lucide-react';

import ParticipantsList from "./ParticipantsList";
import VoteHistory from "./VoteHistory";
import ChatPanel from "./ChatPanel";

export default function TabbedInfoPanel({ bet, participants, votes, walletAddress, onRequestWalletConnect }) {
  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardContent className="p-0">
        <Tabs defaultValue="participants" className="w-full">
          <CardHeader className="p-4 border-b border-gray-700">
            <TabsList className="grid w-full grid-cols-3 bg-gray-900/50">
              <TabsTrigger value="participants">
                <Users className="w-4 h-4 mr-2" />
                Participants ({participants.length})
              </TabsTrigger>
              <TabsTrigger value="votes">
                <Vote className="w-4 h-4 mr-2" />
                Votes ({votes.length})
              </TabsTrigger>
              <TabsTrigger value="discussion">
                <MessageCircle className="w-4 h-4 mr-2" />
                Discussion
              </TabsTrigger>
            </TabsList>
          </CardHeader>
          
          <TabsContent value="participants" className="p-4">
            <ParticipantsList participants={participants} bet={bet} />
          </TabsContent>
          <TabsContent value="votes" className="p-4">
            <VoteHistory votes={votes} />
          </TabsContent>
          <TabsContent value="discussion" className="p-4">
            <ChatPanel 
              betAddress={bet.address}
              walletAddress={walletAddress}
              walletConnected={!!walletAddress}
              onRequestWalletConnect={onRequestWalletConnect}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}