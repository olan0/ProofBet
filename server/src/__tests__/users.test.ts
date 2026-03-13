import request from 'supertest';
import { ethers } from 'ethers';
import { createApp } from './testApp';

const app = createApp();

// Each test wallet owns its own address — signatures prove ownership
const wallet1 = ethers.Wallet.createRandom();
const wallet2 = ethers.Wallet.createRandom();

async function signAlias(wallet: ethers.HDNodeWallet, alias: string | null): Promise<{ signature: string; timestamp: number }> {
  const timestamp = Date.now();
  const signature = await wallet.signMessage(`proofbet:alias:${wallet.address}:${alias ?? ''}:${timestamp}`);
  return { signature, timestamp };
}

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/users/:wallet_address', () => {
  it('returns 404 for unknown wallet', async () => {
    const res = await request(app).get('/api/users/0xunknown');
    expect(res.status).toBe(404);
    expect(res.body.message).toBeDefined();
  });

  it('returns alias for known wallet', async () => {
    const { signature, timestamp } = await signAlias(wallet1, 'satoshi');
    await request(app).post('/api/users').send({
      wallet_address: wallet1.address, alias: 'satoshi', signature, timestamp,
    });

    const res = await request(app).get(`/api/users/${wallet1.address}`);
    expect(res.status).toBe(200);
    expect(res.body.alias).toBe('satoshi');
  });
});

// ─── POST ─────────────────────────────────────────────────────────────────────

describe('POST /api/users', () => {
  it('creates a new user and returns the record', async () => {
    const { signature, timestamp } = await signAlias(wallet1, 'nakamoto');
    const res = await request(app).post('/api/users').send({
      wallet_address: wallet1.address, alias: 'nakamoto', signature, timestamp,
    });

    expect(res.status).toBe(200);
    expect(res.body.alias).toBe('nakamoto');
    expect(res.body.wallet_address).toBe(wallet1.address);
  });

  it('returns 401 when signature is missing', async () => {
    const res = await request(app).post('/api/users').send({
      wallet_address: wallet1.address, alias: 'ghost',
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Signature required');
  });

  it('returns 400 when wallet_address is missing', async () => {
    const timestamp = Date.now();
    const signature = await wallet1.signMessage(`proofbet:alias::ghost:${timestamp}`);
    const res = await request(app).post('/api/users').send({ alias: 'ghost', signature, timestamp });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 401 when signature is from a different wallet (impostor)', async () => {
    const impostor = ethers.Wallet.createRandom();
    const timestamp = Date.now();
    // Impostor signs but claims to be wallet1
    const signature = await impostor.signMessage(`proofbet:alias:${wallet1.address}:hacker:${timestamp}`);

    const res = await request(app).post('/api/users').send({
      wallet_address: wallet1.address, alias: 'hacker', signature, timestamp,
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid or expired signature');
  });

  it('returns 401 when timestamp is older than 5 minutes (replay attack)', async () => {
    const staleTimestamp = Date.now() - 6 * 60 * 1000;
    const signature = await wallet1.signMessage(`proofbet:alias:${wallet1.address}:stale:${staleTimestamp}`);

    const res = await request(app).post('/api/users').send({
      wallet_address: wallet1.address, alias: 'stale', signature, timestamp: staleTimestamp,
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid or expired signature');
  });

  it('returns 401 when alias in body is tampered after signing', async () => {
    const timestamp = Date.now();
    const signature = await wallet1.signMessage(`proofbet:alias:${wallet1.address}:original:${timestamp}`);

    const res = await request(app).post('/api/users').send({
      wallet_address: wallet1.address, alias: 'tampered', signature, timestamp,
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid or expired signature');
  });

  it('returns 409 when alias is already taken by a different wallet', async () => {
    const sig1 = await signAlias(wallet1, 'taken_alias');
    await request(app).post('/api/users').send({
      wallet_address: wallet1.address, alias: 'taken_alias', ...sig1,
    });

    const sig2 = await signAlias(wallet2, 'taken_alias');
    const res = await request(app).post('/api/users').send({
      wallet_address: wallet2.address, alias: 'taken_alias', ...sig2,
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Alias already in use');
  });

  it('allows updating alias for the same wallet', async () => {
    const sig1 = await signAlias(wallet1, 'original');
    await request(app).post('/api/users').send({ wallet_address: wallet1.address, alias: 'original', ...sig1 });

    const sig2 = await signAlias(wallet1, 'updated');
    const res = await request(app).post('/api/users').send({ wallet_address: wallet1.address, alias: 'updated', ...sig2 });

    expect(res.status).toBe(200);
    expect(res.body.alias).toBe('updated');
  });

  it('allows the same wallet to reclaim its current alias', async () => {
    const sig1 = await signAlias(wallet1, 'myalias');
    await request(app).post('/api/users').send({ wallet_address: wallet1.address, alias: 'myalias', ...sig1 });

    const sig2 = await signAlias(wallet1, 'myalias');
    const res = await request(app).post('/api/users').send({ wallet_address: wallet1.address, alias: 'myalias', ...sig2 });

    expect(res.status).toBe(200);
    expect(res.body.alias).toBe('myalias');
  });

  it('clears alias when null is sent', async () => {
    const sig1 = await signAlias(wallet1, 'temporary');
    await request(app).post('/api/users').send({ wallet_address: wallet1.address, alias: 'temporary', ...sig1 });

    const sig2 = await signAlias(wallet1, null);
    const res = await request(app).post('/api/users').send({ wallet_address: wallet1.address, alias: null, ...sig2 });

    expect(res.status).toBe(200);
  });
});
