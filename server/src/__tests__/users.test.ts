import request from 'supertest';
import { createApp } from './testApp';

const app = createApp();

describe('GET /api/users/:wallet_address', () => {
  it('returns 404 for unknown wallet', async () => {
    const res = await request(app).get('/api/users/0xunknown');
    expect(res.status).toBe(404);
    expect(res.body.message).toBeDefined();
  });

  it('returns alias for known wallet', async () => {
    await request(app).post('/api/users').send({
      wallet_address: '0xabc123',
      alias: 'satoshi',
    });

    const res = await request(app).get('/api/users/0xabc123');
    expect(res.status).toBe(200);
    expect(res.body.alias).toBe('satoshi');
  });
});

describe('POST /api/users', () => {
  it('creates a new user and returns the record', async () => {
    const res = await request(app).post('/api/users').send({
      wallet_address: '0xwallet001',
      alias: 'nakamoto',
    });

    expect(res.status).toBe(200);
    expect(res.body.alias).toBe('nakamoto');
    expect(res.body.wallet_address).toBe('0xwallet001');
  });

  it('returns 400 when wallet_address is missing', async () => {
    const res = await request(app).post('/api/users').send({ alias: 'ghost' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 when alias is missing', async () => {
    const res = await request(app).post('/api/users').send({ wallet_address: '0xwallet002' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 409 when alias is already taken by a different wallet', async () => {
    await request(app).post('/api/users').send({
      wallet_address: '0xwallet001',
      alias: 'taken_alias',
    });

    const res = await request(app).post('/api/users').send({
      wallet_address: '0xwallet002',
      alias: 'taken_alias',
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Alias already in use');
  });

  it('allows updating alias for the same wallet', async () => {
    await request(app).post('/api/users').send({
      wallet_address: '0xwallet001',
      alias: 'original',
    });

    const res = await request(app).post('/api/users').send({
      wallet_address: '0xwallet001',
      alias: 'updated',
    });

    expect(res.status).toBe(200);
    expect(res.body.alias).toBe('updated');
  });

  it('allows the same wallet to reclaim its current alias', async () => {
    await request(app).post('/api/users').send({
      wallet_address: '0xwallet001',
      alias: 'myalias',
    });

    const res = await request(app).post('/api/users').send({
      wallet_address: '0xwallet001',
      alias: 'myalias',
    });

    expect(res.status).toBe(200);
    expect(res.body.alias).toBe('myalias');
  });
});
