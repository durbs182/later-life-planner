'use client';

import { usePlannerStore } from '@/store/plannerStore';
import { getStageTotalSpending, calculateProjections, formatCurrency } from '@/lib/calculations';
import { RLSS_STANDARDS } from '@/lib/mockData';

export default function SummaryBar() {
  const state = usePlannerStore();
  const { mode, person1, person2, lifeStages, rlssStandard } = state;
  const firstStage = lifeStages[0];
  const annualSpending = getStageTotalSpending(state, firstStage?.id ?? 'active');

  const projections = calculateProjections(state);
  const firstYear = projections[0];
  const totalIncome = firstYear?.totalIncome ?? 0;
  const gap = totalIncome - annualSpending;
  const surplus = gap >= 0;

  const ageLabel = mode === 'couple'
    ? `Ages ${person1.currentAge} & ${person2.currentAge}`
    : `Age ${person1.currentAge}`;

  return (
    <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center gap-4 text-sm">
      <div className="flex items-center gap-2">
        <span className="text-slate-400 text-xs">{ageLabel}</span>
        <span className="w-px h-4 bg-slate-200" />
        <span className="text-slate-500">Household spend</span>
        <span className="font-bold text-slate-800 text-base">{formatCurrency(annualSpending)}</span>
      </div>

      <div className="w-px h-5 bg-slate-200 hidden sm:block" />

      <div className="flex items-center gap-2">
        <span className="text-slate-500">Year 1 income</span>
        <span className="font-bold text-slate-800 text-base">{formatCurrency(totalIncome)}</span>
      </div>

      <div className="w-px h-5 bg-slate-200 hidden sm:block" />

      <div className="flex items-center gap-2">
        <span className="text-slate-500">{surplus ? 'Surplus' : 'Shortfall'}</span>
        <span className={`font-bold text-base ${surplus ? 'text-emerald-600' : 'text-rose-600'}`}>
          {surplus ? '+' : ''}{formatCurrency(gap)}
        </span>
      </div>

      {rlssStandard && (
        <>
          <div className="w-px h-5 bg-slate-200 hidden sm:block" />
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
            {RLSS_STANDARDS[mode][rlssStandard].label} standard
          </span>
        </>
      )}

      <div className="ml-auto text-xs text-slate-400 hidden md:block">
        Today&apos;s £ — updates in real time
      </div>
    </div>
  );
}
