import type {
  PlannerState, LifeStage, SpendingCategory,
  PersonIncomeSources, PersonAssets, RlssStandard,
} from '@/models/types';
import {
  RLSS, DEFAULT_ASSUMPTIONS, STATE_PENSION, PENSION_RULES,
} from '@/config/financialConstants';

// ─── Re-export RLSS for components that import from here ─────────────────────
export { RLSS as RLSS_STANDARDS };

// ─── Date of birth utilities ──────────────────────────────────────────────────

/**
 * Compute age in whole years from an ISO date string (YYYY-MM-DD).
 * Falls back to the provided default if the string is empty/invalid.
 */
export function ageFromDOB(dob: string, fallback: number = DEFAULT_ASSUMPTIONS.DEFAULT_AGE): number {
  if (!dob) return fallback;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return fallback;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return Math.max(0, age);
}

/**
 * Produce an ISO date string for a person currently aged `age`.
 * Used when creating default state before the user enters their DOB.
 */
export function dobFromAge(age: number): string {
  const year = new Date().getFullYear() - age;
  return `${year}-01-01`;
}

// ─── Life stages ─────────────────────────────────────────────────────────────

export function buildDefaultLifeStages(currentAge: number): LifeStage[] {
  const activeEnd = Math.min(64, Math.max(currentAge + 1, 60));
  return [
    { id: 'active',  label: 'Active Years',      startAge: currentAge,    endAge: activeEnd, color: '#f97316' },
    { id: 'gradual', label: 'Gradual Transition', startAge: activeEnd + 1, endAge: 75,        color: '#10b981' },
    { id: 'later',   label: 'Later Years',         startAge: 76,            endAge: 95,        color: '#8b5cf6' },
  ];
}

// ─── Spending categories ──────────────────────────────────────────────────────
//
// Tiers match the product prompt specification:
//   essential     → Essential  (housing, food, utilities, transport, insurance, healthcare)
//   moderate      → Lifestyle  (travel, dining, hobbies)
//   aspirational  → Family & Giving (family support, charity, gifts)
//   variable      → Other      (home improvements, major purchases, buffer)

function sa(a: number, g: number, l: number): Record<string, number> {
  return { active: a, gradual: g, later: l };
}

