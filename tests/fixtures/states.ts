/**
 * Test fixture factories.
 *
 * All fixtures are built on createDefaultState / createMockDemoState so they
 * stay in sync with the real app defaults automatically. Each factory accepts
 * a deep-partial override so individual tests can tweak exactly what they need.
 */

import type { PlannerState, PersonIncomeSources, PersonAssets, GIAAsset } from '@/models/types';
import { createDefaultState } from '@/lib/mockData';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function noIncome(base: PersonIncomeSources): PersonIncomeSources {
  return {
    ...base,
    statePension: { enabled: false, weeklyAmount: 0, startAge: 67 },
    dbPension:    { enabled: false, annualIncome: 0, startAge: 67 },
    annuity:      { enabled: false, annualIncome: 0, startAge: 67 },
    dcPension:    { enabled: false, totalValue: 0, growthRate: 4 },
    partTimeWork: { enabled: false, annualIncome: 0, stopAge: 0 },
    otherIncome:  { enabled: false, annualAmount: 0, description: '', startAge: 0, stopAge: 0 },
  };
}

function noAssets(base: PersonAssets): PersonAssets {
  return {
    ...base,
    cashSavings:        { enabled: false, totalValue: 0 },
    isaInvestments:     { enabled: false, totalValue: 0, growthRate: 4 },
    generalInvestments: { enabled: false, totalValue: 0, baseCost: 0, growthRate: 4 },
    property:           { enabled: false, propertyValue: 0, baseCost: 0, annualRent: 0, durationYears: 0, owner: 'p1' },
  };
}

const disabledJointGia: GIAAsset = { enabled: false, totalValue: 0, baseCost: 0, growthRate: 4 };

// ─── Single-person factories ──────────────────────────────────────────────────

/** Bare minimum single person — no income, no assets. */
export function bareState(age = 65): PlannerState {
  const base = createDefaultState(age);
  return {
    ...base,
    fiAge: age,
    mode: 'single',
    jointGia: disabledJointGia,
    careReserve: { enabled: false, amount: 0 },
    person1: {
      ...base.person1,
      currentAge: age,
      incomeSources: noIncome(base.person1.incomeSources),
      assets: noAssets(base.person1.assets),
    },
    assumptions: { ...base.assumptions, investmentGrowth: 4, inflation: 2.5, lifeExpectancy: 85, statePensionSoleIncomeExempt: true },
  };
}

/** Single person with a DC pension only. */
export function dcOnlyState(age: number, dcValue: number, fiAge = age): PlannerState {
  const base = bareState(age);
  return {
    ...base,
    fiAge,
    person1: {
      ...base.person1,
      incomeSources: {
        ...base.person1.incomeSources,
        dcPension: { enabled: true, totalValue: dcValue, growthRate: 0 },
      },
    },
  };
}

/** Single person with an ISA only. */
export function isaOnlyState(age: number, isaValue: number, spending: number, fiAge = age): PlannerState {
  const base = bareState(age);
  // Set all spending categories proportionally so total = spending
  const categories = base.spendingCategories.map(c => ({
    ...c,
    amounts: Object.fromEntries(
      Object.keys(c.amounts).map(k => [k, spending / base.spendingCategories.length]),
    ),
  }));
  return {
    ...base,
    fiAge,
    spendingCategories: categories,
    person1: {
      ...base.person1,
      assets: {
        ...base.person1.assets,
        isaInvestments: { enabled: true, totalValue: isaValue, growthRate: 4 },
      },
    },
  };
}

/** Single person with State Pension as only income (no assets). */
export function spOnlyState(age: number, spStartAge = 67): PlannerState {
  const base = bareState(age);
  return {
    ...base,
    fiAge: spStartAge,
    person1: {
      ...base.person1,
      incomeSources: {
        ...base.person1.incomeSources,
        statePension: { enabled: true, weeklyAmount: 221.20, startAge: spStartAge },
      },
    },
  };
}

// ─── Couple factory ───────────────────────────────────────────────────────────

