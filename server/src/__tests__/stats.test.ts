import request from 'supertest';
import Bet from '../models/Bet';
import Activity, { ActivityType, ActorRole } from '../models/Activity';
import { createApp } from './testApp';

const app = createApp();

const makeBet = (overrides = {}) => ({
  betId: `0x${Math.random().toString(16).slice(2).padEnd(40, '0')}`,
  creator: '0xcreator0000000000000000000000000000000001',
  title: 'Test Bet',
  status: 0,
  category: 1,
  proofType: 1,
  totalBet: 100,
  totalParticipants: 2,
  ...overrides,
});

const makeActivity = (actor: string, role: ActorRole, type: ActivityType, betId: string, overrides = {}) => ({
  txHash: `0x${Math.random().toString(16).slice(2).padEnd(64, '0')}`,
  blockNumber: 1,
  timestamp: new Date(),
  betId,
  actor: actor.toLowerCase(),
  role,
  type,
  amountUsdc: '50000000', // 50 USDC as string
  ...overrides,
});

describe('GET /api/stats/platform', () => {
  it('returns zeros when database is empty', async () => {
    const res = await request(app).get('/api/stats/platform');
    expect(res.status).toBe(200);
    expect(res.body.totalBets).toBe(0);
    expect(res.body.totalParticipants).toBe(0);
  });

  it('counts total bets and volume', async () => {
    await Bet.create([
      makeBet({ totalBet: 200 }),
      makeBet({ totalBet: 300 }),
    ]);

    const res = await request(app).get('/api/stats/platform');
    expect(res.status).toBe(200);
    expect(res.body.totalBets).toBe(2);
    expect(res.body.totalVolume).toBe(500);
  });

  it('counts distinct participants from Activity', async () => {
    const betId = '0xbet001';
    await Activity.create([
      makeActivity('0xuser1', ActorRole.BETTOR, ActivityType.BET, betId),
      makeActivity('0xuser2', ActorRole.BETTOR, ActivityType.BET, betId),
      makeActivity('0xuser1', ActorRole.VOTER, ActivityType.VOTE, betId), // same user, different action
    ]);

    const res = await request(app).get('/api/stats/platform');
    expect(res.status).toBe(200);
    expect(res.body.totalParticipants).toBe(2); // distinct actors
  });

  /**
   * BUG: activeBets is counted as status === 1 (AWAITING_PROOF) only.
   * Bets with status 0 (OPEN_FOR_BETS) and 2 (VOTING_IN_PROGRESS) are not counted.
   * Fix: use $in: [0, 1, 2] or rename the field to reflect its actual meaning.
   */
  it.failing('BUG: activeBets should include OPEN_FOR_BETS (status=0), not just AWAITING_PROOF (status=1)', async () => {
    await Bet.create([
      makeBet({ status: 0 }), // OPEN_FOR_BETS
      makeBet({ status: 1 }), // AWAITING_PROOF
      makeBet({ status: 2 }), // VOTING_IN_PROGRESS
      makeBet({ status: 3 }), // RESOLVED
    ]);

    const res = await request(app).get('/api/stats/platform');
    expect(res.status).toBe(200);
    // Currently counts only status=1, returns 1 instead of 3
    expect(res.body.activeBets).toBe(3);
  });

  it('counts completedBets (status=3) and cancelledBets (status=4)', async () => {
    await Bet.create([
      makeBet({ status: 3 }),
      makeBet({ status: 3 }),
      makeBet({ status: 4 }),
    ]);

    const res = await request(app).get('/api/stats/platform');
    expect(res.status).toBe(200);
    expect(res.body.completedBets).toBe(2);
    expect(res.body.cancelledBets).toBe(1);
  });
});

describe('GET /api/stats/top-volume', () => {
  it('returns bets sorted by totalBet descending', async () => {
    await Bet.create([
      makeBet({ title: 'Low Volume', totalBet: 10 }),
      makeBet({ title: 'High Volume', totalBet: 1000 }),
      makeBet({ title: 'Mid Volume', totalBet: 500 }),
    ]);

    const res = await request(app).get('/api/stats/top-volume');
    expect(res.status).toBe(200);
    expect(res.body[0].title).toBe('High Volume');
    expect(res.body[1].title).toBe('Mid Volume');
  });

  it('respects limit parameter', async () => {
    await Bet.create(Array.from({ length: 10 }, (_, i) => makeBet({ totalBet: i * 10 })));

    const res = await request(app).get('/api/stats/top-volume?limit=3');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
  });

  it('caps limit at 50', async () => {
    await Bet.create(Array.from({ length: 10 }, () => makeBet()));
    const res = await request(app).get('/api/stats/top-volume?limit=999');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(50);
  });
});

