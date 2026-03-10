'use client';

import { useState } from 'react';
import { usePlannerStore } from '@/store/plannerStore';
import clsx from 'clsx';

// ─── Local types ──────────────────────────────────────────────────────────────

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

type Screen = 'income-p1' | 'assets-p1' | 'income-p2' | 'assets-p2';

// ─── Small primitives ─────────────────────────────────────────────────────────

function CurrencyField({ label, value, onChange, max = 2000000, step = 500, hint }: {
  label: string; value: number; onChange: (v: number) => void;
  max?: number; step?: number; hint?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">£</span>
        <input
          type="number" min={0} max={max} step={step} value={value || ''}
          onChange={(e) => { const v = parseFloat(e.target.value); onChange(isNaN(v) ? 0 : Math.min(max, v)); }}
          className="input-base pl-7 w-full"
          placeholder="0"
        />
      </div>
    </div>
  );
}

function AgeField({ label, value, onChange, min = 55, max = 80 }: {
  label: string; value: number; onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
          className="w-9 h-9 rounded-xl bg-slate-200 hover:bg-slate-300 disabled:opacity-30 font-bold text-lg flex items-center justify-center">−</button>
        <span className="w-10 text-center font-black text-slate-800 tabular-nums">{value}</span>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
          className="w-9 h-9 rounded-xl bg-slate-200 hover:bg-slate-300 disabled:opacity-30 font-bold text-lg flex items-center justify-center">+</button>
      </div>
    </div>
  );
}

function GrowthField({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-semibold text-slate-700">Annual growth</label>
      <p className="text-xs text-slate-400">Expected average return per year</p>
      <div className="relative w-24">
        <input type="number" min={0} max={15} step={0.5} value={value}
          onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v); }}
          className="input-base text-center pr-7 w-full" />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
      </div>
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }: {
  label: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={clsx(
        'w-full text-left p-4 rounded-2xl border-2 transition-all flex items-start gap-3',
        checked ? 'border-orange-300 bg-orange-50' : 'border-slate-200 bg-white hover:border-orange-200',
      )}
    >
      <div className={clsx('w-5 h-5 rounded-md border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all',
        checked ? 'bg-orange-500 border-orange-500' : 'border-slate-300'
      )}>
        {checked && <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </div>
      <div>
        <p className={clsx('font-bold text-sm', checked ? 'text-orange-800' : 'text-slate-700')}>{label}</p>
        <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
      </div>
    </button>
  );
}

// ─── Income screen ────────────────────────────────────────────────────────────

