import { TrustScore } from "@/api/entities";
import { Bet } from "@/api/entities";
import { Participant } from "@/api/entities";
import { Vote } from "@/api/entities";

export class TrustScoreManager {
  static async calculateTrustScore(walletAddress) {
    try {
      // Get user's activity data with error handling for each call
      let allBetsCreated = [];
      let allParticipants = [];
      let allVotes = [];
      let allSystemBetsList = [];

      try {
        allBetsCreated = await Bet.filter({ creator_address: walletAddress });
      } catch (e) { console.error("Error fetching created bets for trust score:", e); }
      
      try {
        allParticipants = await Participant.filter({ participant_address: walletAddress });
      } catch (e) { console.error("Error fetching participations for trust score:", e); }
      
      try {
        allVotes = await Vote.filter({ voter_address: walletAddress });
      } catch (e) { console.error("Error fetching votes for trust score:", e); }
      
      try {
        // This is a key part of the fix: get all bets in one go to avoid fetching deleted ones.
        allSystemBetsList = await Bet.list();
      } catch (e) { console.error("Error fetching all bets for trust score calculation:", e); }

      const betsMap = new Map(allSystemBetsList.map(b => [b.id, b]));

      // Calculate account age (days since first activity)
      const activityDates = [
        ...allBetsCreated.map(b => new Date(b.created_date).getTime()),
        ...allParticipants.map(p => new Date(p.created_date).getTime()),
        ...allVotes.map(v => new Date(v.created_date).getTime())
      ].filter(Boolean);

      const firstActivity = activityDates.length > 0 ? Math.min(...activityDates) : Date.now();
      const accountAgeDays = Math.floor((Date.now() - firstActivity) / (1000 * 60 * 60 * 24));

      // Calculate voting accuracy using the safe betsMap
      let votesCorrect = 0;
      let validVotesCount = 0;
      for (const vote of allVotes) {
        const bet = betsMap.get(vote.bet_id);
        // Only consider votes on bets that still exist and are completed
        if (bet && bet.status === 'completed' && bet.winning_side) {
          validVotesCount++;
          if (bet.winning_side === vote.vote) {
            votesCorrect++;
          }
        }
      }
      const votingAccuracy = validVotesCount > 0 ? (votesCorrect / validVotesCount) * 100 : 0;

      // Calculate overall score (weighted formula)
      let score = 0;
      score += Math.min(25, Math.floor(accountAgeDays / 7));
      score += Math.min(30, allParticipants.length * 3);
      score += Math.min(20, allBetsCreated.length * 5);
      score += (votingAccuracy / 100) * 25;

      const trustScoreData = {
        wallet_address: walletAddress,
        overall_score: Math.min(100, Math.max(0, score)),
        account_age_days: accountAgeDays,
        bets_participated: allParticipants.length,
        bets_created: allBetsCreated.length,
        votes_cast: validVotesCount,
        votes_correct: votesCorrect,
        voting_accuracy: votingAccuracy,
        last_calculated: new Date().toISOString()
      };

      // Update or create trust score record
      const existingScore = await TrustScore.filter({ wallet_address: walletAddress });
      if (existingScore.length > 0) {
        await TrustScore.update(existingScore[0].id, trustScoreData);
        return { ...existingScore[0], ...trustScoreData };
      } else {
        return await TrustScore.create(trustScoreData);
      }
    } catch (error) {
      console.error('Critical error in calculateTrustScore:', error);
      return {
        wallet_address: walletAddress,
        overall_score: 0,
        account_age_days: 0,
        bets_participated: 0,
        bets_created: 0,
        votes_cast: 0,
        votes_correct: 0,
        voting_accuracy: 0
      };
    }
  }

  static async getTrustScore(walletAddress) {
    try {
      const existingScoreResult = await TrustScore.filter({ wallet_address: walletAddress });
      const existingScore = existingScoreResult.length > 0 ? existingScoreResult[0] : null;

      if (existingScore) {
        const lastCalculated = new Date(existingScore.last_calculated);
        const minutesSinceUpdate = (Date.now() - lastCalculated.getTime()) / (1000 * 60);
        if (minutesSinceUpdate > 15) {
          return await this.calculateTrustScore(walletAddress);
        }
        return existingScore;
      } else {
        return await this.calculateTrustScore(walletAddress);
      }
    } catch (error) {
      console.error('Error getting trust score:', error);
      return {
        wallet_address: walletAddress,
        overall_score: 0,
        account_age_days: 0,
        bets_participated: 0,
        bets_created: 0,
        votes_cast: 0,
        votes_correct: 0,
        voting_accuracy: 0
      };
    }
  }
}