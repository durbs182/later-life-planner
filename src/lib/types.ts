export type AspirationTag =
  | 'travel' | 'hobbies' | 'learning' | 'family'
  | 'volunteering' | 'property' | 'health' | 'fitness';

export type SpendingTier = 'essential' | 'moderate' | 'aspirational' | 'variable';
export type PlanningMode = 'single' | 'couple';
export type RlssStandard = 'minimum' | 'moderate' | 'comfortable';

export interface LifeStage {
  id: string;
  label: string;
  startAge: number;
  endAge: number;
  color: string;
}

export interface SpendingCategory {
  id: string;
  name: string;
  tier: SpendingTier;
  icon: string;
  description: string;
  maxValue: number;
  amounts: Record<string, number>; // keyed by stage id
}

// ─── Per-person income sources ──────────────────────────────────────────────

export interface StatePensionSource {
  enabled: boolean;
  weeklyAmount: number;
  startAge: number;
}

export interface DCPensionSource {
  enabled: boolean;
  totalValue: number;
  drawdownAge: number;
  growthRate: number;
}

export interface DBPensionSource {
  enabled: boolean;
  annualIncome: number;
  startAge: number;
}

export interface AnnuitySource {
  enabled: boolean;
  annualIncome: number;
  startAge: number;
}

export interface PartTimeWorkSource {
  enabled: boolean;
  annualIncome: number;
  stopAge: number;
}

export interface OtherIncomeSource {
  enabled: boolean;
  annualAmount: number;
  description: string;
  startAge: number;
  stopAge: number; // 0 = no end
}

export interface PersonIncomeSources {
  statePension: StatePensionSource;
  dbPension: DBPensionSource;
  annuity: AnnuitySource;
  dcPension: DCPensionSource;
  partTimeWork: PartTimeWorkSource;
  otherIncome: OtherIncomeSource;
}

// ─── Per-person assets (all assets are individual) ───────────────────────────

export interface CashSavingsAsset {
  enabled: boolean;
  totalValue: number;
}

export interface ISAAsset {
  enabled: boolean;
  totalValue: number;
  growthRate: number;
}

export interface GIAAsset {
  enabled: boolean;
  totalValue: number;
  baseCost: number;    // purchase price — used for CGT calculation
  growthRate: number;
}

export interface PropertyAsset {
  enabled: boolean;
  propertyValue: number;
  baseCost: number;    // original purchase price — used for future CGT
  annualRent: number;  // 0 if owner-occupied / not rented
  durationYears: number;
}

export interface PersonAssets {
  cashSavings: CashSavingsAsset;
  isaInvestments: ISAAsset;
  generalInvestments: GIAAsset;
  property: PropertyAsset;
}

// ─── Person (income sources + individual assets) ─────────────────────────────

export interface Person {
  name: string;
  currentAge: number;
  incomeSources: PersonIncomeSources;
  assets: PersonAssets;
}

// ─── Assumptions ─────────────────────────────────────────────────────────────

export interface Assumptions {
  investmentGrowth: number; // % default 4
  inflation: number;        // % default 2.5
  lifeExpectancy: number;   // default 95
}

// ─── Top-level state ──────────────────────────────────────────────────────────

export interface PlannerState {
  currentStep: number;
  mode: PlanningMode;
  person1: Person;
  person2: Person;
  lifeVision: string;
  aspirations: AspirationTag[];
  lifeStages: LifeStage[];
  spendingCategories: SpendingCategory[];
  assumptions: Assumptions;
  rlssStandard: RlssStandard | null; // selected UK Retirement Living Standard
}

// ─── Projection output ───────────────────────────────────────────────────────

export interface YearlyProjection {
  yearIndex: number;
  p1Age: number;
  p2Age: number | null;
  lifeStage: string;
  spending: number;

  // Per-person fixed income
  p1StatePension: number;
  p1DbPension: number;
  p1PartTimeWork: number;
  p1OtherIncome: number;
  p1PropertyRent: number;
  p2StatePension: number;
  p2DbPension: number;
  p2PartTimeWork: number;
  p2OtherIncome: number;
  p2PropertyRent: number;

  // Per-person asset drawdowns
  p1IsaDrawdown: number;
  p1GiaDrawdown: number;
  p1CashDrawdown: number;
  p1DcDrawdown: number;
  p2IsaDrawdown: number;
  p2GiaDrawdown: number;
  p2CashDrawdown: number;
  p2DcDrawdown: number;

  // Combined drawdowns (for chart convenience)
  isaDrawdown: number;
  giaDrawdown: number;
  cashDrawdown: number;
  dcDrawdown: number;
  propertyRent: number;

  // CGT (per person)
  p1CapitalGain: number;
  p2CapitalGain: number;
  p1CgtPaid: number;
  p2CgtPaid: number;
  totalCgtPaid: number;

  // Income tax
  p1IncomeTax: number;
  p2IncomeTax: number;
  incomeTaxPaid: number;

  // Totals
  totalIncome: number;
  totalTaxPaid: number; // income tax + CGT
  netIncome: number;
  gap: number;

  // Asset balances (end of year)
  p1IsaBalance: number;
  p1GiaValue: number;
  p1GiaBaseCost: number;
  p1CashBalance: number;
  p1DcBalance: number;
  p2IsaBalance: number;
  p2GiaValue: number;
  p2GiaBaseCost: number;
  p2CashBalance: number;
  p2DcBalance: number;
  totalAssets: number;
}
