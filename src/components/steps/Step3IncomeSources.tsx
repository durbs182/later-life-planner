'use client';

import { useState } from 'react';
import { usePlannerStore } from '@/store/plannerStore';
import Card from '@/components/ui/Card';
import Toggle from '@/components/ui/Toggle';
import CurrencyInput from '@/components/ui/CurrencyInput';
import type { PersonIncomeSources, PersonAssets } from '@/lib/types';
import clsx from 'clsx';

interface Props { onNext: () => void; onBack: () => void }

// ─── Field primitives ────────────────────────────────────────────────────────

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-slate-100 last:border-0">
      <div>
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function AgeInput({ value, onChange, min = 50, max = 90, label = 'Age' }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; label?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-500">{label}</span>
      <input type="number" min={min} max={max} value={value}
        onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) onChange(v); }}
        className="w-20 input-base text-center py-1.5 text-sm" />
    </div>
  );
}

function PctInput({ value, onChange, label = 'Growth' }: { value: number; onChange: (v: number) => void; label?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-slate-500">{label}</span>
      <div className="relative">
        <input type="number" min={0} max={15} step={0.5} value={value}
          onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v); }}
          className="w-20 input-base text-center py-1.5 text-sm pr-6" />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
      </div>
    </div>
  );
}

// Priority group header — clearly signals capture priority to the user
function PriorityGroup({
  number, title, subtitle, badge, badgeColor, children,
}: {
  number: number; title: string; subtitle: string;
  badge: string; badgeColor: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-7 h-7 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
          {number}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-800 text-sm">{title}</span>
            <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', badgeColor)}>{badge}</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-3 pl-10">{children}</div>
    </div>
  );
}

// ─── Income tab — 3 priority groups ──────────────────────────────────────────

