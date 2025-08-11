import request from 'supertest';
import app from './index';

describe('API server basic routes', () => {
  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /unknown returns 404', async () => {
    const res = await request(app).get('/unknown-path');
    expect(res.status).toBe(404);
  });
});