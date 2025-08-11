import request from 'supertest';
import express from 'express';
import searchRoutes from './search.routes';

jest.mock('../middleware/auth', () => ({
  authenticateTelegram: (_req: any, _res: any, next: any) => next(),
}));

jest.mock('../services/search.service', () => ({
  searchByPreferences: jest.fn(async () => ([{ listingId: 'l1', matchScore: 9, breakdown: {}, explanation: '' }])),
}));

describe('search routes', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/search', searchRoutes);

  test('POST /api/search returns results', async () => {
    const res = await request(app).post('/api/search').send({ preferencesId: 'p1' });
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].listingId).toBe('l1');
  });

  test('POST /api/search requires preferencesId', async () => {
    const res = await request(app).post('/api/search').send({});
    expect(res.status).toBe(400);
  });
});