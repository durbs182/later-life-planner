import { describe, test, expect } from 'vitest';
import { describeDcDrawdown } from '@/lib/dcDrawdownSummary';
import type { PlannerState } from '@/models/types';
import { bareCoupleState, dcOnlyState } from '../fixtures/states';
import { withFullLumpSum } from '../fixtures/helpers';

function withDc(state: PlannerState, person: 'person1' | 'person2', extra: Record<string, unknown> = {}): PlannerState {
  return {
    ...state,
    [person]: {
      ...state[person],
      incomeSources: {
        ...state[person].incomeSources,
        dcPension: { enabled: true, totalValue: 400_000, growthRate: 4, ...extra },
      },
    },
  };
}

describe('describeDcDrawdown', () => {
  test('default UFPLS text mentions the lump sum allowance limit', () => {
    const { startAge, startNote, text } = describeDcDrawdown(dcOnlyState(58, 400_000, 60), 'p1', true);
    expect(startAge).toBe(60);
    expect(startNote).toBe('(your financial independence age)');
    expect(text).toContain('25% of each withdrawal is tax-free');
    expect(text).toContain('£268,275 lump sum allowance');
    expect(text).toContain('fully taxable');
    expect(text).not.toContain('Contributions');
  });

  test('full lump sum says later withdrawals are fully taxable', () => {
    const state = withFullLumpSum(dcOnlyState(58, 400_000, 60), { p1: true });
    const { text } = describeDcDrawdown(state, 'p1', true);
    expect(text).toContain('At age 60, 25% of the pot (up to £268,275) is taken as a tax-free lump sum');
    expect(text).toContain('into your ISA, then your GIA');
    expect(text).toContain('Every withdrawal after that is fully taxable income');
    expect(text).not.toContain('Withdrawals before');
    expect(text).not.toContain('each withdrawal is tax-free');
  });

  test('lump sum after drawdown starts keeps earlier withdrawals partly tax-free', () => {
    const state = withFullLumpSum(dcOnlyState(58, 400_000, 60), { p1: { age: 63 } });
    const { text } = describeDcDrawdown(state, 'p1', true);
    expect(text).toContain('Withdrawals before age 63 are 25% tax-free.');
    expect(text).toContain('At age 63');
  });

  test('full lump sum is ignored without Pro, as in the projection', () => {
    const state = withFullLumpSum(dcOnlyState(58, 400_000, 60), { p1: true });
    const { text } = describeDcDrawdown(state, 'p1', false);
    expect(text).toContain('25% of each withdrawal is tax-free');
    expect(text).not.toContain('lump sum and moved');
  });

  test('partner drawdown starts at their age when the household reaches FI', () => {
    const base = withDc(withDc({ ...bareCoupleState(58, 55), fiAge: 60 }, 'person1'), 'person2');
    const { startAge, startNote } = describeDcDrawdown(base, 'p2', true);
    expect(startAge).toBe(57);
    expect(startNote).toBe('(when the household reaches financial independence)');
  });

  test('couple lump sum names the partner ISA and joint GIA', () => {
    const base = withDc(withDc({ ...bareCoupleState(58, 55), fiAge: 60 }, 'person1'), 'person2');
    const { text } = describeDcDrawdown(withFullLumpSum(base, { p2: true }), 'p2', true);
    expect(text).toContain("then your partner's unused ISA allowance, then the joint GIA");
  });

  test('contributions use the person’s own FI age and only show when contributing', () => {
    const base = withDc(
      { ...bareCoupleState(58, 55), fiAge: 60, p2FiAge: 62 },
      'person2',
      { sippContributionAnnualGross: 5_000 },
    );
    expect(describeDcDrawdown(base, 'p2', true).text).toContain('Contributions are projected until age 62.');

    const noContrib = withDc(base, 'person2', { workplaceContributionPercent: 5, workplaceSalary: 0 });
    expect(describeDcDrawdown(noContrib, 'p2', true).text).not.toContain('Contributions');
  });

  test('drawdown never starts before the current age', () => {
    const { startAge } = describeDcDrawdown(dcOnlyState(62, 400_000, 60), 'p1', true);
    expect(startAge).toBe(62);
  });
});
