import { PENSION_RULES } from '@/config/financialConstants';
import { resolveP2FiAge, resolvePclsAges } from '@/financialEngine/pclsCrystallisation';
import type { PlannerState } from '@/models/types';

export interface DcDrawdownSummary {
  startAge: number;
  startNote: string;
  text: string;
}

/**
 * Describes how the projection draws one person's DC pension, matching the
 * engine: drawdown opens for both partners when person 1 reaches `fiAge`, a
 * full lump sum (Pro only) ends tax-free withdrawals, and contributions stop
 * at the person's own FI age.
 */
export function describeDcDrawdown(
  state: PlannerState,
  person: 'p1' | 'p2',
  proEnabled: boolean,
): DcDrawdownSummary {
  const isP1 = person === 'p1';
  const p = isP1 ? state.person1 : state.person2;
  const dc = p.incomeSources.dcPension;
  const couple = state.mode === 'couple';

  const startAge = Math.max(p.currentAge, p.currentAge + state.fiAge - state.person1.currentAge);
  const startNote = isP1 || !couple
    ? '(your financial independence age)'
    : '(when the household reaches financial independence)';

  const pct = Math.round(PENSION_RULES.UFPLS_TAX_FREE_FRACTION * 100);
  const lsa = `£${PENSION_RULES.PCLS_LUMP_SUM_ALLOWANCE.toLocaleString('en-GB')}`;
  const lumpAge = proEnabled ? resolvePclsAges(state)[person] : null;

  const sentences: string[] = [];
  if (lumpAge !== null) {
    if (lumpAge > startAge) sentences.push(`Withdrawals before age ${lumpAge} are ${pct}% tax-free.`);
    const destination = couple
      ? "into your ISA, then your partner's unused ISA allowance, then the joint GIA"
      : 'into your ISA, then your GIA';
    sentences.push(
      `At age ${lumpAge}, ${pct}% of the pot (up to ${lsa}) is taken as a tax-free lump sum and moved ${destination}.`,
      "Every withdrawal after that is fully taxable income. The rest of the pot stays invested until it's needed.",
    );
  } else {
    sentences.push(
      `${pct}% of each withdrawal is tax-free and the rest is taxable income, until your tax-free cash reaches the ${lsa} lump sum allowance.`,
      "After that, withdrawals are fully taxable. The pot stays invested until it's needed.",
    );
  }

  const contributionsUntil = isP1 ? state.fiAge : resolveP2FiAge(state);
  const contributes = ((dc.workplaceContributionPercent ?? 0) > 0 && (dc.workplaceSalary ?? 0) > 0)
    || (dc.sippContributionAnnualGross ?? 0) > 0;
  if (contributes && contributionsUntil > p.currentAge) {
    sentences.push(`Contributions are projected until age ${contributionsUntil}.`);
  }

  return { startAge, startNote, text: sentences.join(' ') };
}
