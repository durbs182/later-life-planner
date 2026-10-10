/**
 * Tests for DashboardMain rendering, chart toggle, and lazy-loaded projection table.
 */

import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DashboardMain, { type LumpSumControl } from '@/components/DashboardMain';
import { STEP4_IDS } from '@/lib/testIds';
import { bareState } from '../fixtures/states';
import type { YearlyProjection } from '@/models/types';

vi.mock('next/dynamic', () => ({
  default: () => function MockDynamicComponent() {
    return <div data-testid="mock-chart" />;
  },
}));

vi.mock('@/financialEngine/projectionEngine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/financialEngine/projectionEngine')>();
  return {
    ...actual,
    getStageTotalSpending: () => 30_000,
  };
});

/** Minimal projection row sufficient for the component to render without errors. */
function makeProjection(overrides: Partial<YearlyProjection> = {}): YearlyProjection {
  return {
    yearIndex: 0,
    p1Age: 65,
    p2Age: null,
    lifeStage: 'Go-Go',
    spending: 30_000,
    p1StatePension: 0, p1DbPension: 0, p1PartTimeWork: 0, p1OtherIncome: 0, p1PropertyRent: 0,
    p2StatePension: 0, p2DbPension: 0, p2PartTimeWork: 0, p2OtherIncome: 0, p2PropertyRent: 0,
    p2GapSalary: 0,
    p1IsaDrawdown: 0, p1GiaDrawdown: 0, p1CashDrawdown: 0, p1DcDrawdown: 0,
    p2IsaDrawdown: 0, p2GiaDrawdown: 0, p2CashDrawdown: 0, p2DcDrawdown: 0,
    isaDrawdown: 0, giaDrawdown: 0, cashDrawdown: 0, dcDrawdown: 0, dcTaxFreeDrawdown: 0,
    propertyRent: 0,
    p1CapitalGain: 0, p2CapitalGain: 0, p1CgtPaid: 0, p2CgtPaid: 0, totalCgtPaid: 0,
    p1IncomeTax: 0, p2IncomeTax: 0, incomeTaxPaid: 0,
    totalIncome: 30_000, totalTaxPaid: 0, netIncome: 30_000, gap: 0,
    careReserveBalance: 0,
    p1IsaBalance: 0, p1GiaValue: 0, p1GiaBaseCost: 0, p1CashBalance: 0, p1DcBalance: 0,
    p2IsaBalance: 0, p2GiaValue: 0, p2GiaBaseCost: 0, p2CashBalance: 0, p2DcBalance: 0,
    jointGiaValue: 0, jointGiaBaseCost: 0, totalAssets: 200_000,
    p1PclsEvent: 0, p2PclsEvent: 0, p1BedIsaTransfer: 0, p1IndivBedIsaTransfer: 0, p1JointBedIsaTransfer: 0,
    p2BedIsaTransfer: 0, p2IndivBedIsaTransfer: 0, p2JointBedIsaTransfer: 0,
    plannedEventSpend: 0,
    ...overrides,
  };
}

const defaultState = bareState(65);
const defaultLifeStages = [{ id: 'active', label: 'Go-Go', color: '#f97316', startAge: 65, endAge: 95 }];
const projections = [makeProjection()];

function lumpSumControl(overrides: Partial<LumpSumControl> = {}): LumpSumControl {
  return {
    person: 'p1',
    personName: 'You',
    currentAge: 65,
    enabled: false,
    effectiveAge: 65,
    onToggle: vi.fn(),
    onAgeChange: vi.fn(),
    ...overrides,
  };
}

function renderDashboardMain(
  overrides: {
    proEnabled?: boolean;
    optimizerEnabled?: boolean;
    lumpSumControls?: LumpSumControl[];
  } = {},
) {
  return render(
    <DashboardMain
      state={defaultState}
      projections={projections}
      displayProjections={projections}
      surplus
      depletionAge="Never"
      lifeStages={defaultLifeStages}
      mode="single"
      p1Name="You"
      p2Name="Partner 2"
      optimizerEnabled={overrides.optimizerEnabled ?? false}
      proEnabled={overrides.proEnabled ?? false}
      lumpSumControls={overrides.lumpSumControls ?? [lumpSumControl()]}
    />,
  );
}

describe('DashboardMain basic rendering', () => {
  test('renders without crashing', () => {
    renderDashboardMain();
    // Projection table is now lazy-loaded, so we look for the toggle button
    expect(screen.getByText('Show detailed table')).toBeInTheDocument();
  });
});

