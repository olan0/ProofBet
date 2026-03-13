// messageRoutes imports `io` from `../server`, so we mock that module
// to prevent the real server.ts (with DB connection + EventSync) from loading.
jest.mock('../server');

import request from 'supertest';
import express from 'express';
import { ethers } from 'ethers';
import messageRoutes from '../routes/messageRoutes';

function createMessageApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/messages', messageRoutes);
  return app;
}

const app = createMessageApp();

const BET_ADDR = '0xbet0000000000000000000000000000000000001';

// Real wallet — produces valid signatures in tests
const wallet = ethers.Wallet.createRandom();
const SENDER = wallet.address;

async function signMsg(betAddress: string, message: string): Promise<{ signature: string; timestamp: number }> {
  const timestamp = Date.now();
  const signature = await wallet.signMessage(`proofbet:message:${betAddress}:${message}:${timestamp}`);
  return { signature, timestamp };
}

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/messages', () => {
  it('returns empty list for a bet with no messages', async () => {
    const res = await request(app).get(`/api/messages?bet_address=${BET_ADDR}`);
    expect(res.status).toBe(200);
    expect(res.body.messages).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('returns messages for the given bet_address', async () => {
    const { signature, timestamp } = await signMsg(BET_ADDR, 'Hello from test');
    await request(app).post('/api/messages').send({
      bet_address: BET_ADDR, sender_address: SENDER,
      message: 'Hello from test', signature, timestamp,
    });

    const res = await request(app).get(`/api/messages?bet_address=${BET_ADDR}`);
    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(1);
    expect(res.body.total).toBe(1);
    expect(res.body.messages[0].message).toBe('Hello from test');
  });

  it('does not return messages from a different bet_address', async () => {
    const otherBet = '0xother00000000000000000000000000000000002';
    const { signature, timestamp } = await signMsg(otherBet, 'Message for other bet');
    await request(app).post('/api/messages').send({
      bet_address: otherBet, sender_address: SENDER,
      message: 'Message for other bet', signature, timestamp,
    });

    const res = await request(app).get(`/api/messages?bet_address=${BET_ADDR}`);
    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(0);
  });

  it('filters by sender_address', async () => {
    const wallet2 = ethers.Wallet.createRandom();
    const ts2 = Date.now();
    const sig2 = await wallet2.signMessage(`proofbet:message:${BET_ADDR}:From sender 2:${ts2}`);
    const sig1 = await signMsg(BET_ADDR, 'From sender 1');

    await request(app).post('/api/messages').send({ bet_address: BET_ADDR, sender_address: SENDER, message: 'From sender 1', ...sig1 });
    await request(app).post('/api/messages').send({ bet_address: BET_ADDR, sender_address: wallet2.address, message: 'From sender 2', signature: sig2, timestamp: ts2 });

    const res = await request(app).get(`/api/messages?bet_address=${BET_ADDR}&sender_address=${SENDER}`);
    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(1);
    expect(res.body.messages[0].sender_address).toBe(SENDER);
  });

  it('searches message content with search param', async () => {
    const sig1 = await signMsg(BET_ADDR, 'Ethereum will moon');
    const sig2 = await signMsg(BET_ADDR, 'Bitcoin is better');

    await request(app).post('/api/messages').send({ bet_address: BET_ADDR, sender_address: SENDER, message: 'Ethereum will moon', ...sig1 });
    await request(app).post('/api/messages').send({ bet_address: BET_ADDR, sender_address: SENDER, message: 'Bitcoin is better', ...sig2 });

    const res = await request(app).get(`/api/messages?bet_address=${BET_ADDR}&search=ethereum`);
    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(1);
    expect(res.body.messages[0].message).toContain('Ethereum');
  });

  it('paginates with page and limit params', async () => {
    for (let i = 0; i < 5; i++) {
      const text = `Message ${i}`;
      const { signature, timestamp } = await signMsg(BET_ADDR, text);
      await request(app).post('/api/messages').send({ bet_address: BET_ADDR, sender_address: SENDER, message: text, signature, timestamp });
    }

    const res = await request(app).get(`/api/messages?bet_address=${BET_ADDR}&limit=2&page=1`);
    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(2);
    expect(res.body.total).toBe(5);
  });
});

// ─── POST ─────────────────────────────────────────────────────────────────────

describe('POST /api/messages', () => {
  it('creates a message and returns 201 with valid signature', async () => {
    const { signature, timestamp } = await signMsg(BET_ADDR, 'New message');
    const res = await request(app).post('/api/messages').send({
      bet_address: BET_ADDR,
      sender_address: SENDER,
      message: 'New message',
      signature,
      timestamp,
    });

    expect(res.status).toBe(201);
    expect(res.body.bet_address).toBe(BET_ADDR);
    expect(res.body.sender_address).toBe(SENDER);
    expect(res.body.message).toBe('New message');
    expect(res.body.timestamp).toBeDefined();
  });

  it('emits newMessage event via socket.io', async () => {
    const { io } = require('../server');
    const { signature, timestamp } = await signMsg(BET_ADDR, 'Socket test');

    await request(app).post('/api/messages').send({
      bet_address: BET_ADDR, sender_address: SENDER,
      message: 'Socket test', signature, timestamp,
    });

    expect(io.emit).toHaveBeenCalledWith('newMessage', expect.objectContaining({ message: 'Socket test' }));
  });

  it('returns 401 when signature is missing', async () => {
    const res = await request(app).post('/api/messages').send({
      bet_address: BET_ADDR, sender_address: SENDER, message: 'No sig',
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Signature required');
  });

  it('returns 401 when signature is from a different wallet (impostor)', async () => {
    const impostor = ethers.Wallet.createRandom();
    const timestamp = Date.now();
    // Impostor signs but claims to be SENDER
    const signature = await impostor.signMessage(`proofbet:message:${BET_ADDR}:Fake message:${timestamp}`);

    const res = await request(app).post('/api/messages').send({
      bet_address: BET_ADDR, sender_address: SENDER,
      message: 'Fake message', signature, timestamp,
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid or expired signature');
  });

  it('returns 401 when timestamp is older than 5 minutes (replay attack)', async () => {
    const staleTimestamp = Date.now() - 6 * 60 * 1000;
    const signature = await wallet.signMessage(`proofbet:message:${BET_ADDR}:Stale message:${staleTimestamp}`);

    const res = await request(app).post('/api/messages').send({
      bet_address: BET_ADDR, sender_address: SENDER,
      message: 'Stale message', signature, timestamp: staleTimestamp,
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid or expired signature');
  });

  it('returns 401 when message body is tampered after signing', async () => {
    const { signature, timestamp } = await signMsg(BET_ADDR, 'Original message');

    const res = await request(app).post('/api/messages').send({
      bet_address: BET_ADDR, sender_address: SENDER,
      message: 'Tampered message', signature, timestamp,
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid or expired signature');
  });

  it('returns 400 when bet_address and message are missing (signature check passes, field validation fails)', async () => {
    // Sign with empty fields to pass sig verification, then rely on MessageService to reject
    const timestamp = Date.now();
    const signature = await wallet.signMessage(`proofbet:message:undefined:undefined:${timestamp}`);
    const res = await request(app).post('/api/messages').send({
      sender_address: SENDER, signature, timestamp,
      // bet_address and message intentionally omitted
    });
    expect(res.status).toBe(400);
  });
});
