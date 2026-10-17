const { loginSchema, changePasswordSchema } = require('../../src/validators/auth.validators');

describe('authentication request validation', () => {
  test('normalizes login email', () => {
    expect(loginSchema.parse({ email: ' PERSON@EXAMPLE.COM ', password: 'secret' }).email).toBe('person@example.com');
  });
  test('rejects extra login properties', () => {
    expect(loginSchema.safeParse({ email: 'a@example.com', password: 'secret', role: 'ADMIN' }).success).toBe(false);
  });
  test('requires a strong new password', () => {
    expect(changePasswordSchema.safeParse({ currentPassword: 'old', newPassword: 'short' }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ currentPassword: 'old', newPassword: 'LongEnoughPassword123' }).success).toBe(true);
  });
});
