import React, { useState, useEffect, useCallback } from "react";
import { TrustScoreManager } from "../trust/TrustScoreManager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, TrendingUp, Users, CheckCircle, Clock, Award } from "lucide-react";

const ScoreDetailCard = ({ icon: Icon, title, value, suffix }) => (
  <Card className="bg-gray-800/50 border-gray-700">
    <CardHeader className="pb-3">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-cyan-400" />
        <CardTitle className="text-sm font-medium text-gray-300">{title}</CardTitle>
      </div>
    </CardHeader>
    <CardContent>
      <div className="text-3xl font-bold text-white">
        {value}
        {suffix && <span className="text-xl ml-1 text-gray-400">{suffix}</span>}
      </div>
    </CardContent>
  </Card>
);

export default function TrustScoreTab({ walletAddress }) {
  const [trustScore, setTrustScore] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadTrustScore = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const score = await TrustScoreManager.getTrustScore(walletAddress);
      setTrustScore(score);
    } catch (error) {
      console.error("Error loading trust score:", error);
    }
    setLoading(false);
  }, [walletAddress]);

  useEffect(() => {
    loadTrustScore();
  }, [loadTrustScore]);

  const getScoreColor = (score) => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-blue-400";
    if (score >= 40) return "text-yellow-400";
    return "text-red-400";
  };
  
  if (loading) {
    return <div className="text-center p-8 text-gray-400">Loading Trust Score...</div>;
  }
  
  if (!trustScore) {
    return <div className="text-center p-8 text-gray-400">Could not load trust score. Participate in a bet or vote to generate a score.</div>;
  }
  
  const score = Math.round(trustScore.overall_score || 0);

  return (
    <div className="space-y-8">
      <Card className="bg-gray-800 border-gray-700">
        <CardContent className="p-8 flex flex-col md:flex-row items-center gap-8">
          <div className="relative">
            <svg className="w-40 h-40 transform -rotate-90">
              <circle cx="80" cy="80" r="70" strokeWidth="12" stroke="currentColor" className="text-gray-700" fill="transparent" />
              <circle
                cx="80"
                cy="80"
                r="70"
                strokeWidth="12"
                stroke="currentColor"
                className={getScoreColor(score)}
                fill="transparent"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 70}
                strokeDashoffset={(2 * Math.PI * 70) * (1 - score / 100)}
                style={{ transition: 'stroke-dashoffset 1s ease-out' }}
              />
            </svg>
            <div className={`absolute inset-0 flex flex-col items-center justify-center ${getScoreColor(score)}`}>
              <span className="text-5xl font-bold">{score}</span>
              <span className="text-sm">/ 100</span>
            </div>
          </div>
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-3xl font-bold text-white mb-2">Your Trust Score</h2>
            <p className="text-gray-400 max-w-lg">
              Your Trust Score is a measure of your reputation on ProofBet. A higher score unlocks access to exclusive markets and demonstrates your credibility to other users. It's calculated based on your platform activity and voting record.
            </p>
          </div>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ScoreDetailCard icon={Clock} title="Account Age" value={trustScore.account_age_days} suffix="days" />
        <ScoreDetailCard icon={TrendingUp} title="Bets Created" value={trustScore.bets_created} />
        <ScoreDetailCard icon={Users} title="Bets Joined" value={trustScore.bets_participated} />
        <ScoreDetailCard icon={CheckCircle} title="Votes Cast" value={trustScore.votes_cast} />
        <ScoreDetailCard icon={Award} title="Correct Votes" value={trustScore.votes_correct} />
        <ScoreDetailCard icon={Shield} title="Voting Accuracy" value={Math.round(trustScore.voting_accuracy || 0)} suffix="%" />
      </div>
    </div>
  );
}