export function buildDefaultCategories(): SpendingCategory[] {
  return [
    // ── Essential ──────────────────────────────────────────────────────────
    { id: 'housing',     name: 'Housing',                 tier: 'essential',    icon: '🏠', maxValue: 30000, description: 'Rent, mortgage or property running costs',   amounts: sa(10000, 9000, 7500) },
    { id: 'food',        name: 'Food & Groceries',         tier: 'essential',    icon: '🛒', maxValue: 12000, description: 'Weekly shopping and household basics',        amounts: sa(4800,  4400, 3800) },
    { id: 'utilities',   name: 'Utilities & Bills',        tier: 'essential',    icon: '⚡', maxValue: 8000,  description: 'Energy, water, council tax, broadband',       amounts: sa(3200,  3000, 2800) },
    { id: 'transport',   name: 'Transport',                tier: 'essential',    icon: '🚗', maxValue: 10000, description: 'Car, fuel, public transport',                 amounts: sa(3500,  2500, 1500) },
    { id: 'insurance',   name: 'Insurance',                tier: 'essential',    icon: '🛡️', maxValue: 6000,  description: 'Home, car, life, travel insurance',          amounts: sa(1800,  1800, 2000) },
    { id: 'healthcare',  name: 'Healthcare',               tier: 'essential',    icon: '🏥', maxValue: 12000, description: 'Dental, opticians, prescriptions, top-ups',  amounts: sa(1200,  1800, 3500) },
    // ── Lifestyle ──────────────────────────────────────────────────────────
    { id: 'eating_out',  name: 'Dining Out',               tier: 'moderate',     icon: '🍽️', maxValue: 8000,  description: 'Restaurants, cafés, takeaways',              amounts: sa(1800,  1500, 1000) },
    { id: 'uk_travel',   name: 'UK Breaks',                tier: 'moderate',     icon: '🚂', maxValue: 10000, description: 'UK holidays, weekend breaks, day trips',      amounts: sa(2000,  2500, 2000) },
    { id: 'intl_travel', name: 'International Travel',     tier: 'moderate',     icon: '✈️', maxValue: 20000, description: 'Overseas holidays and adventures',            amounts: sa(3000,  3500, 1500) },
    { id: 'leisure',     name: 'Hobbies & Leisure',        tier: 'moderate',     icon: '🎨', maxValue: 10000, description: 'Sports, arts, gardening, classes',            amounts: sa(2000,  2500, 2000) },
    { id: 'entertain',   name: 'Entertainment',            tier: 'moderate',     icon: '📺', maxValue: 4000,  description: 'Streaming, cinema, events, subscriptions',    amounts: sa(800,    800,  600) },
    // ── Family & Giving ────────────────────────────────────────────────────
    { id: 'family',      name: 'Family Support',           tier: 'aspirational', icon: '👨‍👩‍👧', maxValue: 20000, description: 'Helping children, grandchildren, relatives', amounts: sa(2000,  2000, 1500) },
    { id: 'gifts',       name: 'Gifts & Celebrations',     tier: 'aspirational', icon: '🎁', maxValue: 10000, description: 'Birthdays, Christmas, milestone occasions',   amounts: sa(1500,  1500, 1200) },
    { id: 'charity',     name: 'Charitable Giving',        tier: 'aspirational', icon: '💝', maxValue: 10000, description: 'Regular giving, charitable donations',        amounts: sa(600,    800, 1200) },
    { id: 'legacy',      name: 'Legacy & Philanthropy',    tier: 'aspirational', icon: '🤝', maxValue: 10000, description: 'Planned gifting, estate giving, foundations', amounts: sa(400,    600, 1000) },
    // ── Other ──────────────────────────────────────────────────────────────
    { id: 'home_impr',   name: 'Home Improvements',        tier: 'variable',     icon: '🔨', maxValue: 20000, description: 'Renovations, repairs, adaptations',           amounts: sa(2000,  1000,  500) },
    { id: 'major_purch', name: 'Major Purchases',          tier: 'variable',     icon: '📦', maxValue: 30000, description: 'New car, furniture, large one-off items',     amounts: sa(1500,   500,    0) },
    { id: 'buffer',      name: 'Contingency Buffer',       tier: 'variable',     icon: '🛟', maxValue: 10000, description: 'Unexpected expenses and peace-of-mind buffer', amounts: sa(1000,  1000, 1000) },
    { id: 'care',        name: 'Care Costs',               tier: 'variable',     icon: '🏥', maxValue: 60000, description: 'Home care, care home, assisted living',        amounts: sa(0,        0,    0) },
  ];
}

// ─── Default active-stage total (used for RLSS template scaling) ─────────────

export function getDefaultActiveTotal(): number {
  return buildDefaultCategories().reduce((s, c) => s + (c.amounts['active'] ?? 0), 0);
}

export function buildCategoriesForRlss(
  standard: RlssStandard,
  mode: 'single' | 'couple',
): SpendingCategory[] {
  const defaults     = buildDefaultCategories();
  const defaultTotal = getDefaultActiveTotal();
  const target       = RLSS[mode][standard].annual;
  const scale        = defaultTotal > 0 ? target / defaultTotal : 1;

  return defaults.map(cat => {
    const newAmounts: Record<string, number> = {};
    for (const [stageId, amount] of Object.entries(cat.amounts)) {
      newAmounts[stageId] = Math.round((amount * scale) / 100) * 100;
    }
    return { ...cat, amounts: newAmounts };
  });
}

// ─── Default income & assets ──────────────────────────────────────────────────

export function buildDefaultIncome(currentAge: number): PersonIncomeSources {
  return {
    statePension: { enabled: true,  weeklyAmount: STATE_PENSION.FULL_NEW_WEEKLY, startAge: STATE_PENSION.DEFAULT_AGE },
    dbPension:    { enabled: false, annualIncome: 0, startAge: 65 },
    annuity:      { enabled: false, annualIncome: 0, startAge: 65 },
    dcPension:    {
      enabled: false, totalValue: 0, drawdownAge: 65,
      growthRate: DEFAULT_ASSUMPTIONS.INVESTMENT_GROWTH,
      pclsPercentage: PENSION_RULES.PCLS_MAX_FRACTION * 100, // default 25%
    },
    partTimeWork: { enabled: false, annualIncome: 0, stopAge: 65 },
    otherIncome:  { enabled: false, annualAmount: 0, description: '', startAge: currentAge, stopAge: 0 },
  };
}