describe('GET /api/stats/recent', () => {
  it('returns bets sorted by createdAt descending', async () => {
    await Bet.create([
      makeBet({ title: 'Old Bet', createdAt: new Date('2024-01-01') }),
      makeBet({ title: 'New Bet', createdAt: new Date('2024-12-01') }),
    ]);

    const res = await request(app).get('/api/stats/recent');
    expect(res.status).toBe(200);
    expect(res.body[0].title).toBe('New Bet');
  });

  it('returns empty array when no bets', async () => {
    const res = await request(app).get('/api/stats/recent');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('GET /api/stats/top-creators', () => {
  it('returns creators sorted by market count', async () => {
    const c1 = '0xcreator0000000000000000000000000000000001';
    const c2 = '0xcreator0000000000000000000000000000000002';
    await Bet.create([
      makeBet({ creator: c1 }),
      makeBet({ creator: c1 }),
      makeBet({ creator: c2 }),
    ]);

    const res = await request(app).get('/api/stats/top-creators');
    expect(res.status).toBe(200);
    expect(res.body[0].address).toBe(c1);
    expect(res.body[0].marketCount).toBe(2);
    expect(res.body[1].marketCount).toBe(1);
  });

  it('includes totalVolume per creator', async () => {
    const creator = '0xcreator0000000000000000000000000000000001';
    await Bet.create([
      makeBet({ creator, totalBet: 100 }),
      makeBet({ creator, totalBet: 200 }),
    ]);

    const res = await request(app).get('/api/stats/top-creators');
    expect(res.status).toBe(200);
    expect(res.body[0].totalVolume).toBe(300);
  });
});

describe('GET /api/stats/top-active', () => {
  it('returns markets with activity counts', async () => {
    const betId1 = '0xbet0000000000000000000000000000000000001';
    const betId2 = '0xbet0000000000000000000000000000000000002';
    await Bet.create([
      makeBet({ betId: betId1, title: 'Active Market' }),
      makeBet({ betId: betId2, title: 'Quiet Market' }),
    ]);
    await Activity.create([
      makeActivity('0xuser1', ActorRole.BETTOR, ActivityType.BET, betId1),
      makeActivity('0xuser2', ActorRole.BETTOR, ActivityType.BET, betId1),
      makeActivity('0xuser3', ActorRole.BETTOR, ActivityType.BET, betId1),
      makeActivity('0xuser1', ActorRole.BETTOR, ActivityType.BET, betId2),
    ]);

    const res = await request(app).get('/api/stats/top-active');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].betId).toBe(betId1);
    expect(res.body[0].activityCount).toBe(3);
  });
});

describe('GET /api/stats/user/:wallet', () => {
  const wallet = '0xwallet00000000000000000000000000000000001';

  it('returns zero stats for unknown wallet', async () => {
    const res = await request(app).get(`/api/stats/user/${wallet}`);
    expect(res.status).toBe(200);
    expect(res.body.marketsCreated).toBe(0);
    expect(res.body.betsPlaced).toBe(0);
    expect(res.body.votesCount).toBe(0);
  });

  it('counts markets created by wallet', async () => {
    await Bet.create([
      makeBet({ creator: wallet.toLowerCase() }),
      makeBet({ creator: wallet.toLowerCase() }),
    ]);

    const res = await request(app).get(`/api/stats/user/${wallet}`);
    expect(res.status).toBe(200);
    expect(res.body.marketsCreated).toBe(2);
  });

  it('counts bets placed and votes cast from Activity', async () => {
    const betId = '0xbet001';
    await Activity.create([
      makeActivity(wallet, ActorRole.BETTOR, ActivityType.BET, betId),
      makeActivity(wallet, ActorRole.BETTOR, ActivityType.BET, betId),
      makeActivity(wallet, ActorRole.VOTER, ActivityType.VOTE, betId),
    ]);

    const res = await request(app).get(`/api/stats/user/${wallet}`);
    expect(res.status).toBe(200);
    expect(res.body.betsPlaced).toBe(2);
    expect(res.body.votesCount).toBe(1);
  });

  /**
   * BUG: totalStaked uses $sum: "$amountUsdc" but amountUsdc is stored as a String
   * in the Activity model. MongoDB's $sum operator returns 0 for string fields.
   * Fix: either store amountUsdc as Number or convert in the aggregation pipeline.
   */
  it.failing('BUG: totalStaked is 0 because amountUsdc is a String and $sum cannot sum strings', async () => {
    const betId = '0xbet001';
    await Activity.create([
      makeActivity(wallet, ActorRole.BETTOR, ActivityType.BET, betId, { amountUsdc: '50000000' }),
      makeActivity(wallet, ActorRole.BETTOR, ActivityType.BET, betId, { amountUsdc: '30000000' }),
    ]);

    const res = await request(app).get(`/api/stats/user/${wallet}`);
    expect(res.status).toBe(200);
    // Should be 80000000, but is 0 because $sum on strings returns 0
    expect(res.body.totalStaked).toBe(80000000);
  });
});

describe('GET /api/stats/by-category', () => {
  it('groups bets by category with count and volume', async () => {
    await Bet.create([
      makeBet({ category: 1, totalBet: 100 }),
      makeBet({ category: 1, totalBet: 200 }),
      makeBet({ category: 2, totalBet: 500 }),
    ]);

    const res = await request(app).get('/api/stats/by-category');
    expect(res.status).toBe(200);
    expect(res.body['1']).toBeDefined();
    expect(res.body['1'].count).toBe(2);
    expect(res.body['1'].volume).toBe(300);
    expect(res.body['2'].count).toBe(1);
    expect(res.body['2'].volume).toBe(500);
  });

  it('returns empty object when no bets', async () => {
    const res = await request(app).get('/api/stats/by-category');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
  });
});
