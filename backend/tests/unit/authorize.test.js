const { authorize } = require('../../src/middleware/authorize');

describe('role authorization middleware', () => {
  test('permits a role explicitly listed on the route', () => {
    const req = { user: { role: 'PRINCIPAL' } };
    const next = jest.fn();
    authorize('DIRECTOR', 'PRINCIPAL')(req, {}, next);
    expect(next).toHaveBeenCalledWith();
  });

  test('denies an authenticated role that is not allowed', () => {
    const req = { user: { role: 'FACULTY' } };
    const next = jest.fn();
    authorize('ADMIN')(req, {}, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
  });

  test('rejects requests without an authenticated user', () => {
    const next = jest.fn();
    authorize('ADMIN')({}, {}, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401, code: 'AUTHENTICATION_REQUIRED' });
  });
});