function IncomeScreen({ draft, onChange, personLabel }: {
  draft: PersonDraft;
  onChange: (d: PersonDraft) => void;
  personLabel: string;
}) {
  function upd(partial: Partial<PersonDraft>) { onChange({ ...draft, ...partial }); }

  function addDb() {
    upd({ dbPensions: [...draft.dbPensions, { annualIncome: 0, startAge: 65 }] });
  }
  function updateDb(i: number, partial: Partial<DbEntry>) {
    const next = draft.dbPensions.map((e, idx) => idx === i ? { ...e, ...partial } : e);
    upd({ dbPensions: next });
  }
  function removeDb(i: number) {
    upd({ dbPensions: draft.dbPensions.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-black text-slate-800 text-lg">{personLabel}&apos;s income</h3>
        <p className="text-sm text-slate-500 mt-1">Tick everything that applies. We&apos;ll capture the details below.</p>
      </div>

      {/* State Pension */}
      <ToggleRow
        label="State Pension"
        desc="UK new State Pension — check your forecast at gov.uk/check-state-pension"
        checked={draft.statePension.enabled}
        onChange={(v) => upd({ statePension: { ...draft.statePension, enabled: v } })}
      />
      {draft.statePension.enabled && (
        <div className="ml-4 pl-4 border-l-2 border-orange-200 space-y-4">
          <CurrencyField
            label="Weekly amount"
            value={draft.statePension.weeklyAmount}
            onChange={(v) => upd({ statePension: { ...draft.statePension, weeklyAmount: v } })}
            max={300} step={1}
            hint="Full new State Pension is £221.20/week (2024/25) — use your personal forecast"
          />
          <AgeField label="Starts at age" value={draft.statePension.startAge}
            onChange={(v) => upd({ statePension: { ...draft.statePension, startAge: v } })}
            min={66} max={75}
          />
        </div>
      )}

      {/* DB / Final Salary Pension */}
      <ToggleRow
        label="Defined Benefit (final salary) pension"
        desc="Guaranteed income from an employer scheme — add one per scheme"
        checked={draft.dbPensions.length > 0}
        onChange={(v) => v ? addDb() : upd({ dbPensions: [] })}
      />
      {draft.dbPensions.map((db, i) => (
        <div key={i} className="ml-4 pl-4 border-l-2 border-orange-200 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-700">Scheme {i + 1}</p>
            {draft.dbPensions.length > 1 && (
              <button onClick={() => removeDb(i)} className="text-xs text-rose-400 hover:text-rose-600">Remove</button>
            )}
          </div>
          <CurrencyField label="Annual income (today's £)" value={db.annualIncome}
            onChange={(v) => updateDb(i, { annualIncome: v })} max={100000} step={100} />
          <AgeField label="Starts at age" value={db.startAge}
            onChange={(v) => updateDb(i, { startAge: v })} min={55} max={75} />
        </div>
      ))}
      {draft.dbPensions.length > 0 && (
        <button onClick={addDb}
          className="ml-4 text-sm text-orange-600 hover:text-orange-700 font-semibold">
          + Add another DB scheme
        </button>
      )}

      {/* Annuity */}
      <ToggleRow
        label="Annuity"
        desc="A purchased annuity providing guaranteed income for life"
        checked={draft.annuity.enabled}
        onChange={(v) => upd({ annuity: { ...draft.annuity, enabled: v } })}
      />
      {draft.annuity.enabled && (
        <div className="ml-4 pl-4 border-l-2 border-orange-200 space-y-4">
          <CurrencyField label="Annual income" value={draft.annuity.annualIncome}
            onChange={(v) => upd({ annuity: { ...draft.annuity, annualIncome: v } })} max={100000} step={100} />
          <AgeField label="Starts at age" value={draft.annuity.startAge}
            onChange={(v) => upd({ annuity: { ...draft.annuity, startAge: v } })} min={55} max={85} />
        </div>
      )}

      {/* Other income */}
      <ToggleRow
        label="Other regular income"
        desc="Trust income, rental income not captured as a property, regular gift, etc."
        checked={draft.otherIncome.enabled}
        onChange={(v) => upd({ otherIncome: { ...draft.otherIncome, enabled: v } })}
      />
      {draft.otherIncome.enabled && (
        <div className="ml-4 pl-4 border-l-2 border-orange-200 space-y-4">
          <CurrencyField label="Annual amount" value={draft.otherIncome.annualAmount}
            onChange={(v) => upd({ otherIncome: { ...draft.otherIncome, annualAmount: v } })} max={200000} step={500} />
          <AgeField label="Starts at age" value={draft.otherIncome.startAge}
            onChange={(v) => upd({ otherIncome: { ...draft.otherIncome, startAge: v } })} min={50} max={85} />
        </div>
      )}
    </div>
  );
}

// ─── Assets screen ────────────────────────────────────────────────────────────

function AssetsScreen({ draft, onChange, personLabel }: {
  draft: PersonDraft;
  onChange: (d: PersonDraft) => void;
  personLabel: string;
}) {
  function upd(partial: Partial<PersonDraft>) { onChange({ ...draft, ...partial }); }

  function addDc()  { upd({ dcPensions: [...draft.dcPensions, { value: 0, growthRate: 4 }] }); }
  function addIsa() { upd({ isas:       [...draft.isas,       { value: 0, growthRate: 4 }] }); }
  function addGia() { upd({ gias:       [...draft.gias,       { value: 0, baseCost: 0, growthRate: 4 }] }); }

  function updateDc(i: number, p: Partial<DcEntry>)  { upd({ dcPensions: draft.dcPensions.map((e, idx) => idx === i ? { ...e, ...p } : e) }); }
  function updateIsa(i: number, p: Partial<IsaEntry>) { upd({ isas:       draft.isas.map((e, idx) => idx === i ? { ...e, ...p } : e) }); }
  function updateGia(i: number, p: Partial<GiaEntry>) { upd({ gias:       draft.gias.map((e, idx) => idx === i ? { ...e, ...p } : e) }); }

  const dcTotal  = draft.dcPensions.reduce((s, e) => s + e.value, 0);
  const isaTotal = draft.isas.reduce((s, e) => s + e.value, 0);
  const giaTotal = draft.gias.reduce((s, e) => s + e.value, 0);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-black text-slate-800 text-lg">{personLabel}&apos;s savings & investments</h3>
        <p className="text-sm text-slate-500 mt-1">Add each account separately — we&apos;ll combine them into a single pot.</p>
      </div>

      {/* DC Pensions */}
      <ToggleRow
        label="DC / Personal pension pot(s)"
        desc="Workplace pension, SIPP or personal pension — add one per pot"
        checked={draft.dcPensions.length > 0}
        onChange={(v) => v ? addDc() : upd({ dcPensions: [] })}
      />
      {draft.dcPensions.map((dc, i) => (
        <div key={i} className="ml-4 pl-4 border-l-2 border-orange-200 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-700">Pension pot {i + 1}</p>
            {draft.dcPensions.length > 1 && (
              <button onClick={() => upd({ dcPensions: draft.dcPensions.filter((_, idx) => idx !== i) })}
                className="text-xs text-rose-400 hover:text-rose-600">Remove</button>
            )}
          </div>
          <CurrencyField label="Current value" value={dc.value}
            onChange={(v) => updateDc(i, { value: v })} max={2000000} step={1000} />
          <GrowthField value={dc.growthRate} onChange={(v) => updateDc(i, { growthRate: v })} />
        </div>
      ))}
      {draft.dcPensions.length > 0 && (
        <div className="ml-4 flex items-center justify-between">
          <button onClick={addDc} className="text-sm text-orange-600 hover:text-orange-700 font-semibold">
            + Add another pension pot
          </button>
          {draft.dcPensions.length > 1 && (
            <span className="text-xs text-slate-400">Total: £{dcTotal.toLocaleString('en-GB')}</span>
          )}
        </div>
      )}

      {/* ISAs */}
      <ToggleRow
        label="ISA(s)"
        desc="Stocks & Shares or Cash ISA — add one per account"
        checked={draft.isas.length > 0}
        onChange={(v) => v ? addIsa() : upd({ isas: [] })}
      />
      {draft.isas.map((isa, i) => (
        <div key={i} className="ml-4 pl-4 border-l-2 border-orange-200 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-700">ISA {i + 1}</p>
            {draft.isas.length > 1 && (
              <button onClick={() => upd({ isas: draft.isas.filter((_, idx) => idx !== i) })}
                className="text-xs text-rose-400 hover:text-rose-600">Remove</button>
            )}
          </div>
          <CurrencyField label="Current value" value={isa.value}
            onChange={(v) => updateIsa(i, { value: v })} max={2000000} step={1000} />
          <GrowthField value={isa.growthRate} onChange={(v) => updateIsa(i, { growthRate: v })} />
        </div>
      ))}
      {draft.isas.length > 0 && (
        <div className="ml-4 flex items-center justify-between">
          <button onClick={addIsa} className="text-sm text-orange-600 hover:text-orange-700 font-semibold">
            + Add another ISA
          </button>
          {draft.isas.length > 1 && (
            <span className="text-xs text-slate-400">Total: £{isaTotal.toLocaleString('en-GB')}</span>
          )}
        </div>
      )}

      {/* GIA */}
      <ToggleRow
        label="General investment account(s)"
        desc="Shares, funds or bonds held outside an ISA or pension"
        checked={draft.gias.length > 0}
        onChange={(v) => v ? addGia() : upd({ gias: [] })}
      />
      {draft.gias.map((gia, i) => (
        <div key={i} className="ml-4 pl-4 border-l-2 border-orange-200 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-700">Account {i + 1}</p>
            {draft.gias.length > 1 && (
              <button onClick={() => upd({ gias: draft.gias.filter((_, idx) => idx !== i) })}
                className="text-xs text-rose-400 hover:text-rose-600">Remove</button>
            )}
          </div>
          <CurrencyField label="Current market value" value={gia.value}
            onChange={(v) => updateGia(i, { value: v })} max={2000000} step={1000} />
          <CurrencyField label="Purchase price / base cost" value={gia.baseCost}
            onChange={(v) => updateGia(i, { baseCost: v })} max={2000000} step={1000}
            hint="Original cost — used for capital gains tax calculation" />
          <GrowthField value={gia.growthRate} onChange={(v) => updateGia(i, { growthRate: v })} />
        </div>
      ))}
      {draft.gias.length > 0 && (
        <div className="ml-4 flex items-center justify-between">
          <button onClick={addGia} className="text-sm text-orange-600 hover:text-orange-700 font-semibold">
            + Add another account
          </button>
          {draft.gias.length > 1 && (
            <span className="text-xs text-slate-400">Total: £{giaTotal.toLocaleString('en-GB')}</span>
          )}
        </div>
      )}

      {/* Cash savings */}
      <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💵</span>
          <div>
            <p className="font-bold text-sm text-slate-700">Cash savings</p>
            <p className="text-xs text-slate-400">Current accounts, savings accounts, Premium Bonds</p>
          </div>
        </div>
        <CurrencyField label="Total cash" value={draft.cashSavings}
          onChange={(v) => upd({ cashSavings: v })} max={500000} step={1000} />
      </div>
    </div>
  );
}

// ─── Helpers: consolidate draft → store ───────────────────────────────────────

function weightedAvgGrowth(items: { value: number; growthRate: number }[]): number {
  const total = items.reduce((s, e) => s + e.value, 0);
  if (total === 0) return 4;
  const weighted = items.reduce((s, e) => s + e.growthRate * e.value, 0);
  return Math.round((weighted / total) * 10) / 10;
}

function applyDraftToStore(
  draft: PersonDraft,
  setIncome: (k: string, u: Record<string, unknown>) => void,
  setAsset:  (k: string, u: Record<string, unknown>) => void,
) {
  // State Pension
  setIncome('statePension', {
    enabled:      draft.statePension.enabled,
    weeklyAmount: draft.statePension.weeklyAmount,
    startAge:     draft.statePension.startAge,
  });

  // DB pensions → sum
  const dbTotal = draft.dbPensions.reduce((s, e) => s + e.annualIncome, 0);
  const dbStart = draft.dbPensions.length > 0 ? Math.min(...draft.dbPensions.map(e => e.startAge)) : 65;
  setIncome('dbPension', { enabled: dbTotal > 0, annualIncome: dbTotal, startAge: dbStart });

  // Annuity
  setIncome('annuity', {
    enabled:      draft.annuity.enabled,
    annualIncome: draft.annuity.annualIncome,
    startAge:     draft.annuity.startAge,
  });

  // Other income
  setIncome('otherIncome', {
    enabled:      draft.otherIncome.enabled,
    annualAmount: draft.otherIncome.annualAmount,
    startAge:     draft.otherIncome.startAge,
    stopAge:      0,
    description:  'Other income',
  });

  // DC pensions → sum
  const dcTotal = draft.dcPensions.reduce((s, e) => s + e.value, 0);
  setIncome('dcPension', {
    enabled:    dcTotal > 0,
    totalValue: dcTotal,
    growthRate: weightedAvgGrowth(draft.dcPensions),
  });

  // ISAs → sum
  const isaTotal = draft.isas.reduce((s, e) => s + e.value, 0);
  setAsset('isaInvestments', {
    enabled:    isaTotal > 0,
    totalValue: isaTotal,
    growthRate: weightedAvgGrowth(draft.isas),
  });

  // GIAs → sum
  const giaTotal    = draft.gias.reduce((s, e) => s + e.value, 0);
  const giaBaseCost = draft.gias.reduce((s, e) => s + e.baseCost, 0);
  setAsset('generalInvestments', {
    enabled:    giaTotal > 0,
    totalValue: giaTotal,
    baseCost:   giaBaseCost,
    growthRate: weightedAvgGrowth(draft.gias),
  });

  // Cash
  setAsset('cashSavings', { enabled: draft.cashSavings > 0, totalValue: draft.cashSavings });
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

interface Props { onDone: () => void }

export default function GuidedSetupWizard({ onDone }: Props) {
  const { mode, person1, person2, setP1Income, setP1Asset, setP2Income, setP2Asset } = usePlannerStore();

  const p1Label = person1.name || 'You';
  const p2Label = person2.name || 'Partner';

  const screens: Screen[] = mode === 'couple'
    ? ['income-p1', 'assets-p1', 'income-p2', 'assets-p2']
    : ['income-p1', 'assets-p1'];

  const [screenIndex, setScreenIndex] = useState(0);
  const [p1Draft, setP1Draft] = useState<PersonDraft>(emptyDraft);
  const [p2Draft, setP2Draft] = useState<PersonDraft>(emptyDraft);

  const currentScreen = screens[screenIndex];
  const isLast = screenIndex === screens.length - 1;

  const screenLabels: Record<Screen, string> = {
    'income-p1': `${p1Label} — Income`,
    'assets-p1': `${p1Label} — Savings & Investments`,
    'income-p2': `${p2Label} — Income`,
    'assets-p2': `${p2Label} — Savings & Investments`,
  };

  function handleNext() {
    if (isLast) {
      // Write everything to the store
      applyDraftToStore(p1Draft, setP1Income as (k: string, u: Record<string, unknown>) => void, setP1Asset as (k: string, u: Record<string, unknown>) => void);
      if (mode === 'couple') {
        applyDraftToStore(p2Draft, setP2Income as (k: string, u: Record<string, unknown>) => void, setP2Asset as (k: string, u: Record<string, unknown>) => void);
      }
      onDone();
    } else {
      setScreenIndex(i => i + 1);
    }
  }

  const draft  = currentScreen.endsWith('p2') ? p2Draft : p1Draft;
  const setDraft = currentScreen.endsWith('p2') ? setP2Draft : setP1Draft;
  const personLabel = currentScreen.endsWith('p2') ? p2Label : p1Label;

  return (
    <div className="bg-white rounded-3xl border-2 border-orange-200 overflow-hidden">

      {/* Header */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100 px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">✨</span>
            <span className="font-black text-slate-800">Guided setup</span>
          </div>
          <span className="text-xs text-slate-400">{screenIndex + 1} of {screens.length}</span>
        </div>
        {/* Progress bar */}
        <div className="flex gap-1">
          {screens.map((s, i) => (
            <div key={s} className={clsx(
              'h-1.5 flex-1 rounded-full transition-all',
              i < screenIndex ? 'bg-orange-400' : i === screenIndex ? 'bg-orange-500' : 'bg-orange-100'
            )} />
          ))}
        </div>
        <p className="text-xs font-semibold text-orange-700 mt-2">{screenLabels[currentScreen]}</p>
      </div>

      {/* Screen content */}
      <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
        {currentScreen.startsWith('income') ? (
          <IncomeScreen draft={draft} onChange={setDraft} personLabel={personLabel} />
        ) : (
          <AssetsScreen draft={draft} onChange={setDraft} personLabel={personLabel} />
        )}
      </div>

      {/* Footer nav */}
      <div className="border-t border-slate-100 px-5 py-4 flex justify-between items-center bg-slate-50/50">
        {screenIndex > 0 ? (
          <button onClick={() => setScreenIndex(i => i - 1)} className="btn-secondary text-sm">← Back</button>
        ) : (
          <div />
        )}
        <button onClick={handleNext} className="btn-primary px-8">
          {isLast ? 'Save & continue →' : 'Next →'}
        </button>
      </div>
    </div>
  );
}