export function buildDefaultAssets(): PersonAssets {
  return {
    cashSavings:        { enabled: false, totalValue: 0 },
    isaInvestments:     { enabled: false, totalValue: 0, growthRate: DEFAULT_ASSUMPTIONS.INVESTMENT_GROWTH },
    generalInvestments: { enabled: false, totalValue: 0, baseCost: 0, growthRate: DEFAULT_ASSUMPTIONS.INVESTMENT_GROWTH, owner: 'p1' },
    property:           { enabled: false, propertyValue: 0, baseCost: 0, annualRent: 0, durationYears: 10, owner: 'p1' },
  };
}

// ─── Default state ────────────────────────────────────────────────────────────

export function createDefaultState(primaryAge: number = DEFAULT_ASSUMPTIONS.DEFAULT_AGE): PlannerState {
  return {
    currentStep: 0,
    mode: 'single',
    person1: {
      name: '',
      dateOfBirth: dobFromAge(primaryAge),
      currentAge: primaryAge,
      incomeSources: buildDefaultIncome(primaryAge),
      assets: buildDefaultAssets(),
    },
    person2: {
      name: '',
      dateOfBirth: dobFromAge(55),
      currentAge: 55,
      incomeSources: buildDefaultIncome(55),
      assets: buildDefaultAssets(),
    },
    lifeVision: '',
    aspirations: [],
    lifeStages: buildDefaultLifeStages(primaryAge),
    spendingCategories: buildDefaultCategories(),
    assumptions: {
      investmentGrowth: DEFAULT_ASSUMPTIONS.INVESTMENT_GROWTH,
      inflation:        DEFAULT_ASSUMPTIONS.INFLATION,
      lifeExpectancy:   DEFAULT_ASSUMPTIONS.LIFE_EXPECTANCY,
    },
    rlssStandard: null,
  };
}

// ─── Demo state — Alex (57) & Sam (55) ───────────────────────────────────────

export function createMockDemoState(): PlannerState {
  const base = createDefaultState(57);
  return {
    ...base,
    mode: 'couple',
    rlssStandard: 'comfortable',
    person1: {
      name: 'Alex',
      dateOfBirth: dobFromAge(57),
      currentAge: 57,
      incomeSources: {
        statePension: { enabled: true,  weeklyAmount: 221.20, startAge: 67 },
        dbPension:    { enabled: false, annualIncome: 0, startAge: 65 },
        annuity:      { enabled: false, annualIncome: 0, startAge: 65 },
        dcPension:    { enabled: true,  totalValue: 320000, drawdownAge: 65, growthRate: 4, pclsPercentage: 25 },
        partTimeWork: { enabled: true,  annualIncome: 22000, stopAge: 65 },
        otherIncome:  { enabled: false, annualAmount: 0, description: '', startAge: 57, stopAge: 0 },
      },
      assets: {
        cashSavings:        { enabled: true,  totalValue: 25000 },
        isaInvestments:     { enabled: true,  totalValue: 85000,  growthRate: 4 },
        generalInvestments: { enabled: true,  totalValue: 30000,  baseCost: 18000, growthRate: 4, owner: 'p1' },
        property:           { enabled: true,  propertyValue: 450000, baseCost: 220000, annualRent: 0, durationYears: 0, owner: 'p1' },
      },
    },
    person2: {
      name: 'Sam',
      dateOfBirth: dobFromAge(55),
      currentAge: 55,
      incomeSources: {
        statePension: { enabled: true,  weeklyAmount: 195.00, startAge: 67 },
        dbPension:    { enabled: true,  annualIncome: 8000,  startAge: 65 },
        annuity:      { enabled: false, annualIncome: 0,     startAge: 65 },
        dcPension:    { enabled: true,  totalValue: 150000,  drawdownAge: 65, growthRate: 4, pclsPercentage: 25 },
        partTimeWork: { enabled: true,  annualIncome: 18000, stopAge: 63 },
        otherIncome:  { enabled: false, annualAmount: 0,     description: '', startAge: 55, stopAge: 0 },
      },
      assets: {
        cashSavings:        { enabled: true,  totalValue: 20000 },
        isaInvestments:     { enabled: true,  totalValue: 40000, growthRate: 4 },
        generalInvestments: { enabled: true,  totalValue: 15000, baseCost: 10000, growthRate: 4, owner: 'p2' },
        property:           { enabled: false, propertyValue: 0,  baseCost: 0,    annualRent: 0, durationYears: 0, owner: 'p2' },
      },
    },
    lifeVision: 'We want to travel widely while we still have the energy, spend time with our grandchildren, and pursue our passions for photography and sailing. In later years we want comfort, community and peace of mind.',
    aspirations: ['travel', 'family', 'hobbies', 'fitness', 'giving'],
  };
}
