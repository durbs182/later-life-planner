import type {
  PlannerState, LifeStage, SpendingCategory,
  PersonIncomeSources, PersonAssets, Assumptions, RlssStandard,
} from './types';

// ─── UK Retirement Living Standards (RLSS) 2024 ──────────────────────────────
// Source: Pensions and Lifetime Savings Association (PLSA)

export const RLSS_STANDARDS = {
  single: {
    minimum:     { annual: 13_400, label: 'Minimum',     description: 'Covers basic needs with a little left over' },
    moderate:    { annual: 31_700, label: 'Moderate',    description: 'More financial security and flexibility' },
    comfortable: { annual: 43_900, label: 'Comfortable', description: 'More financial freedom and some luxuries' },
  },
  couple: {
    minimum:     { annual: 21_600, label: 'Minimum',     description: 'Covers basic needs with a little left over' },
    moderate:    { annual: 43_900, label: 'Moderate',    description: 'More financial security and flexibility' },
    comfortable: { annual: 60_600, label: 'Comfortable', description: 'More financial freedom and some luxuries' },
  },
} as const;

export function buildDefaultLifeStages(currentAge: number): LifeStage[] {
  const activeEnd = Math.min(64, Math.max(currentAge + 1, 60));
  return [
    { id: 'active',  label: 'Active Years',       startAge: currentAge,  endAge: activeEnd, color: '#2563eb' },
    { id: 'gradual', label: 'Gradual Transition', startAge: activeEnd + 1, endAge: 75,      color: '#059669' },
    { id: 'later',   label: 'Later Years',         startAge: 76, endAge: 95,                 color: '#7c3aed' },
  ];
}

function sa(a: number, g: number, l: number): Record<string, number> { return { active: a, gradual: g, later: l }; }