function IncomeSection({
  currentAge,
  src,
  assets,
  set,
}: {
  currentAge: number;
  src: PersonIncomeSources;
  assets: PersonAssets;
  set: (key: keyof PersonIncomeSources, u: Record<string, unknown>) => void;
}) {
  const hasRentalProperty = assets.property.enabled && assets.property.annualRent > 0;
  // Guard against persisted state predating the annuity field
  const annuity = src.annuity ?? { enabled: false, annualIncome: 0, startAge: 65 };

  return (
    <div className="space-y-8">

      {/* ── Priority 1: Guaranteed / Secure income ── */}
      <PriorityGroup
        number={1}
        title="Guaranteed & Secure Income"
        subtitle="DB pensions, annuities and State Pension — these fill your personal allowance first"
        badge="Draw first"
        badgeColor="bg-blue-100 text-blue-700"
      >
        {/* DB Pension */}
        <Card>
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2"><span>🏢</span><h5 className="font-bold text-slate-800">DB / Final Salary Pension</h5></div>
              <p className="text-xs text-slate-400 mt-0.5">Guaranteed income from an employer scheme — indexed to inflation</p>
            </div>
            <Toggle checked={src.dbPension.enabled} onChange={(v) => set('dbPension', { enabled: v })} />
          </div>
          {src.dbPension.enabled && (
            <div className="pt-2 border-t border-slate-100">
              <FieldRow label="Annual income (today's £)">
                <CurrencyInput value={src.dbPension.annualIncome} onChange={(v) => set('dbPension', { annualIncome: v })} max={100000} step={100} />
              </FieldRow>
              <FieldRow label="Start age">
                <AgeInput value={src.dbPension.startAge} onChange={(v) => set('dbPension', { startAge: v })} min={55} max={75} />
              </FieldRow>
            </div>
          )}
        </Card>

        {/* Annuity */}
        <Card>
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2"><span>📜</span><h5 className="font-bold text-slate-800">Annuity</h5></div>
              <p className="text-xs text-slate-400 mt-0.5">Purchased annuity — guaranteed income for life or a fixed term</p>
            </div>
            <Toggle checked={annuity.enabled} onChange={(v) => set('annuity', { enabled: v })} />
          </div>
          {annuity.enabled && (
            <div className="pt-2 border-t border-slate-100">
              <FieldRow label="Annual income">
                <CurrencyInput value={annuity.annualIncome} onChange={(v) => set('annuity', { annualIncome: v })} max={100000} step={100} />
              </FieldRow>
              <FieldRow label="Starts at age">
                <AgeInput value={annuity.startAge} onChange={(v) => set('annuity', { startAge: v })} min={55} max={85} />
              </FieldRow>
              <div className="mt-2 text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                Annuity income is taxable — modelled as income filling your personal allowance alongside DB pension and State Pension.
              </div>
            </div>
          )}
        </Card>

        {/* State Pension */}
        <Card>
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2"><span>🏛️</span><h5 className="font-bold text-slate-800">State Pension</h5></div>
              <p className="text-xs text-slate-400 mt-0.5">UK new State Pension — up to £221.20/week (2024/25)</p>
            </div>
            <Toggle checked={src.statePension.enabled} onChange={(v) => set('statePension', { enabled: v })} />
          </div>
          {src.statePension.enabled && (
            <div className="pt-2 border-t border-slate-100">
              <FieldRow label="Weekly amount" hint="Check your forecast at gov.uk/check-state-pension">
                <CurrencyInput value={src.statePension.weeklyAmount} onChange={(v) => set('statePension', { weeklyAmount: v })} max={300} step={1} />
              </FieldRow>
              <FieldRow label="Start age" hint="Currently 66, rising to 67 by 2028">
                <AgeInput value={src.statePension.startAge} onChange={(v) => set('statePension', { startAge: v })} min={60} max={75} />
              </FieldRow>
              <div className="mt-2 text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                Annual: <strong>£{(src.statePension.weeklyAmount * 52).toLocaleString('en-GB')}</strong> · Indexed to inflation in this model
              </div>
            </div>
          )}
        </Card>
      </PriorityGroup>

      <div className="border-t border-slate-100" />

      {/* ── Priority 2: Property Income ── */}
      <PriorityGroup
        number={2}
        title="Property Income"
        subtitle="Rental income — taxed as income in your personal assessment"
        badge="Taxed as income"
        badgeColor="bg-amber-100 text-amber-700"
      >
        <Card>
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5">🏘️</span>
            <div className="flex-1">
              {hasRentalProperty ? (
                <>
                  <h5 className="font-bold text-slate-800 mb-0.5">Rental property configured</h5>
                  <p className="text-sm text-slate-600">
                    Annual net rent:{' '}
                    <span className="font-semibold text-emerald-700">
                      £{assets.property.annualRent.toLocaleString('en-GB')}/yr
                    </span>{' '}
                    for {assets.property.durationYears} year{assets.property.durationYears !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Full property details (value, base cost for CGT) are in the Assets tab.
                  </p>
                </>
              ) : (
                <>
                  <h5 className="font-bold text-slate-800 mb-0.5">No rental income configured</h5>
                  <p className="text-xs text-slate-400">
                    Go to the <strong>Assets tab</strong> to add a property and set annual rental income.
                    Your main home and CGT base cost are also captured there.
                  </p>
                </>
              )}
            </div>
          </div>
        </Card>
      </PriorityGroup>

      <div className="border-t border-slate-100" />

      {/* ── Priority 3: Flexible / Other Sources ── */}
      <PriorityGroup
        number={3}
        title="Other Income Sources"
        subtitle="DC pension, part-time work and flexible income — drawn after guaranteed sources"
        badge="Flexible"
        badgeColor="bg-purple-100 text-purple-700"
      >
        {/* DC Pension */}
        <Card>
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2"><span>💼</span><h5 className="font-bold text-slate-800">DC / Personal Pension</h5></div>
              <p className="text-xs text-slate-400 mt-0.5">Workplace or personal pension pot</p>
            </div>
            <Toggle checked={src.dcPension.enabled} onChange={(v) => set('dcPension', { enabled: v })} />
          </div>
          {src.dcPension.enabled && (
            <div className="pt-2 border-t border-slate-100">
              <FieldRow label="Current pot value">
                <CurrencyInput value={src.dcPension.totalValue} onChange={(v) => set('dcPension', { totalValue: v })} max={2000000} step={1000} />
              </FieldRow>
              <FieldRow label="Drawdown start age">
                <AgeInput value={src.dcPension.drawdownAge} onChange={(v) => set('dcPension', { drawdownAge: v })} min={55} max={80} />
              </FieldRow>
              <FieldRow label="Annual growth rate">
                <PctInput value={src.dcPension.growthRate} onChange={(v) => set('dcPension', { growthRate: v })} />
              </FieldRow>
              <div className="mt-2 text-xs text-slate-500 bg-blue-50 rounded-lg px-3 py-2">
                25% of each withdrawal is tax-free (UFPLS model). 75% taxed as income.
                First 25% can also be taken as a one-off PCLS at crystallisation.
              </div>
            </div>
          )}
        </Card>

        {/* Part-time Work */}
        <Card>
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2"><span>💻</span><h5 className="font-bold text-slate-800">Work / Consultancy</h5></div>
              <p className="text-xs text-slate-400 mt-0.5">Part-time work, freelance or self-employment</p>
            </div>
            <Toggle checked={src.partTimeWork.enabled} onChange={(v) => set('partTimeWork', { enabled: v })} />
          </div>
          {src.partTimeWork.enabled && (
            <div className="pt-2 border-t border-slate-100">
              <FieldRow label="Annual income">
                <CurrencyInput value={src.partTimeWork.annualIncome} onChange={(v) => set('partTimeWork', { annualIncome: v })} max={150000} step={500} />
              </FieldRow>
              <FieldRow label="Stop working at age">
                <AgeInput value={src.partTimeWork.stopAge} onChange={(v) => set('partTimeWork', { stopAge: v })} min={currentAge + 1} max={80} />
              </FieldRow>
            </div>
          )}
        </Card>

        {/* Other Income */}
        <Card>
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2"><span>💸</span><h5 className="font-bold text-slate-800">Other Income</h5></div>
              <p className="text-xs text-slate-400 mt-0.5">Trust income, regular gift, or any other stream</p>
            </div>
            <Toggle checked={src.otherIncome.enabled} onChange={(v) => set('otherIncome', { enabled: v })} />
          </div>
          {src.otherIncome.enabled && (
            <div className="pt-2 border-t border-slate-100">
              <FieldRow label="Description">
                <input type="text" value={src.otherIncome.description}
                  onChange={(e) => set('otherIncome', { description: e.target.value })}
                  placeholder="e.g. Trust income" className="input-base py-1.5 text-sm w-44" />
              </FieldRow>
              <FieldRow label="Annual amount">
                <CurrencyInput value={src.otherIncome.annualAmount} onChange={(v) => set('otherIncome', { annualAmount: v })} max={200000} step={500} />
              </FieldRow>
              <FieldRow label="From age">
                <AgeInput value={src.otherIncome.startAge} onChange={(v) => set('otherIncome', { startAge: v })} min={currentAge} max={90} />
              </FieldRow>
              <FieldRow label="Stop at age" hint="0 = indefinite">
                <AgeInput value={src.otherIncome.stopAge} onChange={(v) => set('otherIncome', { stopAge: v })} min={0} max={110} />
              </FieldRow>
            </div>
          )}
        </Card>
      </PriorityGroup>
    </div>
  );
}

// ─── Assets sub-section ───────────────────────────────────────────────────────

function AssetsSection({
  assets,
  set,
}: {
  assets: PersonAssets;
  set: (key: keyof PersonAssets, u: Record<string, unknown>) => void;
}) {
  const { cashSavings, isaInvestments, generalInvestments, property } = assets;
  const giaGain  = generalInvestments.enabled ? Math.max(0, generalInvestments.totalValue - generalInvestments.baseCost) : 0;
  const propGain = property.enabled           ? Math.max(0, property.propertyValue - property.baseCost) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">🏦</span>
        <div>
          <h4 className="font-bold text-slate-700 text-base">Assets</h4>
          <p className="text-xs text-slate-400">Individual savings, investments and property. Base costs captured for CGT.</p>
        </div>
      </div>

      {/* Cash Savings */}
      <Card>
        <div className="flex items-start justify-between mb-3">
          <div><div className="flex items-center gap-2"><span>💵</span><h5 className="font-bold text-slate-800">Cash Savings</h5></div>
            <p className="text-xs text-slate-400 mt-0.5">Current accounts, savings accounts, Premium Bonds</p></div>
          <Toggle checked={cashSavings.enabled} onChange={(v) => set('cashSavings', { enabled: v })} />
        </div>
        {cashSavings.enabled && (
          <div className="pt-2 border-t border-slate-100">
            <FieldRow label="Total cash savings">
              <CurrencyInput value={cashSavings.totalValue} onChange={(v) => set('cashSavings', { totalValue: v })} max={500000} step={1000} />
            </FieldRow>
          </div>
        )}
      </Card>

      {/* ISA */}
      <Card>
        <div className="flex items-start justify-between mb-3">
          <div><div className="flex items-center gap-2"><span>📈</span><h5 className="font-bold text-slate-800">ISA &amp; Investments</h5></div>
            <p className="text-xs text-slate-400 mt-0.5">Stocks &amp; Shares ISA — withdrawals are completely tax-free</p></div>
          <Toggle checked={isaInvestments.enabled} onChange={(v) => set('isaInvestments', { enabled: v })} />
        </div>
        {isaInvestments.enabled && (
          <div className="pt-2 border-t border-slate-100">
            <FieldRow label="Total ISA value">
              <CurrencyInput value={isaInvestments.totalValue} onChange={(v) => set('isaInvestments', { totalValue: v })} max={2000000} step={1000} />
            </FieldRow>
            <FieldRow label="Annual growth rate">
              <PctInput value={isaInvestments.growthRate} onChange={(v) => set('isaInvestments', { growthRate: v })} />
            </FieldRow>
            <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
              Completely tax-free on withdrawal — no income tax, no CGT, no impact on personal allowance.
            </div>
          </div>
        )}
      </Card>

      {/* GIA */}
      <Card>
        <div className="flex items-start justify-between mb-3">
          <div><div className="flex items-center gap-2"><span>📊</span><h5 className="font-bold text-slate-800">General Investments (GIA)</h5></div>
            <p className="text-xs text-slate-400 mt-0.5">Shares, funds or bonds held outside an ISA</p></div>
          <Toggle checked={generalInvestments.enabled} onChange={(v) => set('generalInvestments', { enabled: v })} />
        </div>
        {generalInvestments.enabled && (
          <div className="pt-2 border-t border-slate-100">
            <FieldRow label="Current market value">
              <CurrencyInput value={generalInvestments.totalValue} onChange={(v) => set('generalInvestments', { totalValue: v })} max={2000000} step={1000} />
            </FieldRow>
            <FieldRow label="Purchase price / base cost" hint="Original cost — used for CGT calculation">
              <CurrencyInput value={generalInvestments.baseCost} onChange={(v) => set('generalInvestments', { baseCost: v })} max={2000000} step={1000} />
            </FieldRow>
            <FieldRow label="Annual growth rate">
              <PctInput value={generalInvestments.growthRate} onChange={(v) => set('generalInvestments', { growthRate: v })} />
            </FieldRow>
            <div className={`mt-2 text-xs rounded-lg px-3 py-2 ${giaGain > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-500'}`}>
              {giaGain > 0 ? (
                <>Unrealised gain: <strong>£{giaGain.toLocaleString('en-GB')}</strong> · CGT applies on gains above £3,000 annual exempt amount. Rates: 10% (basic) / 20% (higher).</>
              ) : (
                'No unrealised gain. CGT will only apply once gains exceed the £3,000 annual exempt amount.'
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Property */}
      <Card>
        <div className="flex items-start justify-between mb-3">
          <div><div className="flex items-center gap-2"><span>🏘️</span><h5 className="font-bold text-slate-800">Property</h5></div>
            <p className="text-xs text-slate-400 mt-0.5">Main home or rental — rental income feeds into Priority 2</p></div>
          <Toggle checked={property.enabled} onChange={(v) => set('property', { enabled: v })} />
        </div>
        {property.enabled && (
          <div className="pt-2 border-t border-slate-100">
            <FieldRow label="Current property value" hint="Today's estimated market value">
              <CurrencyInput value={property.propertyValue} onChange={(v) => set('property', { propertyValue: v })} max={5000000} step={5000} />
            </FieldRow>
            <FieldRow label="Purchase price / base cost" hint="Original purchase price — for CGT planning">
              <CurrencyInput value={property.baseCost} onChange={(v) => set('property', { baseCost: v })} max={5000000} step={5000} />
            </FieldRow>
            <FieldRow label="Annual net rental income" hint="0 if owner-occupied / not rented out">
              <CurrencyInput value={property.annualRent} onChange={(v) => set('property', { annualRent: v })} max={100000} step={500} />
            </FieldRow>
            {property.annualRent > 0 && (
              <FieldRow label="Duration (years from now)">
                <div className="flex items-center gap-2">
                  <input type="number" min={1} max={50} value={property.durationYears}
                    onChange={(e) => { const v = parseInt(e.target.value); if (!isNaN(v)) set('property', { durationYears: v }); }}
                    className="w-20 input-base text-center py-1.5 text-sm" />
                  <span className="text-sm text-slate-500">years</span>
                </div>
              </FieldRow>
            )}
            {propGain > 0 && (
              <div className="mt-2 text-xs text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                Unrealised gain: <strong>£{propGain.toLocaleString('en-GB')}</strong> · Base cost captured for future downsizing / sale CGT planning.
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Step3IncomeSources({ onNext, onBack }: Props) {
  const {
    mode,
    person1, setP1Income, setP1Asset,
    person2, setP2Income, setP2Asset,
    assumptions, updateAssumptions,
  } = usePlannerStore();

  const [activePerson, setActivePerson] = useState<'person1' | 'person2'>('person1');
  const [activeTab, setActiveTab]       = useState<'income' | 'assets'>('income');

  const p1Label = person1.name || 'Partner 1';
  const p2Label = person2.name || 'Partner 2';

  const isPerson1 = mode === 'single' || activePerson === 'person1';
  const person    = isPerson1 ? person1 : person2;
  const setIncome = isPerson1 ? setP1Income : setP2Income;
  const setAsset  = isPerson1 ? setP1Asset  : setP2Asset;

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-1">Income &amp; Assets</h2>
        <p className="text-slate-500 text-base">
          Enter all income streams and assets {mode === 'couple' ? 'individually for each person' : 'for you'}.
          Income is grouped by priority — guaranteed sources first.
        </p>
      </div>

      {/* Person selector (couple only) */}
      {mode === 'couple' && (
        <div className="flex gap-2">
          {(['person1', 'person2'] as const).map((p) => {
            const label = p === 'person1' ? p1Label : p2Label;
            const active = activePerson === p;
            return (
              <button
                key={p}
                onClick={() => { setActivePerson(p); setActiveTab('income'); }}
                className={clsx(
                  'flex-1 py-3 px-4 rounded-xl border-2 font-semibold transition-all text-sm',
                  active
                    ? p === 'person1' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                )}
              >
                {p === 'person1' ? '👤' : '👥'} {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Income / Assets tab switcher */}
      <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
        {(['income', 'assets'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'flex-1 py-2 rounded-lg font-semibold text-sm transition-all capitalize',
              activeTab === tab ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {tab === 'income' ? '💷 Income' : '🏦 Assets'}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'income' ? (
        <IncomeSection
          currentAge={person.currentAge}
          src={person.incomeSources}
          assets={person.assets}
          set={setIncome}
        />
      ) : (
        <AssetsSection
          assets={person.assets}
          set={setAsset}
        />
      )}

      {/* Assumptions */}
      <Card className="bg-slate-50">
        <h3 className="font-bold text-slate-700 mb-1">Model assumptions</h3>
        <p className="text-xs text-slate-400 mb-4">Applied to all projections. Defaults are UK long-run averages.</p>
        <div className="grid sm:grid-cols-2 gap-0">
          <FieldRow label="Investment growth" hint="Expected annual return on investments">
            <PctInput value={assumptions.investmentGrowth} onChange={(v) => updateAssumptions({ investmentGrowth: v })} />
          </FieldRow>
          <FieldRow label="Inflation" hint="Applied to future spending and indexed income">
            <PctInput value={assumptions.inflation} onChange={(v) => updateAssumptions({ inflation: v })} />
          </FieldRow>
        </div>
      </Card>

      <div className="flex justify-between pt-4">
        <button onClick={onBack} className="btn-secondary">Back</button>
        <button onClick={onNext} className="btn-primary px-10">See my dashboard →</button>
      </div>
    </div>
  );
}
