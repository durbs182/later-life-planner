'use client';

import { useState } from 'react';
import { usePlannerStore } from '@/store/plannerStore';
import Card from '@/components/ui/Card';
import SliderInput from '@/components/ui/SliderInput';
import { getStageTotals, getStageTotalSpending, formatCurrency } from '@/lib/calculations';
import { RLSS_STANDARDS } from '@/lib/mockData';
import type { SpendingTier, RlssStandard } from '@/lib/types';
import clsx from 'clsx';

interface Props {
  onNext: () => void;
  onBack: () => void;
}

const TIER_META: Record<SpendingTier, { label: string; description: string; color: string; bg: string }> = {
  essential: {
    label: 'Essential',
    description: 'The basics you need to live comfortably',
    color: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-100',
  },
  moderate: {
    label: 'Enjoyment',
    description: 'Things that make life enjoyable',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-100',
  },
  aspirational: {
    label: 'Aspirational',
    description: 'Your lifestyle ambitions and experiences',
    color: 'text-purple-700',
    bg: 'bg-purple-50 border-purple-100',
  },
  variable: {
    label: 'Life-Stage / Variable',
    description: 'Costs that may arise at specific life stages',
    color: 'text-amber-700',
    bg: 'bg-amber-50 border-amber-100',
  },
};

const TIERS: SpendingTier[] = ['essential', 'moderate', 'aspirational', 'variable'];

