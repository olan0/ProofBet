import request from 'supertest';
import Bet from '../models/Bet';
import { createApp } from './testApp';

const app = createApp();

const makeBet = (overrides = {}) => ({
  betId: `0x${Math.random().toString(16).slice(2).padEnd(40, '0')}`,
  creator: '0xabc0000000000000000000000000000000000001',
  title: 'Test Bet',
  description: 'A test bet',
  status: 0,
  category: 1,
  proofType: 1,
  totalBet: 100,
  totalParticipants: 2,
  yesVotes: 0,
  noVotes: 0,
  ...overrides,
});

describe('GET /api/bets', () => {
  describe('Basic listing', () => {
    it('returns empty list when no bets exist', async () => {
      const res = await request(app).get('/api/bets');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.pagination.hasNext).toBe(false);
      expect(res.body.pagination.nextCursor).toBeNull();
    });

    it('returns all bets with pagination metadata', async () => {
      await Bet.create([makeBet({ title: 'Bet A' }), makeBet({ title: 'Bet B' })]);

      const res = await request(app).get('/api/bets');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination.limit).toBe(20);
    });
  });

  describe('Filtering', () => {
    it('filters by exact status', async () => {
      await Bet.create([
        makeBet({ status: 0 }),
        makeBet({ status: 1 }),
        makeBet({ status: 1 }),
      ]);

      const res = await request(app).get('/api/bets?status=1');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data.every((b: any) => b.status === 1)).toBe(true);
    });

    it('filters by exact category', async () => {
      await Bet.create([makeBet({ category: 1 }), makeBet({ category: 2 }), makeBet({ category: 2 })]);

      const res = await request(app).get('/api/bets?category=2');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('filters by exact creator (case-insensitive via address type)', async () => {
      const addr = '0xabc0000000000000000000000000000000000001';
      await Bet.create([makeBet({ creator: addr }), makeBet({ creator: '0xother' })]);

      const res = await request(app).get(`/api/bets?creator=${addr}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('searches by partial title with contains_title', async () => {
      await Bet.create([
        makeBet({ title: 'Will Ethereum reach $5000?' }),
        makeBet({ title: 'Will Bitcoin hit 100k?' }),
        makeBet({ title: 'Will Ethereum collapse?' }),
      ]);

      const res = await request(app).get('/api/bets?contains_title=ethereum');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('contains_ search is case-insensitive', async () => {
      await Bet.create([makeBet({ title: 'Ethereum Prediction' })]);

      const res = await request(app).get('/api/bets?contains_title=ETHEREUM');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('filters by min_totalBet (lower bound only)', async () => {
      await Bet.create([
        makeBet({ totalBet: 5 }),
        makeBet({ totalBet: 50 }),
        makeBet({ totalBet: 200 }),
      ]);

      const res = await request(app).get('/api/bets?min_totalBet=20');
      expect(res.status).toBe(200);
      expect(res.body.data.every((b: any) => b.totalBet >= 20)).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    it('filters by max_totalBet (upper bound only)', async () => {
      await Bet.create([
        makeBet({ totalBet: 5 }),
        makeBet({ totalBet: 50 }),
        makeBet({ totalBet: 200 }),
      ]);

      const res = await request(app).get('/api/bets?max_totalBet=100');
      expect(res.status).toBe(200);
      expect(res.body.data.every((b: any) => b.totalBet <= 100)).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    /**
     * BUG: When both min_ and max_ are provided for the same field,
     * the second one overwrites the first because both do:
     *   match[field] = { $gte: val }   then   match[field] = { $lte: val }
     * The fix is to merge: match[field] = { ...match[field], $lte: val }
     */
    it.failing('BUG: min_ and max_ combined range filter loses lower bound', async () => {
      await Bet.create([
        makeBet({ totalBet: 5 }),
        makeBet({ totalBet: 50 }),
        makeBet({ totalBet: 200 }),
      ]);

      const res = await request(app).get('/api/bets?min_totalBet=20&max_totalBet=100');
      expect(res.status).toBe(200);
      // Should return only the 50-bet, but currently also returns the 5-bet
      // because max_ overwrites min_, leaving only { $lte: 100 }
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].totalBet).toBe(50);
    });
  });

  describe('Sorting', () => {
    it('sorts by createdAt descending by default', async () => {
      await Bet.create([
        makeBet({ title: 'First', createdAt: new Date('2024-01-01') }),
        makeBet({ title: 'Second', createdAt: new Date('2024-06-01') }),
        makeBet({ title: 'Third', createdAt: new Date('2024-12-01') }),
      ]);

      const res = await request(app).get('/api/bets');
      expect(res.status).toBe(200);
      expect(res.body.data[0].title).toBe('Third');
      expect(res.body.data[2].title).toBe('First');
    });

    it('sorts ascending with order=asc', async () => {
      await Bet.create([
        makeBet({ title: 'First', createdAt: new Date('2024-01-01') }),
        makeBet({ title: 'Third', createdAt: new Date('2024-12-01') }),
      ]);

      const res = await request(app).get('/api/bets?sort=createdAt&order=asc');
      expect(res.status).toBe(200);
      expect(res.body.data[0].title).toBe('First');
    });

    it('sorts by totalBet descending', async () => {
      await Bet.create([
        makeBet({ totalBet: 10 }),
        makeBet({ totalBet: 500 }),
        makeBet({ totalBet: 100 }),
      ]);

      const res = await request(app).get('/api/bets?sort=totalBet&order=desc');
      expect(res.status).toBe(200);
      expect(res.body.data[0].totalBet).toBe(500);
    });
  });

  describe('Pagination', () => {
    it('respects limit parameter', async () => {
      await Bet.create(Array.from({ length: 5 }, (_, i) => makeBet({ title: `Bet ${i}` })));

      const res = await request(app).get('/api/bets?limit=2');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination.hasNext).toBe(true);
      expect(res.body.pagination.nextCursor).not.toBeNull();
    });

    it('caps limit at 100', async () => {
      const res = await request(app).get('/api/bets?limit=999');
      expect(res.status).toBe(200);
      expect(res.body.pagination.limit).toBe(100);
    });

    it('cursor pagination fetches next page', async () => {
      // Create 4 bets with distinct timestamps
      const base = new Date('2024-01-01').getTime();
      for (let i = 0; i < 4; i++) {
        await Bet.create(makeBet({ createdAt: new Date(base + i * 1000) }));
      }

      const first = await request(app).get('/api/bets?limit=2&sort=createdAt&order=desc');
      expect(first.body.pagination.hasNext).toBe(true);
      const cursor = first.body.pagination.nextCursor;

      const second = await request(app).get(`/api/bets?limit=2&sort=createdAt&order=desc&cursor=${encodeURIComponent(cursor)}`);
      expect(second.status).toBe(200);
      expect(second.body.data).toHaveLength(2);
      // No overlap between pages
      const firstIds = first.body.data.map((b: any) => b.betId);
      const secondIds = second.body.data.map((b: any) => b.betId);
      expect(firstIds.some((id: string) => secondIds.includes(id))).toBe(false);
    });
  });

  describe('User + activity filter', () => {
    /**
     * BUG: applyUserActivityFilter() is defined but never called in the route handler.
     * Querying with ?user=...&activity=creator should filter to only that creator's bets,
     * but currently all bets are returned.
     */
    it.failing('BUG: activity=creator should only return bets by that creator', async () => {
      const creator1 = '0x1111111111111111111111111111111111111111';
      const creator2 = '0x2222222222222222222222222222222222222222';
      await Bet.create([
        makeBet({ creator: creator1 }),
        makeBet({ creator: creator2 }),
        makeBet({ creator: creator2 }),
      ]);

      const res = await request(app).get(`/api/bets?user=${creator1}&activity=creator`);
      expect(res.status).toBe(200);
      // Should return only 1 bet, but returns all 3 because applyUserActivityFilter is never called
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].creator).toBe(creator1);
    });
  });
});
