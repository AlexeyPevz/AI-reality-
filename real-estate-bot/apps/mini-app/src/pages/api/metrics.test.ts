import handler from './metrics';

function mockReqRes(query: any = {}, headers: any = {}) {
  const req: any = { method: 'GET', query, headers };
  let statusCode = 200; let body: any;
  const res: any = {
    status: (code: number) => { statusCode = code; return res; },
    json: (b: any) => { body = b; return { statusCode, body }; }
  };
  return { req, res };
}

describe('metrics proxy', () => {
  test('returns 500 on error when backend unavailable', async () => {
    process.env.API_URL = 'http://127.0.0.1:1';
    const { req, res } = mockReqRes();
    const out: any = await handler(req as any, res as any);
    expect(out.statusCode).toBe(500);
    expect(out.body?.error).toBeDefined();
  });
});