const { ACTIVITY_STATUS, WORKFLOW_TRANSITIONS } = require('../../src/constants/workflow');

describe('activity workflow contract', () => {
  test('contains the canonical lifecycle statuses', () => {
    expect(ACTIVITY_STATUS).toEqual(['PLANNED', 'ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'RETURNED', 'VERIFIED', 'CLOSED']);
    expect(ACTIVITY_STATUS).not.toContain('OVERDUE');
  });
  test('allows only defined lifecycle transitions', () => {
    expect(WORKFLOW_TRANSITIONS.PLANNED).toEqual(['ASSIGNED']);
    expect(WORKFLOW_TRANSITIONS.SUBMITTED).toEqual(['RETURNED', 'VERIFIED']);
    expect(WORKFLOW_TRANSITIONS.RETURNED).toEqual(['IN_PROGRESS']);
    expect(WORKFLOW_TRANSITIONS.CLOSED).toEqual([]);
  });
});
