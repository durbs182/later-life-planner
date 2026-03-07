'use client';

import { usePlannerStore } from '@/store/plannerStore';
import { getStageTotalSpending, calculateProjections, formatCurrency } from '@/lib/calculations';
import { RLSS_STANDARDS } from '@/lib/mockData';

export default function SummaryBar() {
  const state = usePlannerStore();
  const { mode, person1, person2, lifeStages, rlssStandard } = state;
  const firstStage     = lifeStages[0];
  const annualSpending = getStageTotalSpending(state, firstStage?.id ?? 'active');
  const projections    = calculateProjections(state);
  const firstYear      = projections[0];
  const totalIncome    = firstYear?.totalIncome ?? 0;
  const gap            = totalIncome - annualSpending;
  const surplus        = gap >= 0;
  const ageLabel       = mode === 'couple'
    ? `${person1.name || 'You'} & ${person2.name || 'Partner'}`
    : (person1.name || `Age ${person1.currentAge}`);

  return (
    <div className="max-w-5xl mx-auto px-4 py-2.5 flex flex-wrap items-center gap-3 text-sm">
      <span className="text-slate-400 text-xs font-medium">{ageLabel}</span>
      <span className="w-px h-4 bg-slate-200" />

      <div className="flex items-center gap-1.5">
        <span className="text-slate-500">Spending</span>
        <span className="font-bold text-slate-800">{formatCurrency(annualSpending)}</span>
      </div>

      <span className="w-px h-4 bg-slate-200 hidden sm:block" />

      <div className="flex items-center gap-1.5">
        <span className="text-slate-500">Income</span>
        <span className="font-bold text-slate-800">{formatCurrency(totalIncome)}</span>
      </div>

      <span className="w-px h-4 bg-slate-200 hidden sm:block" />

      <div className="flex items-center gap-1.5">
        <span className={`font-bold text-sm ${surplus ? 'text-emerald-600' : 'text-rose-600'}`}>
          {surplus ? '▲' : '▼'} {surplus ? '+' : ''}{formatCurrency(gap)}
        </span>
      </div>

      {rlssStandard && (
        <>
          <span className="w-px h-4 bg-slate-200 hidden sm:block" />
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-orange-100 text-orange-700">
            {RLSS_STANDARDS[mode][rlssStandard].emoji} {RLSS_STANDARDS[mode][rlssStandard].label}
          </span>
        </>
      )}

      <span className="ml-auto text-xs text-slate-400 hidden md:block">Live · today&apos;s £</span>
    </div>
  );
}
