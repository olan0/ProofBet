import request from 'supertest';
import Activity, { ActivityType, ActorRole } from '../models/Activity';
import { createApp } from './testApp';

const app = createApp();

const ACTOR1 = '0xaaaa000000000000000000000000000000000001';
const ACTOR2 = '0xbbbb000000000000000000000000000000000002';

const makeActivity = (overrides = {}) => ({
  txHash: `0x${Math.random().toString(16).slice(2).padEnd(64, '0')}`,
  blockNumber: 100,
  timestamp: new Date(),
  betId: '0xbetabc1234',
  actor: ACTOR1,
  role: ActorRole.BETTOR,
  type: ActivityType.BET,
  ...overrides,
});

describe('GET /api/activity', () => {
  describe('Validation', () => {
    it('returns 400 when actor is missing', async () => {
      const res = await request(app).get('/api/activity');
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('returns 200 with empty list when actor has no activities', async () => {
      const res = await request(app).get(`/api/activity?actor=${ACTOR1}`);
      expect(res.status).toBe(200);
      expect(res.body.items).toEqual([]);
      expect(res.body.pageInfo.hasNext).toBe(false);
    });
  });

  describe('Filtering by actor', () => {
    it('returns only activities for the specified actor', async () => {
      await Activity.create([
        makeActivity({ actor: ACTOR1 }),
        makeActivity({ actor: ACTOR1 }),
        makeActivity({ actor: ACTOR2 }),
      ]);

      const res = await request(app).get(`/api/activity?actor=${ACTOR1}`);
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items.every((a: any) => a.actor === ACTOR1.toLowerCase())).toBe(true);
    });

    it('is case-insensitive on actor address', async () => {
      await Activity.create(makeActivity({ actor: ACTOR1.toLowerCase() }));

      const res = await request(app).get(`/api/activity?actor=${ACTOR1.toUpperCase()}`);
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
    });
  });

  describe('Filtering by type (role)', () => {
    beforeEach(async () => {
      await Activity.create([
        makeActivity({ actor: ACTOR1, role: ActorRole.CREATOR, type: ActivityType.CREATE }),
        makeActivity({ actor: ACTOR1, role: ActorRole.BETTOR, type: ActivityType.BET }),
        makeActivity({ actor: ACTOR1, role: ActorRole.VOTER, type: ActivityType.VOTE }),
      ]);
    });

    it('filters by single role type=1 (CREATOR)', async () => {
      const res = await request(app).get(`/api/activity?actor=${ACTOR1}&type=1`);
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].role).toBe(ActorRole.CREATOR);
    });

    it('filters by single role type=2 (BETTOR)', async () => {
      const res = await request(app).get(`/api/activity?actor=${ACTOR1}&type=2`);
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].role).toBe(ActorRole.BETTOR);
    });

    it('filters by multiple roles with pipe separator type=1|2', async () => {
      const res = await request(app).get(`/api/activity?actor=${ACTOR1}&type=1|2`);
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
    });

    it('returns all roles when type is omitted', async () => {
      const res = await request(app).get(`/api/activity?actor=${ACTOR1}`);
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(3);
    });
  });

  describe('Sorting and pagination', () => {
    it('returns activities sorted by timestamp descending', async () => {
      const base = new Date('2024-01-01').getTime();
      await Activity.create([
        makeActivity({ actor: ACTOR1, timestamp: new Date(base) }),
        makeActivity({ actor: ACTOR1, timestamp: new Date(base + 2000) }),
        makeActivity({ actor: ACTOR1, timestamp: new Date(base + 1000) }),
      ]);

      const res = await request(app).get(`/api/activity?actor=${ACTOR1}`);
      expect(res.status).toBe(200);
      const timestamps = res.body.items.map((a: any) => new Date(a.timestamp).getTime());
      expect(timestamps[0]).toBeGreaterThan(timestamps[1]);
      expect(timestamps[1]).toBeGreaterThan(timestamps[2]);
    });

    it('respects limit and sets hasNext=true', async () => {
      const base = new Date('2024-01-01').getTime();
      for (let i = 0; i < 4; i++) {
        await Activity.create(makeActivity({ actor: ACTOR1, timestamp: new Date(base + i * 1000) }));
      }

      const res = await request(app).get(`/api/activity?actor=${ACTOR1}&limit=2`);
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.pageInfo.hasNext).toBe(true);
      expect(res.body.pageInfo.nextCursor).not.toBeNull();
    });

    it('caps limit at 50', async () => {
      const res = await request(app).get(`/api/activity?actor=${ACTOR1}&limit=999`);
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeLessThanOrEqual(50);
    });

    it('cursor pagination fetches the next page', async () => {
      const base = new Date('2024-01-01').getTime();
      for (let i = 0; i < 4; i++) {
        await Activity.create(makeActivity({ actor: ACTOR1, timestamp: new Date(base + i * 1000) }));
      }

      const first = await request(app).get(`/api/activity?actor=${ACTOR1}&limit=2`);
      expect(first.body.pageInfo.hasNext).toBe(true);
      const cursor = first.body.pageInfo.nextCursor;

      const second = await request(app).get(
        `/api/activity?actor=${ACTOR1}&limit=2&cursor=${encodeURIComponent(cursor)}`
      );
      expect(second.status).toBe(200);
      expect(second.body.items).toHaveLength(2);
      // No overlap
      const firstIds = first.body.items.map((a: any) => a._id);
      const secondIds = second.body.items.map((a: any) => a._id);
      expect(firstIds.some((id: string) => secondIds.includes(id))).toBe(false);
    });
  });
});
