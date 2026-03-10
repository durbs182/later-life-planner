'use client';

import { useState } from 'react';
import { usePlannerStore } from '@/store/plannerStore';
import CurrencyInput from '@/components/ui/CurrencyInput';
import clsx from 'clsx';

// ─── Types ────────────────────────────────────────────────────────────────────

type DbEntry  = { annualIncome: number; startAge: number };
type DcEntry  = { value: number; growthRate: number };
type IsaEntry = { value: number; growthRate: number };
type GiaEntry = { value: number; baseCost: number; growthRate: number };

type PersonDraft = {
  statePension: { enabled: boolean; weeklyAmount: number; startAge: number };
  dbPensions:   DbEntry[];
  annuity:      { enabled: boolean; annualIncome: number; startAge: number };
  otherIncome:  { enabled: boolean; annualAmount: number; startAge: number };
  dcPensions:   DcEntry[];
  isas:         IsaEntry[];
  gias:         GiaEntry[];
  cashSavings:  number;
};

function emptyDraft(): PersonDraft {
  return {
    statePension: { enabled: false, weeklyAmount: 221, startAge: 67 },
    dbPensions:   [],
    annuity:      { enabled: false, annualIncome: 0, startAge: 65 },
    otherIncome:  { enabled: false, annualAmount: 0, startAge: 65 },
    dcPensions:   [],
    isas:         [],
    gias:         [],
    cashSavings:  0,
  };
}

// ─── Step definitions ─────────────────────────────────────────────────────────

type StepId =
  | 'sp' | 'db' | 'annuity' | 'other'
  | 'dc' | 'isa' | 'gia' | 'cash';

const INCOME_STEPS: StepId[] = ['sp', 'db', 'annuity', 'other'];
const ASSET_STEPS:  StepId[] = ['dc', 'isa', 'gia', 'cash'];

const STEP_META: Record<StepId, { icon: string; title: string; desc: string }> = {
  sp:      { icon: '🏛️', title: 'State Pension',                   desc: 'UK new State Pension' },
  db:      { icon: '🏢', title: 'Defined Benefit pension',          desc: 'Final salary / employer scheme' },
  annuity: { icon: '📜', title: 'Annuity',                          desc: 'Guaranteed income for life' },
  other:   { icon: '💸', title: 'Other regular income',             desc: 'Trust, gift, or other stream' },
  dc:      { icon: '💼', title: 'DC / Personal pension pot(s)',      desc: 'Workplace pension, SIPP' },
  isa:     { icon: '📈', title: 'ISA(s)',                            desc: 'Stocks & Shares or Cash ISA' },
  gia:     { icon: '📊', title: 'General investment account(s)',     desc: 'Shares or funds outside an ISA' },
  cash:    { icon: '💵', title: 'Cash savings',                      desc: 'Savings accounts, Premium Bonds' },
};

// ─── Small helpers ────────────────────────────────────────────────────────────

function AgeStepper({ value, onChange, min = 55, max = 85 }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
        className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-30 font-bold text-xl flex items-center justify-center transition-colors">−</button>
      <span className="w-12 text-center font-black text-slate-800 text-lg tabular-nums">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
        className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-30 font-bold text-xl flex items-center justify-center transition-colors">+</button>
    </div>
  );
}

function GrowthStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={() => onChange(Math.max(0, Math.round((value - 0.5) * 10) / 10))} disabled={value <= 0}
        className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-30 font-bold text-xl flex items-center justify-center transition-colors">−</button>
      <span className="w-14 text-center font-black text-slate-800 text-lg tabular-nums">{value}%</span>
      <button type="button" onClick={() => onChange(Math.min(15, Math.round((value + 0.5) * 10) / 10))} disabled={value >= 15}
        className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-30 font-bold text-xl flex items-center justify-center transition-colors">+</button>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      {children}
    </div>
  );
}