/** Bare couple — no income, no assets on either person. */
export function bareCoupleState(p1Age = 60, p2Age = 60): PlannerState {
  const base = createDefaultState(p1Age);
  return {
    ...base,
    mode: 'couple',
    fiAge: p1Age,
    jointGia: disabledJointGia,
    careReserve: { enabled: false, amount: 0 },
    person1: {
      ...base.person1,
      currentAge: p1Age,
      incomeSources: noIncome(base.person1.incomeSources),
      assets: noAssets(base.person1.assets),
    },
    person2: {
      ...base.person2,
      currentAge: p2Age,
      incomeSources: noIncome(base.person2.incomeSources),
      assets: noAssets(base.person2.assets),
    },
    assumptions: { ...base.assumptions, investmentGrowth: 4, inflation: 2.5, lifeExpectancy: 85, statePensionSoleIncomeExempt: true },
  };
}

// ─── Realistic "Paul & Lisa" scenario ────────────────────────────────────────
// Validated against known debug-script outputs (see docs/testing-plan.md §6A).

export function paulAndLisaState(): PlannerState {
  const base = createDefaultState(56);
  // Override spending to Comfortable couple standard (£60,600/yr)
  const totalSpend = 60_600;
  const stageIds = base.lifeStages.map(s => s.id);
  const categories = base.spendingCategories.map(c => ({
    ...c,
    amounts: Object.fromEntries(
      stageIds.map(id => [id, totalSpend / base.spendingCategories.length]),
    ),
  }));
  return {
    ...base,
    mode: 'couple',
    fiAge: 60,
    spendingCategories: categories,
    jointGia: { enabled: true, totalValue: 51_000, baseCost: 17_000, growthRate: 4 },
    careReserve: { enabled: false, amount: 0 },
    assumptions: { ...base.assumptions, investmentGrowth: 4, inflation: 2.5, lifeExpectancy: 95, statePensionSoleIncomeExempt: true },
    person1: {
      ...base.person1,
      name: 'Paul',
      currentAge: 56,
      incomeSources: {
        ...base.person1.incomeSources,
        statePension: { enabled: true, weeklyAmount: 221, startAge: 67 },
        dbPension:    { enabled: true, annualIncome: 1_024, startAge: 65 },
        annuity:      { enabled: false, annualIncome: 0, startAge: 67 },
        dcPension:    { enabled: true, totalValue: 1_144_000, growthRate: 4 },
        partTimeWork: { enabled: false, annualIncome: 0, stopAge: 0 },
        otherIncome:  { enabled: true, annualAmount: 257, description: 'Other', startAge: 60, stopAge: 0 },
      },
      assets: {
        ...base.person1.assets,
        cashSavings:        { enabled: false, totalValue: 0 },
        isaInvestments:     { enabled: true, totalValue: 128_000, growthRate: 4 },
        generalInvestments: { enabled: true, totalValue: 15_800, baseCost: 12_730, growthRate: 4 },
        property:           { enabled: false, propertyValue: 0, baseCost: 0, annualRent: 0, durationYears: 0, owner: 'p1' },
      },
    },
    person2: {
      ...base.person2,
      name: 'Lisa',
      currentAge: 56,
      incomeSources: {
        ...base.person2.incomeSources,
        statePension: { enabled: true, weeklyAmount: 221, startAge: 67 },
        dbPension:    { enabled: false, annualIncome: 0, startAge: 67 },
        annuity:      { enabled: false, annualIncome: 0, startAge: 67 },
        dcPension:    { enabled: true, totalValue: 264_000, growthRate: 4 },
        partTimeWork: { enabled: false, annualIncome: 0, stopAge: 0 },
        otherIncome:  { enabled: false, annualAmount: 0, description: '', startAge: 0, stopAge: 0 },
      },
      assets: {
        ...base.person2.assets,
        cashSavings:        { enabled: false, totalValue: 0 },
        isaInvestments:     { enabled: true, totalValue: 45_000, growthRate: 4 },
        generalInvestments: { enabled: true, totalValue: 13_800, baseCost: 12_000, growthRate: 4 },
        property:           { enabled: false, propertyValue: 0, baseCost: 0, annualRent: 0, durationYears: 0, owner: 'p2' },
      },
    },
  };
}
