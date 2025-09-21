import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Camera, Video, Globe, AlertCircle, Play, Square, ExternalLink } from "lucide-react";

export default function StreamingPanel({ bet, isCreator, onStreamStart, onStreamEnd }) {
  const [streamUrl, setStreamUrl] = useState(bet.proof_url || "");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamKey, setStreamKey] = useState("");
  const [platform, setPlatform] = useState("custom");
  const [embedUrl, setEmbedUrl] = useState("");

  useEffect(() => {
    if (bet.proof_url && bet.proof_submitted) {
      setIsStreaming(true);
      setEmbedUrl(bet.proof_url);
    }
  }, [bet]);

  // Convert YouTube URL to embed format
  const convertToEmbedUrl = (url) => {
    if (!url) return "";
    
    // YouTube watch URL to embed
    const youtubeMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    if (youtubeMatch) {
      return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
    }
    
    // YouTube live URL
    const youtubeLiveMatch = url.match(/youtube\.com\/live\/([^&\n?#]+)/);
    if (youtubeLiveMatch) {
      return `https://www.youtube.com/embed/${youtubeLiveMatch[1]}`;
    }
    
    // Twitch URL to embed
    const twitchMatch = url.match(/twitch\.tv\/([^&\n?#]+)/);
    if (twitchMatch) {
      return `https://player.twitch.tv/?channel=${twitchMatch[1]}&parent=${window.location.hostname}`;
    }
    
    return url;
  };

  const startStream = async () => {
    try {
      const finalStreamUrl = convertToEmbedUrl(streamUrl) || streamUrl;
      setEmbedUrl(finalStreamUrl);
      setIsStreaming(true);
      await onStreamStart(finalStreamUrl);
    } catch (error) {
      console.error("Failed to start stream:", error);
      setIsStreaming(false);
    }
  };

  const endStream = async () => {
    try {
      setIsStreaming(false);
      setEmbedUrl("");
      await onStreamEnd();
    } catch (error) {
      console.error("Failed to end stream:", error);
    }
  };

  const generateStreamKey = () => {
    const key = `sk_${Math.random().toString(36).substr(2, 16)}`;
    setStreamKey(key);
  };

  if (!isCreator) {
    // Viewer mode - show live stream if active
    return (
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Video className="w-5 h-5 text-red-500" />
            Live Stream Proof
            {isStreaming && (
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">
                LIVE
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isStreaming && embedUrl ? (
            <div className="space-y-4">
              <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                <iframe
                  src={embedUrl}
                  className="w-full h-full"
                  allowFullScreen
                  title="Live Stream"
                  sandbox="allow-scripts allow-same-origin"
                />
                <div className="absolute top-2 right-2">
                  <a 
                    href={streamUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-gray-900/80 text-white p-2 rounded-lg hover:bg-gray-900/90 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span>Live proof submission - view full screen</span>
                <a 
                  href={streamUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline ml-auto"
                >
                  Open in new tab
                </a>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Camera className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No Live Stream</h3>
              <p className="text-gray-400">The creator hasn't started streaming yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Creator mode - streaming controls
  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Video className="w-5 h-5 text-cyan-400" />
          Live Stream Setup
          {isStreaming && (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 animate-pulse">
              LIVE
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isStreaming ? (
          <>
            <Alert className="bg-blue-500/10 border-blue-500/20">
              <AlertCircle className="h-4 w-4 text-blue-400" />
              <AlertDescription className="text-blue-200">
                Provide a live stream URL to submit proof for this bet. The stream will be visible to all participants and voters.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-300">Platform Instructions</Label>
                <div className="grid gap-3 text-sm">
                  <div className="p-3 bg-gray-700/50 rounded-lg">
                    <h4 className="font-semibold text-white mb-1">YouTube Live:</h4>
                    <p className="text-gray-400">Use format: https://youtube.com/watch?v=YOUR_VIDEO_ID</p>
                    <p className="text-gray-400">Or: https://youtube.com/live/YOUR_STREAM_ID</p>
                  </div>
                  <div className="p-3 bg-gray-700/50 rounded-lg">
                    <h4 className="font-semibold text-white mb-1">Twitch:</h4>
                    <p className="text-gray-400">Use format: https://twitch.tv/YOUR_CHANNEL</p>
                  </div>
                  <div className="p-3 bg-gray-700/50 rounded-lg">
                    <h4 className="font-semibold text-white mb-1">Custom Stream:</h4>
                    <p className="text-gray-400">Any embeddable stream URL</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="streamUrl" className="text-gray-300">Stream URL *</Label>
                <Input
                  id="streamUrl"
                  value={streamUrl}
                  onChange={(e) => setStreamUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=YOUR_VIDEO_ID"
                  className="bg-gray-700 border-gray-600 text-white"
                />
                <p className="text-xs text-gray-400">
                  Paste your live stream URL here. Make sure your stream is public and embeddable.
                </p>
              </div>

              {streamUrl && (
                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <p className="text-green-200 text-sm">
                    <strong>Preview URL:</strong> {convertToEmbedUrl(streamUrl)}
                  </p>
                </div>
              )}
            </div>

            <Button 
              onClick={startStream}
              disabled={!streamUrl.trim()}
              className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-3"
            >
              <Play className="w-5 h-5 mr-2" />
              Start Live Proof Stream
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-4">
              <div className="aspect-video bg-black rounded-lg overflow-hidden relative">
                <iframe
                  src={embedUrl}
                  className="w-full h-full"
                  allowFullScreen
                  title="Your Live Stream"
                  sandbox="allow-scripts allow-same-origin"
                />
                <div className="absolute top-2 left-2 flex items-center gap-2 bg-red-600 px-3 py-1 rounded text-white text-sm font-semibold">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  LIVE PROOF
                </div>
              </div>

              <Alert className="bg-green-500/10 border-green-500/20">
                <AlertCircle className="h-4 w-4 text-green-400" />
                <AlertDescription className="text-green-200">
                  Your live stream is active and being recorded as proof. All participants and voters can see this stream.
                </AlertDescription>
              </Alert>

              <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <span className="text-white text-sm">Stream is public</span>
                </div>
                <a 
                  href={streamUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline text-sm flex items-center gap-1"
                >
                  View full screen <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <Button 
              onClick={endStream}
              variant="destructive"
              className="w-full font-bold py-3"
            >
              <Square className="w-5 h-5 mr-2" />
              End Stream & Submit Proof
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}