function ItemCard({ children, onRemove, title }: { children: React.ReactNode; onRemove?: () => void; title: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-600">{title}</span>
        {onRemove && (
          <button onClick={onRemove} className="text-xs text-rose-400 hover:text-rose-600 font-semibold">Remove</button>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Individual step screens ──────────────────────────────────────────────────

function StepSP({ draft, onChange }: { draft: PersonDraft; onChange: (d: PersonDraft) => void }) {
  const sp = draft.statePension;
  const upd = (p: Partial<typeof sp>) => onChange({ ...draft, statePension: { ...sp, ...p } });
  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        {[true, false].map((v) => (
          <button key={String(v)} onClick={() => upd({ enabled: v })}
            className={clsx('flex-1 py-3 rounded-2xl border-2 font-bold text-sm transition-all',
              sp.enabled === v ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-500 hover:border-orange-200'
            )}>
            {v ? 'Yes, I have one' : "No / Not sure"}
          </button>
        ))}
      </div>
      {sp.enabled && (
        <>
          <Field label="Weekly amount" hint="Check your forecast at gov.uk/check-state-pension — full amount is £221.20/week (2024/25)">
            <CurrencyInput value={sp.weeklyAmount} onChange={(v) => upd({ weeklyAmount: v })} max={300} step={1} />
          </Field>
          <Field label="Expected start age">
            <AgeStepper value={sp.startAge} onChange={(v) => upd({ startAge: v })} min={66} max={75} />
          </Field>
          <div className="rounded-xl bg-sky-50 border border-sky-100 p-3 text-xs text-sky-700">
            Annual value: <strong>£{(sp.weeklyAmount * 52).toLocaleString('en-GB')}</strong> · Increases with inflation each year
          </div>
        </>
      )}
    </div>
  );
}

function StepDB({ draft, onChange }: { draft: PersonDraft; onChange: (d: PersonDraft) => void }) {
  const dbs = draft.dbPensions;
  const add = () => onChange({ ...draft, dbPensions: [...dbs, { annualIncome: 0, startAge: 65 }] });
  const remove = (i: number) => onChange({ ...draft, dbPensions: dbs.filter((_, idx) => idx !== i) });
  const upd = (i: number, p: Partial<DbEntry>) => onChange({ ...draft, dbPensions: dbs.map((e, idx) => idx === i ? { ...e, ...p } : e) });

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        {[true, false].map((v) => (
          <button key={String(v)} onClick={() => v ? (dbs.length === 0 && add()) : onChange({ ...draft, dbPensions: [] })}
            className={clsx('flex-1 py-3 rounded-2xl border-2 font-bold text-sm transition-all',
              (v ? dbs.length > 0 : dbs.length === 0) ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-500 hover:border-orange-200'
            )}>
            {v ? 'Yes, I have one' : 'No'}
          </button>
        ))}
      </div>
      {dbs.map((db, i) => (
        <ItemCard key={i} title={`Scheme ${i + 1}`} onRemove={dbs.length > 1 ? () => remove(i) : undefined}>
          <Field label="Annual income (today's £)">
            <CurrencyInput value={db.annualIncome} onChange={(v) => upd(i, { annualIncome: v })} max={100000} step={100} />
          </Field>
          <Field label="Starts at age">
            <AgeStepper value={db.startAge} onChange={(v) => upd(i, { startAge: v })} min={55} max={75} />
          </Field>
        </ItemCard>
      ))}
      {dbs.length > 0 && (
        <button onClick={add} className="w-full py-2.5 rounded-2xl border-2 border-dashed border-orange-200 text-orange-600 hover:bg-orange-50 text-sm font-semibold transition-all">
          + Add another DB scheme
        </button>
      )}
      {dbs.length > 1 && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-xs text-emerald-700">
          Combined annual income: <strong>£{dbs.reduce((s, e) => s + e.annualIncome, 0).toLocaleString('en-GB')}</strong>
        </div>
      )}
    </div>
  );
}

function StepAnnuity({ draft, onChange }: { draft: PersonDraft; onChange: (d: PersonDraft) => void }) {
  const a = draft.annuity;
  const upd = (p: Partial<typeof a>) => onChange({ ...draft, annuity: { ...a, ...p } });
  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        {[true, false].map((v) => (
          <button key={String(v)} onClick={() => upd({ enabled: v })}
            className={clsx('flex-1 py-3 rounded-2xl border-2 font-bold text-sm transition-all',
              a.enabled === v ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-500 hover:border-orange-200'
            )}>
            {v ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
      {a.enabled && (
        <>
          <Field label="Annual income">
            <CurrencyInput value={a.annualIncome} onChange={(v) => upd({ annualIncome: v })} max={100000} step={100} />
          </Field>
          <Field label="Starts at age">
            <AgeStepper value={a.startAge} onChange={(v) => upd({ startAge: v })} min={55} max={85} />
          </Field>
        </>
      )}
    </div>
  );
}

function StepOther({ draft, onChange }: { draft: PersonDraft; onChange: (d: PersonDraft) => void }) {
  const o = draft.otherIncome;
  const upd = (p: Partial<typeof o>) => onChange({ ...draft, otherIncome: { ...o, ...p } });
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">Trust income, a regular gift, part-time work — anything not already captured.</p>
      <div className="flex gap-3">
        {[true, false].map((v) => (
          <button key={String(v)} onClick={() => upd({ enabled: v })}
            className={clsx('flex-1 py-3 rounded-2xl border-2 font-bold text-sm transition-all',
              o.enabled === v ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-500 hover:border-orange-200'
            )}>
            {v ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
      {o.enabled && (
        <>
          <Field label="Annual amount">
            <CurrencyInput value={o.annualAmount} onChange={(v) => upd({ annualAmount: v })} max={200000} step={500} />
          </Field>
          <Field label="Starts at age">
            <AgeStepper value={o.startAge} onChange={(v) => upd({ startAge: v })} min={50} max={85} />
          </Field>
        </>
      )}
    </div>
  );
}

function StepDC({ draft, onChange }: { draft: PersonDraft; onChange: (d: PersonDraft) => void }) {
  const dcs = draft.dcPensions;
  const add = () => onChange({ ...draft, dcPensions: [...dcs, { value: 0, growthRate: 4 }] });
  const remove = (i: number) => onChange({ ...draft, dcPensions: dcs.filter((_, idx) => idx !== i) });
  const upd = (i: number, p: Partial<DcEntry>) => onChange({ ...draft, dcPensions: dcs.map((e, idx) => idx === i ? { ...e, ...p } : e) });
  const total = dcs.reduce((s, e) => s + e.value, 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Workplace pension, SIPP, or any personal pension pot.</p>
      <div className="flex gap-3">
        {[true, false].map((v) => (
          <button key={String(v)} onClick={() => v ? (dcs.length === 0 && add()) : onChange({ ...draft, dcPensions: [] })}
            className={clsx('flex-1 py-3 rounded-2xl border-2 font-bold text-sm transition-all',
              (v ? dcs.length > 0 : dcs.length === 0) ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-500 hover:border-orange-200'
            )}>
            {v ? 'Yes, I have one' : 'No'}
          </button>
        ))}
      </div>
      {dcs.map((dc, i) => (
        <ItemCard key={i} title={`Pension pot ${i + 1}`} onRemove={dcs.length > 1 ? () => remove(i) : undefined}>
          <Field label="Current value">
            <CurrencyInput value={dc.value} onChange={(v) => upd(i, { value: v })} max={2000000} step={1000} />
          </Field>
          <Field label="Expected annual growth" hint="A typical balanced portfolio returns 4–6% before charges">
            <GrowthStepper value={dc.growthRate} onChange={(v) => upd(i, { growthRate: v })} />
          </Field>
        </ItemCard>
      ))}
      {dcs.length > 0 && (
        <button onClick={add} className="w-full py-2.5 rounded-2xl border-2 border-dashed border-orange-200 text-orange-600 hover:bg-orange-50 text-sm font-semibold transition-all">
          + Add another pension pot
        </button>
      )}
      {dcs.length > 1 && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-xs text-emerald-700">
          Combined value: <strong>£{total.toLocaleString('en-GB')}</strong>
        </div>
      )}
    </div>
  );
}

function StepISA({ draft, onChange }: { draft: PersonDraft; onChange: (d: PersonDraft) => void }) {
  const isas = draft.isas;
  const add = () => onChange({ ...draft, isas: [...isas, { value: 0, growthRate: 4 }] });
  const remove = (i: number) => onChange({ ...draft, isas: isas.filter((_, idx) => idx !== i) });
  const upd = (i: number, p: Partial<IsaEntry>) => onChange({ ...draft, isas: isas.map((e, idx) => idx === i ? { ...e, ...p } : e) });
  const total = isas.reduce((s, e) => s + e.value, 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Stocks & Shares ISA or Cash ISA — withdrawals are completely tax-free.</p>
      <div className="flex gap-3">
        {[true, false].map((v) => (
          <button key={String(v)} onClick={() => v ? (isas.length === 0 && add()) : onChange({ ...draft, isas: [] })}
            className={clsx('flex-1 py-3 rounded-2xl border-2 font-bold text-sm transition-all',
              (v ? isas.length > 0 : isas.length === 0) ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-500 hover:border-orange-200'
            )}>
            {v ? 'Yes, I have one' : 'No'}
          </button>
        ))}
      </div>
      {isas.map((isa, i) => (
        <ItemCard key={i} title={`ISA ${i + 1}`} onRemove={isas.length > 1 ? () => remove(i) : undefined}>
          <Field label="Current value">
            <CurrencyInput value={isa.value} onChange={(v) => upd(i, { value: v })} max={2000000} step={1000} />
          </Field>
          <Field label="Expected annual growth">
            <GrowthStepper value={isa.growthRate} onChange={(v) => upd(i, { growthRate: v })} />
          </Field>
        </ItemCard>
      ))}
      {isas.length > 0 && (
        <button onClick={add} className="w-full py-2.5 rounded-2xl border-2 border-dashed border-orange-200 text-orange-600 hover:bg-orange-50 text-sm font-semibold transition-all">
          + Add another ISA
        </button>
      )}
      {isas.length > 1 && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-xs text-emerald-700">
          Combined value: <strong>£{total.toLocaleString('en-GB')}</strong>
        </div>
      )}
    </div>
  );
}

function StepGIA({ draft, onChange }: { draft: PersonDraft; onChange: (d: PersonDraft) => void }) {
  const gias = draft.gias;
  const add = () => onChange({ ...draft, gias: [...gias, { value: 0, baseCost: 0, growthRate: 4 }] });
  const remove = (i: number) => onChange({ ...draft, gias: gias.filter((_, idx) => idx !== i) });
  const upd = (i: number, p: Partial<GiaEntry>) => onChange({ ...draft, gias: gias.map((e, idx) => idx === i ? { ...e, ...p } : e) });
  const total = gias.reduce((s, e) => s + e.value, 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Shares, funds or bonds held in your own name — outside an ISA or pension.</p>
      <div className="flex gap-3">
        {[true, false].map((v) => (
          <button key={String(v)} onClick={() => v ? (gias.length === 0 && add()) : onChange({ ...draft, gias: [] })}
            className={clsx('flex-1 py-3 rounded-2xl border-2 font-bold text-sm transition-all',
              (v ? gias.length > 0 : gias.length === 0) ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-500 hover:border-orange-200'
            )}>
            {v ? 'Yes, I have one' : 'No'}
          </button>
        ))}
      </div>
      {gias.map((gia, i) => (
        <ItemCard key={i} title={`Account ${i + 1}`} onRemove={gias.length > 1 ? () => remove(i) : undefined}>
          <Field label="Current market value">
            <CurrencyInput value={gia.value} onChange={(v) => upd(i, { value: v })} max={2000000} step={1000} />
          </Field>
          <Field label="Purchase price / base cost" hint="Original cost — used for capital gains tax calculation">
            <CurrencyInput value={gia.baseCost} onChange={(v) => upd(i, { baseCost: v })} max={2000000} step={1000} />
          </Field>
          <Field label="Expected annual growth">
            <GrowthStepper value={gia.growthRate} onChange={(v) => upd(i, { growthRate: v })} />
          </Field>
        </ItemCard>
      ))}
      {gias.length > 0 && (
        <button onClick={add} className="w-full py-2.5 rounded-2xl border-2 border-dashed border-orange-200 text-orange-600 hover:bg-orange-50 text-sm font-semibold transition-all">
          + Add another account
        </button>
      )}
      {gias.length > 1 && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-xs text-emerald-700">
          Combined value: <strong>£{total.toLocaleString('en-GB')}</strong>
        </div>
      )}
    </div>
  );
}

function StepCash({ draft, onChange }: { draft: PersonDraft; onChange: (d: PersonDraft) => void }) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">Current accounts, savings accounts, Premium Bonds — enter the combined total.</p>
      <Field label="Total cash savings">
        <CurrencyInput value={draft.cashSavings} onChange={(v) => onChange({ ...draft, cashSavings: v })} max={500000} step={1000} />
      </Field>
    </div>
  );
}

// ─── Consolidate draft → store ────────────────────────────────────────────────

function weightedAvgGrowth(items: { value: number; growthRate: number }[]): number {
  const total = items.reduce((s, e) => s + e.value, 0);
  if (total === 0) return 4;
  return Math.round((items.reduce((s, e) => s + e.growthRate * e.value, 0) / total) * 10) / 10;
}

function applyDraft(
  draft: PersonDraft,
  setIncome: (k: string, u: Record<string, unknown>) => void,
  setAsset:  (k: string, u: Record<string, unknown>) => void,
) {
  setIncome('statePension', { enabled: draft.statePension.enabled, weeklyAmount: draft.statePension.weeklyAmount, startAge: draft.statePension.startAge });

  const dbTotal = draft.dbPensions.reduce((s, e) => s + e.annualIncome, 0);
  setIncome('dbPension', { enabled: dbTotal > 0, annualIncome: dbTotal, startAge: draft.dbPensions.length > 0 ? Math.min(...draft.dbPensions.map(e => e.startAge)) : 65 });

  setIncome('annuity', { enabled: draft.annuity.enabled, annualIncome: draft.annuity.annualIncome, startAge: draft.annuity.startAge });
  setIncome('otherIncome', { enabled: draft.otherIncome.enabled, annualAmount: draft.otherIncome.annualAmount, startAge: draft.otherIncome.startAge, stopAge: 0, description: 'Other income' });

  const dcTotal = draft.dcPensions.reduce((s, e) => s + e.value, 0);
  setIncome('dcPension', { enabled: dcTotal > 0, totalValue: dcTotal, growthRate: weightedAvgGrowth(draft.dcPensions) });

  const isaTotal = draft.isas.reduce((s, e) => s + e.value, 0);
  setAsset('isaInvestments', { enabled: isaTotal > 0, totalValue: isaTotal, growthRate: weightedAvgGrowth(draft.isas) });

  const giaTotal = draft.gias.reduce((s, e) => s + e.value, 0);
  setAsset('generalInvestments', { enabled: giaTotal > 0, totalValue: giaTotal, baseCost: draft.gias.reduce((s, e) => s + e.baseCost, 0), growthRate: weightedAvgGrowth(draft.gias) });

  setAsset('cashSavings', { enabled: draft.cashSavings > 0, totalValue: draft.cashSavings });
}

// ─── Wizard modal ─────────────────────────────────────────────────────────────

interface Props { onDone: () => void }

export default function GuidedSetupWizard({ onDone }: Props) {
  const { mode, person1, person2, setP1Income, setP1Asset, setP2Income, setP2Asset } = usePlannerStore();

  const p1Label = person1.name || 'You';
  const p2Label = person2.name || 'Partner';

  // Build flat list of steps: [p1 income steps..., p1 asset steps..., p2 income steps..., p2 asset steps...]
  type WizardStep = { person: 'p1' | 'p2'; stepId: StepId };
  const steps: WizardStep[] = [
    ...INCOME_STEPS.map(s => ({ person: 'p1' as const, stepId: s })),
    ...ASSET_STEPS.map(s  => ({ person: 'p1' as const, stepId: s })),
    ...(mode === 'couple' ? [
      ...INCOME_STEPS.map(s => ({ person: 'p2' as const, stepId: s })),
      ...ASSET_STEPS.map(s  => ({ person: 'p2' as const, stepId: s })),
    ] : []),
  ];

  const [idx, setIdx]       = useState(0);
  const [p1, setP1]         = useState<PersonDraft>(emptyDraft);
  const [p2, setP2]         = useState<PersonDraft>(emptyDraft);

  const current   = steps[idx];
  const isLast    = idx === steps.length - 1;
  const draft     = current.person === 'p1' ? p1 : p2;
  const setDraft  = current.person === 'p1' ? setP1 : setP2;
  const personLabel = current.person === 'p1' ? p1Label : p2Label;
  const meta      = STEP_META[current.stepId];

  // Group steps visually: income vs assets, and by person
  const isFirstP2Step = mode === 'couple' && current.person === 'p2' && steps[idx - 1]?.person === 'p1';
  const phase = INCOME_STEPS.includes(current.stepId) ? 'Income' : 'Savings & Investments';

  function handleSave() {
    applyDraft(p1, setP1Income as (k: string, u: Record<string, unknown>) => void, setP1Asset as (k: string, u: Record<string, unknown>) => void);
    if (mode === 'couple') {
      applyDraft(p2, setP2Income as (k: string, u: Record<string, unknown>) => void, setP2Asset as (k: string, u: Record<string, unknown>) => void);
    }
    onDone();
  }

  // Step content map
  const stepContent: Record<StepId, React.ReactNode> = {
    sp:      <StepSP      draft={draft} onChange={setDraft} />,
    db:      <StepDB      draft={draft} onChange={setDraft} />,
    annuity: <StepAnnuity draft={draft} onChange={setDraft} />,
    other:   <StepOther   draft={draft} onChange={setDraft} />,
    dc:      <StepDC      draft={draft} onChange={setDraft} />,
    isa:     <StepISA     draft={draft} onChange={setDraft} />,
    gia:     <StepGIA     draft={draft} onChange={setDraft} />,
    cash:    <StepCash    draft={draft} onChange={setDraft} />,
  };

  return (
    // Full-screen overlay
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh]">

        {/* Header */}
        <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="text-xl">{meta.icon}</span>
              <div>
                <p className="font-black text-slate-800 text-base leading-tight">{meta.title}</p>
                <p className="text-xs text-slate-400">{personLabel} · {phase}</p>
              </div>
            </div>
            <button onClick={onDone} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 text-lg leading-none transition-colors">×</button>
          </div>

          {/* Progress dots */}
          <div className="flex items-center gap-1 mt-3 flex-wrap">
            {steps.map((s, i) => {
              const isCurrent = i === idx;
              const isDone    = i < idx;
              const isP2Start = mode === 'couple' && s.person === 'p2' && (i === 0 || steps[i - 1].person === 'p1');
              return (
                <div key={i} className="flex items-center gap-1">
                  {isP2Start && <div className="w-px h-3 bg-slate-200 mx-0.5" />}
                  <div className={clsx('rounded-full transition-all', isCurrent ? 'w-5 h-2 bg-orange-500' : isDone ? 'w-2 h-2 bg-orange-300' : 'w-2 h-2 bg-slate-200')} />
                </div>
              );
            })}
          </div>
          {isFirstP2Step && (
            <p className="text-xs font-bold text-emerald-600 mt-2">Now setting up {p2Label}</p>
          )}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {stepContent[current.stepId]}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-slate-100 px-6 py-4 flex items-center justify-between bg-slate-50/50 sm:rounded-b-3xl">
          <button
            onClick={() => idx > 0 ? setIdx(i => i - 1) : onDone()}
            className="btn-secondary text-sm"
          >
            {idx > 0 ? '← Back' : 'Cancel'}
          </button>
          <div className="text-xs text-slate-400">{idx + 1} / {steps.length}</div>
          <button
            onClick={isLast ? handleSave : () => setIdx(i => i + 1)}
            className="btn-primary px-8 text-sm"
          >
            {isLast ? 'Save →' : 'Next →'}
          </button>
        </div>

      </div>
    </div>
  );
}
