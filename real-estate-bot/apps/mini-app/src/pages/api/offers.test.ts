import handler from './offers';

function mockReqRes(query: any = {}, headers: any = {}) {
  const req: any = { method: 'GET', query, headers };
  let statusCode = 200; let location = '';
  const res: any = {
    status: (code: number) => { statusCode = code; return res; },
    json: (body: any) => ({ statusCode, body }),
    redirect: (url: string) => { location = url; return { statusCode: 302, location }; },
  };
  return { req, res };
}

describe('offers proxy', () => {
  test('builds redirect url', async () => {
    const { req, res } = mockReqRes({ type: 'mortgage', listingId: 'l1' });
    const out: any = await handler(req as any, res as any);
    expect(out.statusCode).toBe(302);
    expect(out.location).toContain('/api/offers/redirect');
  });
});