export function buildDefaultCategories(): SpendingCategory[] {
  return [
    { id: 'housing',    name: 'Housing',                 tier: 'essential',    icon: '🏠', maxValue: 30000, description: 'Rent, mortgage or property running costs',      amounts: sa(10000, 9000, 7500) },
    { id: 'food',       name: 'Food & Groceries',         tier: 'essential',    icon: '🛒', maxValue: 12000, description: 'Weekly food shopping and household basics',     amounts: sa(4800,  4400,  3800)  },
    { id: 'utilities',  name: 'Utilities & Bills',        tier: 'essential',    icon: '⚡', maxValue: 8000,  description: 'Energy, water, council tax, broadband',         amounts: sa(3200,  3000,  2800)  },
    { id: 'transport',  name: 'Transport',                tier: 'essential',    icon: '🚗', maxValue: 10000, description: 'Car, fuel, public transport',                   amounts: sa(3500,  2500,  1500)  },
    { id: 'healthcare', name: 'Healthcare',               tier: 'essential',    icon: '🏥', maxValue: 12000, description: 'Dental, opticians, prescriptions, top-ups',    amounts: sa(1200,  1800,  3500)  },
    { id: 'insurance',  name: 'Insurance',                tier: 'essential',    icon: '🛡️', maxValue: 6000,  description: 'Home, car, life, travel insurance',            amounts: sa(1800,  1800,  2000)  },
    { id: 'clothing',   name: 'Clothing & Personal Care', tier: 'essential',    icon: '👗', maxValue: 5000,  description: 'Clothes, haircuts, personal care products',     amounts: sa(1200,  1000,  800)   },
    { id: 'eating_out', name: 'Eating Out',               tier: 'moderate',     icon: '🍽️', maxValue: 8000,  description: 'Restaurants, cafés, takeaways',                amounts: sa(1800,  1500,  1000)  },
    { id: 'uk_travel',  name: 'UK Travel & Breaks',       tier: 'moderate',     icon: '🚂', maxValue: 10000, description: 'UK holidays, weekend breaks, day trips',        amounts: sa(2000,  2500,  2000)  },
    { id: 'leisure',    name: 'Leisure & Hobbies',        tier: 'moderate',     icon: '🎨', maxValue: 10000, description: 'Sports, arts, gardening, classes',              amounts: sa(2000,  2500,  2000)  },
    { id: 'social',     name: 'Social Life',              tier: 'moderate',     icon: '🥂', maxValue: 5000,  description: 'Going out, events with friends and family',     amounts: sa(1200,  1000,  600)   },
    { id: 'gifts',      name: 'Gifts & Family Support',   tier: 'moderate',     icon: '🎁', maxValue: 10000, description: 'Birthdays, Christmas, helping family',          amounts: sa(1500,  1500,  1200)  },
    { id: 'entertain',  name: 'Entertainment',            tier: 'moderate',     icon: '📺', maxValue: 4000,  description: 'Streaming, cinema, events, subscriptions',      amounts: sa(800,   800,   600)   },
    { id: 'intl_travel',name: 'International Travel',     tier: 'aspirational', icon: '✈️', maxValue: 20000, description: 'Overseas holidays and adventures',              amounts: sa(3000,  3500,  1500)  },
    { id: 'prem_hobby', name: 'Premium Hobbies',          tier: 'aspirational', icon: '⛳', maxValue: 10000, description: 'Golf, sailing, photography, premium pursuits',   amounts: sa(1500,  2000,  1500)  },
    { id: 'upgrades',   name: 'Home & Life Upgrades',     tier: 'aspirational', icon: '🏡', maxValue: 10000, description: 'Home improvements, new car, quality of life',    amounts: sa(1500,  1000,  500)   },
    { id: 'events',     name: 'Special Events',           tier: 'aspirational', icon: '🎉', maxValue: 5000,  description: 'Milestone celebrations, family occasions',      amounts: sa(800,   800,   300)   },
    { id: 'legacy',     name: 'Philanthropy & Legacy',    tier: 'aspirational', icon: '💝', maxValue: 10000, description: 'Charitable giving, gifts to family',            amounts: sa(500,   800,   1500)  },
    { id: 'care',       name: 'Care Costs',               tier: 'variable',     icon: '👩‍⚕️', maxValue: 60000, description: 'Home care, care home, assisted living',         amounts: sa(0,     0,     0)     },
    { id: 'downsize',   name: 'Downsizing / Relocation',  tier: 'variable',     icon: '📦', maxValue: 30000, description: 'Moving costs, legal fees, new home setup',      amounts: sa(0,     0,     0)     },
    { id: 'projects',   name: 'Special Projects',         tier: 'variable',     icon: '🔨', maxValue: 20000, description: 'One-off large expenses and bucket list items',   amounts: sa(2000,  0,     0)     },
  ];
}

// Compute the default "active" stage total (used for RLSS scaling)
export function getDefaultActiveTotal(): number {
  const defaults = buildDefaultCategories();
  return defaults.reduce((sum, c) => sum + (c.amounts['active'] ?? 0), 0);
}

// Build spending categories scaled to a given RLSS standard
export function buildCategoriesForRlss(
  standard: RlssStandard,
  mode: 'single' | 'couple',
): SpendingCategory[] {
  const defaults      = buildDefaultCategories();
  const defaultTotal  = getDefaultActiveTotal();          // £44,300
  const target        = RLSS_STANDARDS[mode][standard].annual;
  const scale         = defaultTotal > 0 ? target / defaultTotal : 1;

  return defaults.map(cat => {
    const newAmounts: Record<string, number> = {};
    for (const [stageId, amount] of Object.entries(cat.amounts)) {
      // Round to nearest £100 for cleanliness
      newAmounts[stageId] = Math.round((amount * scale) / 100) * 100;
    }
    return { ...cat, amounts: newAmounts };
  });
}

export function buildDefaultIncome(currentAge: number): PersonIncomeSources {
  return {
    statePension: { enabled: true,  weeklyAmount: 221.20, startAge: 67 },
    dbPension:    { enabled: false, annualIncome: 0, startAge: 65 },
    annuity:      { enabled: false, annualIncome: 0, startAge: 65 },
    dcPension:    { enabled: false, totalValue: 0,  drawdownAge: 65, growthRate: 4 },
    partTimeWork: { enabled: false, annualIncome: 0, stopAge: 65 },
    otherIncome:  { enabled: false, annualAmount: 0, description: '', startAge: currentAge, stopAge: 0 },
  };
}

