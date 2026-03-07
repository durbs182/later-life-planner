'use client';

import { useState } from 'react';
import { usePlannerStore } from '@/store/plannerStore';
import Toggle from '@/components/ui/Toggle';
import CurrencyInput from '@/components/ui/CurrencyInput';
import type { PersonIncomeSources, PersonAssets, AssetOwner } from '@/lib/types';
import clsx from 'clsx';

interface Props { onNext: () => void; onBack: () => void }

// ─── Primitives ───────────────────────────────────────────────────────────────

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-slate-100 last:border-0">
      <div>
        <span className="text-sm font-semibold text-slate-700">{label}</span>
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

function OwnerSelect({ value, onChange, mode, p1Label, p2Label }: {
  value: AssetOwner; onChange: (v: AssetOwner) => void; mode: 'single' | 'couple';
  p1Label: string; p2Label: string;
}) {
  if (mode === 'single') return null;
  const opts: { v: AssetOwner; label: string }[] = [
    { v: 'p1',    label: p1Label },
    { v: 'p2',    label: p2Label },
    { v: 'joint', label: 'Joint' },
  ];
  return (
    <div className="flex gap-1.5">
      {opts.map(o => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className={clsx('px-2.5 py-1 rounded-lg text-xs font-bold border transition-all',
            value === o.v ? 'bg-orange-500 border-orange-500 text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-orange-300'
          )}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Source card ──────────────────────────────────────────────────────────────

function SourceCard({ icon, title, desc, enabled, onToggle, children }: {
  icon: string; title: string; desc: string;
  enabled: boolean; onToggle: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className={clsx('rounded-2xl border-2 overflow-hidden transition-all',
      enabled ? 'border-orange-200 bg-white' : 'border-slate-200 bg-slate-50/50'
    )}>
      <div className="flex items-start justify-between p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl mt-0.5 flex-shrink-0">{icon}</span>
          <div>
            <p className={clsx('font-bold text-sm', enabled ? 'text-slate-800' : 'text-slate-500')}>{title}</p>
            <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
          </div>
        </div>
        <Toggle checked={enabled} onChange={onToggle} />
      </div>
      {enabled && children && (
        <div className="border-t border-orange-100 px-4 pb-2">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Priority group ───────────────────────────────────────────────────────────

function PriorityGroup({ number, title, subtitle, badge, badgeClass, children }: {
  number: number; title: string; subtitle: string;
  badge: string; badgeClass: string; children: React.ReactNode;
}) {
  return (
    <div className="game-card">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-slate-800 text-white text-sm font-black flex items-center justify-center flex-shrink-0">
          {number}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-0.5">
            <span className="font-black text-slate-800">{title}</span>
            <span className={clsx('text-xs font-bold px-2.5 py-0.5 rounded-full', badgeClass)}>{badge}</span>
          </div>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

// ─── Income section ───────────────────────────────────────────────────────────

function IncomeSection({ currentAge, src, assets, set }: {
  currentAge: number;
  src: PersonIncomeSources;
  assets: PersonAssets;
  set: (key: keyof PersonIncomeSources, u: Record<string, unknown>) => void;
}) {
  const hasRentalProperty = assets.property.enabled && assets.property.annualRent > 0;
  const annuity = src.annuity ?? { enabled: false, annualIncome: 0, startAge: 65 };

  return (
    <div className="space-y-4">
      <PriorityGroup number={1} title="Guaranteed & Secure Income"
        subtitle="Fill your personal allowance first — lowest tax drag"
        badge="Draw first" badgeClass="bg-sky-100 text-sky-700"
      >
        <SourceCard icon="🏢" title="DB / Final Salary Pension"
          desc="Guaranteed income from an employer scheme — indexed to inflation"
          enabled={src.dbPension.enabled} onToggle={(v) => set('dbPension', { enabled: v })}
        >
          <FieldRow label="Annual income (today's £)">
            <CurrencyInput value={src.dbPension.annualIncome} onChange={(v) => set('dbPension', { annualIncome: v })} max={100000} step={100} />
          </FieldRow>
          <FieldRow label="Start age">
            <AgeInput value={src.dbPension.startAge} onChange={(v) => set('dbPension', { startAge: v })} min={55} max={75} />
          </FieldRow>
        </SourceCard>

        <SourceCard icon="📜" title="Annuity"
          desc="Purchased annuity — guaranteed income for life or a fixed term"
          enabled={annuity.enabled} onToggle={(v) => set('annuity', { enabled: v })}
        >
          <FieldRow label="Annual income">
            <CurrencyInput value={annuity.annualIncome} onChange={(v) => set('annuity', { annualIncome: v })} max={100000} step={100} />
          </FieldRow>
          <FieldRow label="Starts at age">
            <AgeInput value={annuity.startAge} onChange={(v) => set('annuity', { startAge: v })} min={55} max={85} />
          </FieldRow>
          <div className="py-2 text-xs text-sky-700 bg-sky-50 rounded-xl px-3">
            Annuity income is taxable — modelled alongside DB pension and State Pension.
          </div>
        </SourceCard>

        <SourceCard icon="🏛️" title="State Pension"
          desc="UK new State Pension — up to £221.20/week (2024/25)"
          enabled={src.statePension.enabled} onToggle={(v) => set('statePension', { enabled: v })}
        >
          <FieldRow label="Weekly amount" hint="Check your forecast at gov.uk/check-state-pension">
            <CurrencyInput value={src.statePension.weeklyAmount} onChange={(v) => set('statePension', { weeklyAmount: v })} max={300} step={1} />
          </FieldRow>
          <FieldRow label="Start age" hint="Currently 66, rising to 67 by 2028">
            <AgeInput value={src.statePension.startAge} onChange={(v) => set('statePension', { startAge: v })} min={60} max={75} />
          </FieldRow>
          <div className="py-2 text-xs text-sky-700 bg-sky-50 rounded-xl px-3">
            Annual: <strong>£{(src.statePension.weeklyAmount * 52).toLocaleString('en-GB')}</strong> · Indexed to inflation
          </div>
        </SourceCard>
      </PriorityGroup>

      <PriorityGroup number={2} title="Property Income"
        subtitle="Rental income — taxed as income in your personal assessment"
        badge="Taxed as income" badgeClass="bg-amber-100 text-amber-700"
      >
        <div className="rounded-2xl border-2 border-slate-200 bg-slate-50/50 p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🏘️</span>
            <div>
              {hasRentalProperty ? (
                <>
                  <p className="font-bold text-slate-800 text-sm">Rental property configured</p>
                  <p className="text-sm text-slate-600 mt-0.5">
                    Annual net rent: <span className="font-bold text-emerald-600">£{assets.property.annualRent.toLocaleString('en-GB')}/yr</span>{' '}
                    for {assets.property.durationYears} year{assets.property.durationYears !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Property details are in the Assets tab below.</p>
                </>
              ) : (
                <>
                  <p className="font-bold text-slate-800 text-sm">No rental income configured</p>
                  <p className="text-xs text-slate-400 mt-0.5">Enable a property in the <strong>Assets tab</strong> and set annual rental income.</p>
                </>
              )}
            </div>
          </div>
        </div>
      </PriorityGroup>

      <PriorityGroup number={3} title="Flexible Income"
        subtitle="DC pension, work and other sources — drawn after guaranteed income"
        badge="Flexible" badgeClass="bg-violet-100 text-violet-700"
      >
        <SourceCard icon="💼" title="DC / Personal Pension"
          desc="Workplace or personal pension pot — flexible drawdown"
          enabled={src.dcPension.enabled} onToggle={(v) => set('dcPension', { enabled: v })}
        >
          <FieldRow label="Current pot value">
            <CurrencyInput value={src.dcPension.totalValue} onChange={(v) => set('dcPension', { totalValue: v })} max={2000000} step={1000} />
          </FieldRow>
          <FieldRow label="Drawdown start age">
            <AgeInput value={src.dcPension.drawdownAge} onChange={(v) => set('dcPension', { drawdownAge: v })} min={55} max={80} />
          </FieldRow>
          <FieldRow label="Annual growth rate">
            <PctInput value={src.dcPension.growthRate} onChange={(v) => set('dcPension', { growthRate: v })} />
          </FieldRow>
          <div className="py-2 text-xs text-slate-500 bg-slate-50 rounded-xl px-3">
            25% PCLS taken tax-free at crystallisation (HMRC maximum, fixed). Remaining pot drawn via UFPLS (25% of each withdrawal tax-free).
          </div>
        </SourceCard>

        <SourceCard icon="💻" title="Work / Consultancy"
          desc="Part-time work, freelance or self-employment"
          enabled={src.partTimeWork.enabled} onToggle={(v) => set('partTimeWork', { enabled: v })}
        >
          <FieldRow label="Annual income">
            <CurrencyInput value={src.partTimeWork.annualIncome} onChange={(v) => set('partTimeWork', { annualIncome: v })} max={150000} step={500} />
          </FieldRow>
          <FieldRow label="Stop working at age">
            <AgeInput value={src.partTimeWork.stopAge} onChange={(v) => set('partTimeWork', { stopAge: v })} min={currentAge + 1} max={80} />
          </FieldRow>
        </SourceCard>

        <SourceCard icon="💸" title="Other Income"
          desc="Trust income, regular gift, or any other stream"
          enabled={src.otherIncome.enabled} onToggle={(v) => set('otherIncome', { enabled: v })}
        >
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
        </SourceCard>
      </PriorityGroup>
    </div>
  );
}

// ─── Assets section ───────────────────────────────────────────────────────────

function AssetsSection({ assets, set, mode, p1Label, p2Label }: {
  assets: PersonAssets;
  set: (key: keyof PersonAssets, u: Record<string, unknown>) => void;
  mode: 'single' | 'couple';
  p1Label: string; p2Label: string;
}) {
  const { cashSavings, isaInvestments, generalInvestments, property } = assets;
  const giaGain  = generalInvestments.enabled ? Math.max(0, generalInvestments.totalValue - generalInvestments.baseCost) : 0;
  const propGain = property.enabled           ? Math.max(0, property.propertyValue - property.baseCost) : 0;

  return (
    <div className="space-y-4">
      <SourceCard icon="💵" title="Cash Savings"
        desc="Current accounts, savings accounts, Premium Bonds"
        enabled={cashSavings.enabled} onToggle={(v) => set('cashSavings', { enabled: v })}
      >
        <FieldRow label="Total cash savings">
          <CurrencyInput value={cashSavings.totalValue} onChange={(v) => set('cashSavings', { totalValue: v })} max={500000} step={1000} />
        </FieldRow>
      </SourceCard>

      <SourceCard icon="📈" title="ISA & Investments"
        desc="Stocks & Shares ISA — withdrawals are completely tax-free"
        enabled={isaInvestments.enabled} onToggle={(v) => set('isaInvestments', { enabled: v })}
      >
        <FieldRow label="Total ISA value">
          <CurrencyInput value={isaInvestments.totalValue} onChange={(v) => set('isaInvestments', { totalValue: v })} max={2000000} step={1000} />
        </FieldRow>
        <FieldRow label="Annual growth rate">
          <PctInput value={isaInvestments.growthRate} onChange={(v) => set('isaInvestments', { growthRate: v })} />
        </FieldRow>
        <div className="py-2 text-xs text-emerald-700 bg-emerald-50 rounded-xl px-3">
          Completely tax-free on withdrawal — no income tax, no CGT, no impact on personal allowance.
        </div>
      </SourceCard>

      <SourceCard icon="📊" title="General Investments (GIA)"
        desc="Shares, funds or bonds held outside an ISA"
        enabled={generalInvestments.enabled} onToggle={(v) => set('generalInvestments', { enabled: v })}
      >
        <FieldRow label="Current market value">
          <CurrencyInput value={generalInvestments.totalValue} onChange={(v) => set('generalInvestments', { totalValue: v })} max={2000000} step={1000} />
        </FieldRow>
        <FieldRow label="Purchase price / base cost" hint="Original cost — for CGT calculation">
          <CurrencyInput value={generalInvestments.baseCost} onChange={(v) => set('generalInvestments', { baseCost: v })} max={2000000} step={1000} />
        </FieldRow>
        <FieldRow label="Annual growth rate">
          <PctInput value={generalInvestments.growthRate} onChange={(v) => set('generalInvestments', { growthRate: v })} />
        </FieldRow>
        {mode === 'couple' && (
          <FieldRow label="Ownership" hint="Joint splits CGT gains between both persons">
            <OwnerSelect value={generalInvestments.owner ?? 'p1'} onChange={(v) => set('generalInvestments', { owner: v })} mode={mode} p1Label={p1Label} p2Label={p2Label} />
          </FieldRow>
        )}
        {giaGain > 0 && (
          <div className="py-2 text-xs text-amber-700 bg-amber-50 rounded-xl px-3">
            Unrealised gain: <strong>£{giaGain.toLocaleString('en-GB')}</strong> · CGT applies on gains above £3,000 annual exempt amount.
            {generalInvestments.owner === 'joint' && ' Joint ownership splits gains across both persons\' CGT allowances.'}
          </div>
        )}
      </SourceCard>

      <SourceCard icon="🏘️" title="Property"
        desc="Main home or rental — rental income feeds into Priority 2"
        enabled={property.enabled} onToggle={(v) => set('property', { enabled: v })}
      >
        <FieldRow label="Current property value">
          <CurrencyInput value={property.propertyValue} onChange={(v) => set('property', { propertyValue: v })} max={5000000} step={5000} />
        </FieldRow>
        <FieldRow label="Purchase price / base cost" hint="For CGT planning">
          <CurrencyInput value={property.baseCost} onChange={(v) => set('property', { baseCost: v })} max={5000000} step={5000} />
        </FieldRow>
        <FieldRow label="Annual net rental income" hint="0 if owner-occupied">
          <CurrencyInput value={property.annualRent} onChange={(v) => set('property', { annualRent: v })} max={100000} step={500} />
        </FieldRow>
        {mode === 'couple' && (
          <FieldRow label="Ownership">
            <OwnerSelect value={property.owner ?? 'p1'} onChange={(v) => set('property', { owner: v })} mode={mode} p1Label={p1Label} p2Label={p2Label} />
          </FieldRow>
        )}
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
          <div className="py-2 text-xs text-sky-700 bg-sky-50 rounded-xl px-3">
            Unrealised gain: <strong>£{propGain.toLocaleString('en-GB')}</strong> · Base cost captured for future CGT planning.
          </div>
        )}
      </SourceCard>
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

  const p1Label = person1.name || 'You';
  const p2Label = person2.name || 'Partner';

  const isPerson1 = mode === 'single' || activePerson === 'person1';
  const person    = isPerson1 ? person1 : person2;
  const setIncome = isPerson1 ? setP1Income : setP2Income;
  const setAsset  = isPerson1 ? setP1Asset  : setP2Asset;

  return (
    <div className="space-y-5 pb-24">

      {/* Hero */}
      <div className="text-center pt-4 pb-2">
        <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 text-xs font-bold px-4 py-1.5 rounded-full mb-3">
          💷 Step 4 of 5 — Income & Assets
        </div>
        <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-2 tracking-tight">
          Where will the{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-400">money come from?</span>
        </h2>
        <p className="text-slate-500">Capture all income streams and assets. Guaranteed sources first.</p>
      </div>

      {/* Person selector (couple only) */}
      {mode === 'couple' && (
        <div className="flex gap-2">
          {(['person1', 'person2'] as const).map((p) => {
            const label  = p === 'person1' ? p1Label : p2Label;
            const active = activePerson === p;
            const color  = p === 'person1' ? { on: 'bg-orange-500 border-orange-500 text-white', off: 'bg-white border-slate-200 text-slate-600 hover:border-slate-300' }
                                           : { on: 'bg-emerald-500 border-emerald-500 text-white', off: 'bg-white border-slate-200 text-slate-600 hover:border-slate-300' };
            return (
              <button key={p} onClick={() => { setActivePerson(p); setActiveTab('income'); }}
                className={clsx('flex-1 py-2.5 px-4 rounded-2xl border-2 font-semibold text-sm transition-all', active ? color.on : color.off)}
              >
                {p === 'person1' ? '👤' : '👥'} {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Income / Assets switcher */}
      <div className="flex bg-slate-100 rounded-2xl p-1 gap-1">
        {(['income', 'assets'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={clsx('flex-1 py-2.5 rounded-xl font-bold text-sm transition-all',
              activeTab === tab ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            )}
          >
            {tab === 'income' ? '💷 Income' : '🏦 Assets'}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'income' ? (
        <IncomeSection currentAge={person.currentAge} src={person.incomeSources} assets={person.assets} set={setIncome} />
      ) : (
        <AssetsSection assets={person.assets} set={setAsset} mode={mode} p1Label={p1Label} p2Label={p2Label} />
      )}

      {/* Assumptions */}
      <div className="game-card bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200">
        <h3 className="section-heading">Model assumptions</h3>
        <p className="text-xs text-slate-500 mb-4">Applied to all projections. Defaults are UK long-run averages.</p>
        <div className="grid sm:grid-cols-2 gap-0">
          <FieldRow label="Investment growth" hint="Expected annual return on investments">
            <PctInput value={assumptions.investmentGrowth} onChange={(v) => updateAssumptions({ investmentGrowth: v })} />
          </FieldRow>
          <FieldRow label="Inflation" hint="Applied to future spending and indexed income">
            <PctInput value={assumptions.inflation} onChange={(v) => updateAssumptions({ inflation: v })} />
          </FieldRow>
        </div>
      </div>

      <div className="flex justify-between pt-4">
        <button onClick={onBack} className="btn-secondary">← Back</button>
        <button onClick={onNext} className="btn-primary px-10 text-base">See my dashboard →</button>
      </div>
    </div>
  );
}
