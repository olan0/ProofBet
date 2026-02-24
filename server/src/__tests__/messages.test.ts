// messageRoutes imports `io` from `../server`, so we mock that module
// to prevent the real server.ts (with DB connection + EventSync) from loading.
jest.mock('../server');

import request from 'supertest';
import express from 'express';
import messageRoutes from '../routes/messageRoutes';

function createMessageApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/messages', messageRoutes);
  return app;
}

const app = createMessageApp();

const BET_ADDR = '0xbet0000000000000000000000000000000000001';
const SENDER   = '0xsender00000000000000000000000000000001';

describe('GET /api/messages', () => {
  it('returns empty list for a bet with no messages', async () => {
    const res = await request(app).get(`/api/messages?bet_address=${BET_ADDR}`);
    expect(res.status).toBe(200);
    expect(res.body.messages).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('returns messages for the given bet_address', async () => {
    await request(app).post('/api/messages').send({
      bet_address: BET_ADDR,
      sender_address: SENDER,
      message: 'Hello from test',
    });

    const res = await request(app).get(`/api/messages?bet_address=${BET_ADDR}`);
    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(res.body.messages[0].message).toBe('Hello from test');
  });

  it('does not return messages from a different bet_address', async () => {
    const otherBet = '0xother00000000000000000000000000000000002';
    await request(app).post('/api/messages').send({
      bet_address: otherBet,
      sender_address: SENDER,
      message: 'Message for other bet',
    });

    const res = await request(app).get(`/api/messages?bet_address=${BET_ADDR}`);
    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(0);
  });

  it('filters by sender_address', async () => {
    const otherSender = '0xother00000000000000000000000000000000099';
    await request(app).post('/api/messages').send({ bet_address: BET_ADDR, sender_address: SENDER, message: 'From sender 1' });
    await request(app).post('/api/messages').send({ bet_address: BET_ADDR, sender_address: otherSender, message: 'From sender 2' });

    const res = await request(app).get(`/api/messages?bet_address=${BET_ADDR}&sender_address=${SENDER}`);
    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(1);
    expect(res.body.messages[0].sender_address).toBe(SENDER);
  });

  it('searches message content with search param', async () => {
    await request(app).post('/api/messages').send({ bet_address: BET_ADDR, sender_address: SENDER, message: 'Ethereum will moon' });
    await request(app).post('/api/messages').send({ bet_address: BET_ADDR, sender_address: SENDER, message: 'Bitcoin is better' });

    const res = await request(app).get(`/api/messages?bet_address=${BET_ADDR}&search=ethereum`);
    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(1);
    expect(res.body.messages[0].message).toContain('Ethereum');
  });

  it('paginates with page and limit params', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/messages').send({
        bet_address: BET_ADDR,
        sender_address: SENDER,
        message: `Message ${i}`,
      });
    }

    const res = await request(app).get(`/api/messages?bet_address=${BET_ADDR}&limit=2&page=1`);
    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(2);
    expect(res.body.total).toBe(5);
  });
});

describe('POST /api/messages', () => {
  it('creates a message and returns 201', async () => {
    const res = await request(app).post('/api/messages').send({
      bet_address: BET_ADDR,
      sender_address: SENDER,
      message: 'New message',
      sender_alias: 'tester',
    });

    expect(res.status).toBe(201);
    expect(res.body.bet_address).toBe(BET_ADDR);
    expect(res.body.sender_address).toBe(SENDER);
    expect(res.body.message).toBe('New message');
    expect(res.body.sender_alias).toBe('tester');
    expect(res.body.timestamp).toBeDefined();
  });

  it('emits newMessage event via socket.io', async () => {
    const { io } = require('../server');

    await request(app).post('/api/messages').send({
      bet_address: BET_ADDR,
      sender_address: SENDER,
      message: 'Socket test',
    });

    expect(io.emit).toHaveBeenCalledWith('newMessage', expect.objectContaining({
      message: 'Socket test',
    }));
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).post('/api/messages').send({
      sender_address: SENDER,
      // missing bet_address and message
    });
    expect(res.status).toBe(400);
  });
});