export function buildDefaultAssets(): PersonAssets {
  return {
    cashSavings:        { enabled: false, totalValue: 0 },
    isaInvestments:     { enabled: false, totalValue: 0,  growthRate: 4 },
    generalInvestments: { enabled: false, totalValue: 0,  baseCost: 0,    growthRate: 4 },
    property:           { enabled: false, propertyValue: 0, baseCost: 0, annualRent: 0, durationYears: 10 },
  };
}

export function createDefaultState(primaryAge = 57): PlannerState {
  return {
    currentStep: 0,
    mode: 'single',
    person1: { name: '', currentAge: primaryAge, incomeSources: buildDefaultIncome(primaryAge), assets: buildDefaultAssets() },
    person2: { name: '', currentAge: 55,         incomeSources: buildDefaultIncome(55),         assets: buildDefaultAssets() },
    lifeVision: '',
    aspirations: [],
    lifeStages: buildDefaultLifeStages(primaryAge),
    spendingCategories: buildDefaultCategories(),
    assumptions: { investmentGrowth: 4, inflation: 2.5, lifeExpectancy: 95 },
    rlssStandard: null,
  };
}

/** Realistic couple demo: Alex (57) + Sam (55) */
export function createMockDemoState(): PlannerState {
  const base = createDefaultState(57);
  return {
    ...base,
    mode: 'couple',
    rlssStandard: 'comfortable',
    person1: {
      name: 'Alex',
      currentAge: 57,
      incomeSources: {
        statePension: { enabled: true,  weeklyAmount: 221.20, startAge: 67 },
        dbPension:    { enabled: false, annualIncome: 0, startAge: 65 },
        annuity:      { enabled: false, annualIncome: 0, startAge: 65 },
        dcPension:    { enabled: true,  totalValue: 320000, drawdownAge: 65, growthRate: 4 },
        partTimeWork: { enabled: true,  annualIncome: 22000, stopAge: 65 },
        otherIncome:  { enabled: false, annualAmount: 0, description: '', startAge: 57, stopAge: 0 },
      },
      assets: {
        cashSavings:        { enabled: true, totalValue: 25000 },
        isaInvestments:     { enabled: true, totalValue: 85000, growthRate: 4 },
        generalInvestments: { enabled: true, totalValue: 30000, baseCost: 18000, growthRate: 4 },
        property:           { enabled: true, propertyValue: 450000, baseCost: 220000, annualRent: 0, durationYears: 0 },
      },
    },
    person2: {
      name: 'Sam',
      currentAge: 55,
      incomeSources: {
        statePension: { enabled: true,  weeklyAmount: 195.00, startAge: 67 },
        dbPension:    { enabled: true,  annualIncome: 8000, startAge: 65 },
        annuity:      { enabled: false, annualIncome: 0, startAge: 65 },
        dcPension:    { enabled: true,  totalValue: 150000, drawdownAge: 65, growthRate: 4 },
        partTimeWork: { enabled: true,  annualIncome: 18000, stopAge: 63 },
        otherIncome:  { enabled: false, annualAmount: 0, description: '', startAge: 55, stopAge: 0 },
      },
      assets: {
        cashSavings:        { enabled: true, totalValue: 20000 },
        isaInvestments:     { enabled: true, totalValue: 40000, growthRate: 4 },
        generalInvestments: { enabled: true, totalValue: 15000, baseCost: 10000, growthRate: 4 },
        property:           { enabled: false, propertyValue: 0, baseCost: 0, annualRent: 0, durationYears: 0 },
      },
    },
    lifeVision:
      'We want to travel widely while we still have the energy, spend time with our grandchildren, and pursue our passions for photography and sailing. In later years we want comfort, community and peace of mind.',
    aspirations: ['travel', 'family', 'hobbies', 'fitness'],
  };
}
