import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Video, Users, MessageCircle, Heart } from "lucide-react";

export default function StreamViewer({ streamUrl, title, viewerCount = 0, isLive = true }) {
  const [likes, setLikes] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);

  const handleLike = () => {
    if (!hasLiked) {
      setLikes(likes + 1);
      setHasLiked(true);
    }
  };

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Video className="w-5 h-5 text-red-500" />
            {title}
          </CardTitle>
          {isLive && (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">
              LIVE
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="aspect-video bg-black rounded-lg overflow-hidden">
          <iframe
            src={streamUrl}
            className="w-full h-full"
            allowFullScreen
            title="Live Stream"
          />
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              <span>{viewerCount} viewers</span>
            </div>
            <div className="flex items-center gap-1">
              <Heart className={`w-4 h-4 ${hasLiked ? 'text-red-500 fill-current' : 'text-gray-400'}`} />
              <span>{likes} likes</span>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleLike}
              disabled={hasLiked}
              className={`border-gray-600 ${hasLiked ? 'text-red-400 border-red-500/50' : 'text-gray-300 hover:bg-gray-700'}`}
            >
              <Heart className={`w-4 h-4 mr-1 ${hasLiked ? 'fill-current' : ''}`} />
              Like
            </Button>
            <Button size="sm" variant="outline" className="border-gray-600 text-gray-300 hover:bg-gray-700">
              <MessageCircle className="w-4 h-4 mr-1" />
              Chat
            </Button>
          </div>
        </div>
        
        {isLive && (
          <div className="text-xs text-gray-400 bg-blue-500/10 border border-blue-500/20 rounded p-2">
            📺 This stream is being recorded as proof for the bet outcome
          </div>
        )}
      </CardContent>
    </Card>
  );
}