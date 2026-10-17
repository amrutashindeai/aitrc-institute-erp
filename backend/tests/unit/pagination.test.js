const { parsePagination } = require('../../src/utils/pagination');

describe('pagination contract', () => {
  test('uses defaults', () => expect(parsePagination({})).toMatchObject({ page: 1, limit: 20, skip: 0 }));
  test('calculates offsets', () => expect(parsePagination({ page: '3', limit: '10' })).toMatchObject({ page: 3, limit: 10, skip: 20 }));
  test('rejects invalid and excessive limits', () => {
    expect(() => parsePagination({ page: '0' })).toThrow();
    expect(() => parsePagination({ limit: '101' })).toThrow();
  });
});
