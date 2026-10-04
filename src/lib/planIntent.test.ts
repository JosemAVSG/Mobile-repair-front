import { beforeEach, describe, expect, it } from 'vitest';
import { clearPlanIntent, getPlanIntent, parsePlan, savePlanIntentFromSearch } from './planIntent';

beforeEach(() => localStorage.clear());

describe('planIntent', () => {
  it('parses plans case-insensitively and rejects unknown values', () => {
    expect(parsePlan('pro')).toBe('PRO');
    expect(parsePlan('Basico')).toBe('BASICO');
    expect(parsePlan('empresarial')).toBeNull();
    expect(parsePlan(null)).toBeNull();
  });

  it('stores the plan from the query string and clears it', () => {
    savePlanIntentFromSearch('?plan=pro');
    expect(getPlanIntent()).toBe('PRO');
    clearPlanIntent();
    expect(getPlanIntent()).toBeNull();
  });

  it('ignores an invalid plan and keeps what was stored', () => {
    savePlanIntentFromSearch('?plan=basico');
    savePlanIntentFromSearch('?plan=gold');
    expect(getPlanIntent()).toBe('BASICO');
  });
});