const STANDARD_STYLES: Record<RlssStandard, { border: string; bg: string; badge: string; check: string; ring: string }> = {
  minimum:     { border: 'border-slate-300',  bg: 'bg-slate-50',   badge: 'bg-slate-100 text-slate-600',    check: 'text-slate-600',  ring: 'ring-slate-300'  },
  moderate:    { border: 'border-blue-400',   bg: 'bg-blue-50',    badge: 'bg-blue-100 text-blue-700',      check: 'text-blue-600',   ring: 'ring-blue-400'   },
  comfortable: { border: 'border-emerald-400',bg: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700',check: 'text-emerald-600',ring: 'ring-emerald-400'},
};

function RlssTemplateSelector() {
  const { mode, rlssStandard, applyRlssTemplate } = usePlannerStore();
  const standards = RLSS_STANDARDS[mode];
  const keys: RlssStandard[] = ['minimum', 'moderate', 'comfortable'];

  return (
    <Card className="border-2 border-blue-100 bg-gradient-to-br from-blue-50 to-white">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
        <div>
          <h3 className="section-heading">UK Retirement Living Standards</h3>
          <p className="text-sm text-slate-500">
            Choose a benchmark to pre-fill your spending — then customise below.
            Based on PLSA research for a <strong>{mode === 'couple' ? 'two-person' : 'one-person'}</strong> household.
          </p>
        </div>
        {rlssStandard && (
          <span className={clsx('text-xs font-semibold px-3 py-1 rounded-full', STANDARD_STYLES[rlssStandard].badge)}>
            Using: {standards[rlssStandard].label}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        {keys.map((key) => {
          const std     = standards[key];
          const style   = STANDARD_STYLES[key];
          const active  = rlssStandard === key;
          return (
            <button
              key={key}
              onClick={() => applyRlssTemplate(key)}
              className={clsx(
                'relative text-left p-4 rounded-xl border-2 transition-all focus:outline-none',
                active
                  ? `${style.border} ${style.bg} ring-2 ${style.ring} ring-offset-1`
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
              )}
            >
              {active && (
                <span className={clsx('absolute top-3 right-3 text-lg', style.check)}>✓</span>
              )}
              <p className="font-bold text-slate-800 text-base mb-0.5">{std.label}</p>
              <p className="text-2xl font-extrabold text-slate-900 mb-1">
                {formatCurrency(std.annual)}
                <span className="text-sm font-normal text-slate-400">/yr</span>
              </p>
              <p className="text-xs text-slate-500 leading-snug">{std.description}</p>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Figures in today&apos;s £. Applying a template scales all spending categories proportionally — you can adjust any category below.
      </p>
    </Card>
  );
}

// Shows where current spend sits relative to the RLSS benchmarks
function SpendBenchmark({ total, mode }: { total: number; mode: 'single' | 'couple' }) {
  const standards = RLSS_STANDARDS[mode];
  const min = standards.minimum.annual;
  const mod = standards.moderate.annual;
  const com = standards.comfortable.annual;
  const max = Math.max(com * 1.3, total * 1.05);

  const pct = (v: number) => `${Math.min(100, (v / max) * 100).toFixed(1)}%`;

  let label = 'Below Minimum';
  let labelColor = 'text-slate-500';
  if (total >= com) { label = 'Comfortable+'; labelColor = 'text-emerald-600'; }
  else if (total >= mod) { label = 'Moderate–Comfortable'; labelColor = 'text-blue-600'; }
  else if (total >= min) { label = 'Minimum–Moderate'; labelColor = 'text-amber-600'; }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-slate-600">
          Your spend vs UK standards
        </span>
        <span className={clsx('text-sm font-bold', labelColor)}>{label}</span>
      </div>
      <div className="relative h-3 rounded-full bg-slate-100 overflow-hidden">
        {/* Benchmark zones */}
        <div className="absolute inset-y-0 left-0 rounded-l-full bg-slate-200" style={{ width: pct(min) }} />
        <div className="absolute inset-y-0 bg-blue-100" style={{ left: pct(min), width: `calc(${pct(mod)} - ${pct(min)})` }} />
        <div className="absolute inset-y-0 bg-emerald-100" style={{ left: pct(mod), width: `calc(${pct(com)} - ${pct(mod)})` }} />
        {/* Your spend marker */}
        <div
          className="absolute inset-y-0 w-1 bg-slate-800 rounded-full"
          style={{ left: pct(total) }}
        />
      </div>
      <div className="flex justify-between mt-1.5 text-xs text-slate-400">
        <span>Min {formatCurrency(min, true)}</span>
        <span>Mod {formatCurrency(mod, true)}</span>
        <span>Com {formatCurrency(com, true)}</span>
      </div>
    </div>
  );
}

export default function Step2SpendingGoals({ onNext, onBack }: Props) {
  const state = usePlannerStore();
  const { mode, lifeStages, spendingCategories, updateSpendingAmount } = state;

  const [activeStageId, setActiveStageId] = useState(lifeStages[0]?.id ?? 'active');

  const activeStage = lifeStages.find(s => s.id === activeStageId) ?? lifeStages[0];
  const totalSpend  = getStageTotalSpending(state, activeStageId);
  const tierTotals  = getStageTotals(state, activeStageId);

  return (
    <div className="space-y-6 pb-24">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-1">Your spending goals</h2>
        <p className="text-slate-500 text-base">
          Start with a UK standard as a guide, then tailor every category to match your life.
        </p>
      </div>

      {/* RLSS Template Selector */}
      <RlssTemplateSelector />

      {/* Stage tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {lifeStages.map(stage => (
          <button
            key={stage.id}
            onClick={() => setActiveStageId(stage.id)}
            className={clsx(
              'flex-shrink-0 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all border',
              activeStageId === stage.id
                ? 'text-white border-transparent shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            )}
            style={activeStageId === stage.id ? { backgroundColor: stage.color, borderColor: stage.color } : {}}
          >
            {stage.label}
            <span className="ml-2 text-xs opacity-80">Age {stage.startAge}–{stage.endAge}</span>
          </button>
        ))}
      </div>

      {/* Total spending summary + benchmark */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="col-span-2 sm:col-span-1 bg-slate-800 text-white rounded-2xl p-4">
          <p className="text-sm text-slate-300 mb-1">Total annual</p>
          <p className="text-2xl font-bold">{formatCurrency(totalSpend)}</p>
          <p className="text-xs text-slate-400 mt-1">per year in today&apos;s £</p>
        </div>
        {tierTotals.map(({ tier, total }) => {
          const meta = TIER_META[tier as SpendingTier];
          return (
            <div key={tier} className={`rounded-2xl p-4 border ${meta.bg}`}>
              <p className={`text-xs font-semibold mb-1 ${meta.color}`}>{meta.label}</p>
              <p className="text-xl font-bold text-slate-800">{formatCurrency(total)}</p>
            </div>
          );
        })}
      </div>

      {/* Benchmark comparison bar */}
      <SpendBenchmark total={totalSpend} mode={mode} />

      {/* Copy from stage button */}
      {lifeStages.indexOf(activeStage) > 0 && (
        <div className="text-right">
          <button
            onClick={() => {
              const prevStage = lifeStages[lifeStages.indexOf(activeStage) - 1];
              spendingCategories.forEach(cat => {
                const prevAmount = cat.amounts[prevStage.id] ?? 0;
                updateSpendingAmount(cat.id, activeStageId, prevAmount);
              });
            }}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Copy amounts from &quot;{lifeStages[lifeStages.indexOf(activeStage) - 1]?.label}&quot;
          </button>
        </div>
      )}

      {/* Categories by tier */}
      {TIERS.map(tier => {
        const cats = spendingCategories.filter(c => c.tier === tier);
        const meta = TIER_META[tier];
        return (
          <Card key={tier} className={`border ${meta.bg}`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className={`text-lg font-bold ${meta.color}`}>{meta.label}</h3>
                <p className="text-sm text-slate-500">{meta.description}</p>
              </div>
              <span className={`text-lg font-bold ${meta.color}`}>
                {formatCurrency(tierTotals.find(t => t.tier === tier)?.total ?? 0)}
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {cats.map(cat => (
                <SliderInput
                  key={cat.id}
                  label={cat.name}
                  icon={cat.icon}
                  description={cat.description}
                  value={cat.amounts[activeStageId] ?? 0}
                  onChange={(v) => updateSpendingAmount(cat.id, activeStageId, v)}
                  min={0}
                  max={cat.maxValue}
                  step={100}
                />
              ))}
            </div>
          </Card>
        );
      })}

      <div className="flex justify-between pt-4">
        <button onClick={onBack} className="btn-secondary">
          Back
        </button>
        <button onClick={onNext} className="btn-primary px-10">
          Add income sources →
        </button>
      </div>
    </div>
  );
}
