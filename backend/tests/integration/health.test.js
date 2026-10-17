process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-secret-that-is-at-least-thirty-two-characters';

const request = require('supertest');
const app = require('../../src/app');

describe('health endpoints', () => {
  test('GET / returns API identity', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.name).toBe('Institute ERP API');
  });

  test('GET /api/v1/health returns liveness without requiring database', async () => {
    const response = await request(app).get('/api/v1/health');
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('ok');
    expect(response.headers['x-request-id']).toBeTruthy();
  });

  test('unknown route returns standardized error', async () => {
    const response = await request(app).get('/not-a-real-route');
    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error.requestId).toBeTruthy();
  });
});