describe('DashboardMain chart toggle', () => {
  test('defaults to Income vs Spending view', () => {
    renderDashboardMain();
    expect(screen.getByText(/Gross income vs required spending/)).toBeInTheDocument();
    expect(screen.queryByText('Investment balances over time')).not.toBeInTheDocument();
  });

  test('switching to Asset Growth view changes the chart heading', () => {
    renderDashboardMain();
    fireEvent.click(screen.getByRole('button', { name: 'Asset Growth' }));
    expect(screen.getByText('Investment balances over time')).toBeInTheDocument();
    expect(screen.queryByText(/Gross income vs required spending/)).not.toBeInTheDocument();
  });

  test('switching back to Income vs Spending restores that view', () => {
    renderDashboardMain();
    fireEvent.click(screen.getByRole('button', { name: 'Asset Growth' }));
    fireEvent.click(screen.getByRole('button', { name: 'Income vs Spending' }));
    expect(screen.getByText(/Gross income vs required spending/)).toBeInTheDocument();
  });

  test('toggle buttons expose aria-pressed state', () => {
    renderDashboardMain();
    const incomeBtn = screen.getByRole('button', { name: 'Income vs Spending' });
    const assetsBtn = screen.getByRole('button', { name: 'Asset Growth' });
    expect(incomeBtn).toHaveAttribute('aria-pressed', 'true');
    expect(assetsBtn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(assetsBtn);
    expect(incomeBtn).toHaveAttribute('aria-pressed', 'false');
    expect(assetsBtn).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('DashboardMain tax-free lump sum (Pro mode)', () => {
  test('shows one toggle per person when Pro enabled', () => {
    renderDashboardMain({
      proEnabled: true,
      lumpSumControls: [
        lumpSumControl({ person: 'p1', personName: 'Alex' }),
        lumpSumControl({ person: 'p2', personName: 'Sam' }),
      ],
    });
    expect(screen.getByText('Tax-free lump sum')).toBeInTheDocument();
    expect(screen.getByTestId(STEP4_IDS.LUMP_SUM_TOGGLE('p1'))).not.toBeChecked();
    expect(screen.getByTestId(STEP4_IDS.LUMP_SUM_TOGGLE('p2'))).not.toBeChecked();
    expect(screen.getByText('Alex: take full tax-free lump sum')).toBeInTheDocument();
    expect(screen.getByText('Sam: take full tax-free lump sum')).toBeInTheDocument();
  });

  test('age input only appears for the person who has opted in', () => {
    renderDashboardMain({
      proEnabled: true,
      lumpSumControls: [
        lumpSumControl({ person: 'p1', enabled: true, effectiveAge: 67 }),
        lumpSumControl({ person: 'p2', enabled: false }),
      ],
    });
    expect(screen.getByTestId(STEP4_IDS.LUMP_SUM_AGE('p1'))).toHaveValue(67);
    expect(screen.queryByTestId(STEP4_IDS.LUMP_SUM_AGE('p2'))).not.toBeInTheDocument();
  });

  test('toggling and changing age call back for that person only', () => {
    const p1 = lumpSumControl({ person: 'p1', enabled: true, effectiveAge: 66 });
    const p2 = lumpSumControl({ person: 'p2' });
    renderDashboardMain({ proEnabled: true, lumpSumControls: [p1, p2] });

    fireEvent.click(screen.getByTestId(STEP4_IDS.LUMP_SUM_TOGGLE('p2')));
    expect(p2.onToggle).toHaveBeenCalledWith(true);
    expect(p1.onToggle).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId(STEP4_IDS.LUMP_SUM_AGE('p1')), { target: { value: '70' } });
    expect(p1.onAgeChange).toHaveBeenCalledWith(70);
    expect(p2.onAgeChange).not.toHaveBeenCalled();
  });

  test('age below current age is clamped to current age', () => {
    const p1 = lumpSumControl({ enabled: true, currentAge: 65 });
    renderDashboardMain({ proEnabled: true, lumpSumControls: [p1] });
    fireEvent.change(screen.getByTestId(STEP4_IDS.LUMP_SUM_AGE('p1')), { target: { value: '50' } });
    expect(p1.onAgeChange).toHaveBeenCalledWith(65);
  });

  test('does not show lump sum controls in non-Pro mode', () => {
    renderDashboardMain({ proEnabled: false });
    expect(screen.queryByText('Tax-free lump sum')).not.toBeInTheDocument();
  });
});

describe('DashboardMain lazy-loaded projection table', () => {
  test('projection table is hidden on initial render', () => {
    renderDashboardMain();
    expect(screen.queryByText('Year-by-year projection')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show detailed table' })).toBeInTheDocument();
  });

  test('clicking Show detailed table renders the table and hides the CTA', () => {
    renderDashboardMain();
    fireEvent.click(screen.getByRole('button', { name: 'Show detailed table' }));
    expect(screen.getByText('Year-by-year projection')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show detailed table' })).not.toBeInTheDocument();
  });

  test('Show detailed table button exposes aria-expanded state', () => {
    renderDashboardMain();
    const btn = screen.getByRole('button', { name: 'Show detailed table' });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(btn).toHaveAttribute('aria-controls', 'projection-table');
    // After clicking, the table is shown and the button is removed from the DOM —
    // verify the table container is now present instead
    fireEvent.click(btn);
    expect(screen.getByText('Year-by-year projection')).toBeInTheDocument();
  });
});
