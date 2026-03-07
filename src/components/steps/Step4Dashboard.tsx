'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePlannerStore } from '@/store/plannerStore';
import {
  calculateProjections, getStageTotalSpending,
  getAssetDepletionAge, formatCurrency, getTotalUnrealisedGain,
} from '@/lib/calculations';
import { RLSS_STANDARDS } from '@/lib/mockData';
import Card from '@/components/ui/Card';
import SliderInput from '@/components/ui/SliderInput';
import type { YearlyProjection } from '@/lib/types';

const LifetimeChart = dynamic(() => import('@/components/charts/LifetimeChart'), { ssr: false });
const AssetChart    = dynamic(() => import('@/components/charts/AssetChart'),    { ssr: false });

interface Props { onBack: () => void }

function KpiCard({ label, value, sub, color = 'slate' }: {
  label: string; value: string; sub?: string;
  color?: 'slate' | 'emerald' | 'rose' | 'blue' | 'amber';
}) {
  const bg = { slate: 'bg-slate-800 text-white', emerald: 'bg-emerald-600 text-white',
               rose: 'bg-rose-600 text-white', blue: 'bg-blue-600 text-white', amber: 'bg-amber-500 text-white' };
  return (
    <div className={`rounded-2xl p-5 ${bg[color]}`}>
      <p className="text-sm opacity-75 mb-1">{label}</p>
      <p className="text-2xl font-bold leading-tight">{value}</p>
      {sub && <p className="text-xs opacity-70 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Tax strategy ─────────────────────────────────────────────────────────────

function TaxStrategy({ projections }: { projections: YearlyProjection[] }) {
  const now   = projections[0];
  const age70 = projections.find(p => p.p1Age === 70);
  return (
    <Card>
      <h3 className="section-heading">Tax-Efficient Income Strategy</h3>
      <p className="section-subheading">
        Prioritised withdrawal order: personal allowance → CGT allowance → PCLS → ISA → taxable pension.
      </p>
      <div className="space-y-3 mb-6">
        {[
          { n: 1, icon: '🏛️', label: 'Personal allowance — guaranteed income first', bg: 'bg-blue-50 border-blue-200',    desc: 'State Pension, DB pensions and annuities fill your personal allowance (£12,570) first. This income is tax-free up to that threshold. Modelled per person.' },
          { n: 2, icon: '📊', label: 'CGT allowance — GIA disposals',               bg: 'bg-amber-50 border-amber-200',   desc: 'Use the £3,000 CGT annual exempt amount each year. Gains above this are taxed at 10% (basic rate) or 20% (higher rate). Base cost tracked proportionally.' },
          { n: 3, icon: '🏦', label: 'PCLS — pension tax-free cash',                bg: 'bg-purple-50 border-purple-200', desc: 'At pension crystallisation, take up to 25% as a tax-free Pension Commencement Lump Sum (PCLS). Remaining 75% is drawn as taxable income (UFPLS model used here).' },
          { n: 4, icon: '✅', label: 'ISA withdrawals',                              bg: 'bg-emerald-50 border-emerald-200',desc: 'Completely tax-free. No income tax, no CGT, no impact on personal allowance. Drawn before taxable pension income to preserve tax-free growth.' },
          { n: 5, icon: '💼', label: 'Taxable pension income',                       bg: 'bg-slate-50 border-slate-200',   desc: '75% of DC drawdown (beyond PCLS) is taxed as income. Maximise use of each person\'s remaining personal allowance before drawing above the threshold.' },
        ].map(({ n, icon, label, bg, desc }) => (
          <div key={n} className={`flex gap-4 p-4 rounded-xl border ${bg}`}>
            <div className="w-7 h-7 rounded-full bg-white shadow-sm flex items-center justify-center font-bold text-sm flex-shrink-0">{n}</div>
            <div>
              <div className="flex items-center gap-2 font-semibold text-slate-800 mb-0.5"><span>{icon}</span>{label}</div>
              <p className="text-sm text-slate-500">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {now && (
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <p className="text-sm text-slate-500 mb-1">Income tax this year</p>
            <p className="text-xl font-bold text-slate-800">{formatCurrency(now.incomeTaxPaid)}</p>
            <p className="text-xs text-slate-400 mt-1">effective rate {now.totalIncome > 0 ? ((now.incomeTaxPaid / now.totalIncome) * 100).toFixed(1) : 0}%</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
            <p className="text-sm text-amber-700 mb-1">CGT this year</p>
            <p className="text-xl font-bold text-amber-800">{formatCurrency(now.totalCgtPaid)}</p>
            <p className="text-xs text-amber-600 mt-1">on £{now.p1CapitalGain + now.p2CapitalGain > 0 ? formatCurrency(now.p1CapitalGain + now.p2CapitalGain) : '0'} gains</p>
          </div>
          {age70 && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <p className="text-sm text-slate-500 mb-1">Total tax at age 70</p>
              <p className="text-xl font-bold text-slate-800">{formatCurrency(age70.totalTaxPaid)}</p>
              <p className="text-xs text-slate-400 mt-1">income tax + CGT</p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── CGT summary ──────────────────────────────────────────────────────────────

function CGTSummary({ projections, p1Name, p2Name }: {
  projections: YearlyProjection[]; p1Name: string; p2Name: string;
}) {
  const lifetimeCGT = projections.reduce((s, p) => s + p.totalCgtPaid, 0);
  const lifetimeCG  = projections.reduce((s, p) => s + p.p1CapitalGain + p.p2CapitalGain, 0);
  const peakCGT     = Math.max(...projections.map(p => p.totalCgtPaid));

  // Years with significant CGT
  const cgtYears = projections.filter(p => p.totalCgtPaid > 100);

  return (
    <Card>
      <h3 className="section-heading">Capital Gains Tax (CGT)</h3>
      <p className="section-subheading">
        CGT arises when you draw from your General Investment Accounts (GIA). Your base cost is tracked so
        only actual gains are taxed.
      </p>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
          <p className="text-sm text-amber-700 mb-1">Total lifetime CGT</p>
          <p className="text-xl font-bold text-amber-800">{formatCurrency(lifetimeCGT)}</p>
          <p className="text-xs text-amber-600 mt-1">on {formatCurrency(lifetimeCG)} total gains</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-500 mb-1">Peak annual CGT</p>
          <p className="text-xl font-bold text-slate-800">{formatCurrency(peakCGT)}</p>
          <p className="text-xs text-slate-400 mt-1">highest year</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
          <p className="text-sm text-slate-500 mb-1">Years with CGT due</p>
          <p className="text-xl font-bold text-slate-800">{cgtYears.length}</p>
          <p className="text-xs text-slate-400 mt-1">above £3,000 exempt amount</p>
        </div>
      </div>

      <div className="text-sm text-slate-600 bg-blue-50 rounded-xl p-4 border border-blue-100 space-y-1">
        <p className="font-semibold text-blue-800">How CGT is modelled here:</p>
        <ul className="list-disc list-inside space-y-1 text-blue-700 text-xs mt-1">
          <li>Each GIA drawdown partially realises the embedded gain (proportional disposal method).</li>
          <li>Annual CGT exempt amount: £3,000 per person (2024/25).</li>
          <li>Rate: 10% if basic-rate taxpayer, 20% if higher-rate — assessed per person.</li>
          <li>Base cost is reduced proportionally on each withdrawal, not first-in-first-out.</li>
          <li>Property CGT is <strong>not</strong> currently modelled (base cost captured for Phase 2).</li>
        </ul>
      </div>

      {cgtYears.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left pb-2 pr-3 text-slate-500 font-semibold">Age</th>
                <th className="text-right pb-2 pr-3 text-blue-600 font-semibold">{p1Name} gain</th>
                {p2Name !== 'You' && <th className="text-right pb-2 pr-3 text-emerald-600 font-semibold">{p2Name} gain</th>}
                <th className="text-right pb-2 text-amber-600 font-semibold">CGT paid</th>
              </tr>
            </thead>
            <tbody>
              {cgtYears.slice(0, 10).map(p => (
                <tr key={p.p1Age} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-1.5 pr-3 font-bold">{p.p1Age}</td>
                  <td className="py-1.5 pr-3 text-right">{formatCurrency(p.p1CapitalGain, true)}</td>
                  {p2Name !== 'You' && <td className="py-1.5 pr-3 text-right">{formatCurrency(p.p2CapitalGain, true)}</td>}
                  <td className="py-1.5 text-right font-medium text-amber-600">{formatCurrency(p.totalCgtPaid, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ─── Household breakdown (couples) ───────────────────────────────────────────

function HouseholdBreakdown({ projections, p1Name, p2Name }: {
  projections: YearlyProjection[]; p1Name: string; p2Name: string;
}) {
  const rows = [0, 5, 10, 15, 20].map(i => projections[i]).filter(Boolean);
  return (
    <Card>
      <h3 className="section-heading">Per-Person Income Contributions</h3>
      <p className="section-subheading">How each person contributes to household income at key ages.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left">
              <th className="pb-2 pr-3 text-slate-500 font-semibold">Ages</th>
              <th className="pb-2 pr-3 text-blue-600 font-semibold text-right">{p1Name}</th>
              <th className="pb-2 pr-3 text-emerald-600 font-semibold text-right">{p2Name}</th>
              <th className="pb-2 pr-3 text-slate-500 font-semibold text-right">Assets drawn</th>
              <th className="pb-2 text-slate-700 font-semibold text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(p => {
              const p1Fixed  = p.p1StatePension + p.p1DbPension + p.p1PartTimeWork + p.p1OtherIncome + p.p1PropertyRent + p.p1DcDrawdown;
              const p2Fixed  = p.p2StatePension + p.p2DbPension + p.p2PartTimeWork + p.p2OtherIncome + p.p2PropertyRent + p.p2DcDrawdown;
              const assetsDr = p.isaDrawdown + p.giaDrawdown + p.cashDrawdown;
              return (
                <tr key={p.p1Age} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-2 pr-3 font-bold text-slate-800">{p.p1Age} / {p.p2Age}</td>
                  <td className="py-2 pr-3 text-right text-blue-600 font-medium">{formatCurrency(p1Fixed, true)}</td>
                  <td className="py-2 pr-3 text-right text-emerald-600 font-medium">{formatCurrency(p2Fixed, true)}</td>
                  <td className="py-2 pr-3 text-right text-slate-500">{formatCurrency(assetsDr, true)}</td>
                  <td className="py-2 text-right font-bold text-slate-800">{formatCurrency(p.totalIncome, true)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── Projection table ─────────────────────────────────────────────────────────

function ProjectionTable({ projections }: { projections: YearlyProjection[] }) {
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? projections : projections.filter((_, i) => i % 5 === 0);
  return (
    <Card>
      <h3 className="section-heading">Year-by-Year Projection</h3>
      <p className="section-subheading">Nominal (inflation-adjusted) figures in future £.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left">
              {['Age', 'Stage', 'Spending', 'Total Income', 'Income Tax', 'CGT', 'Total Tax', 'Net Income', 'Total Assets'].map(h => (
                <th key={h} className="pb-2 pr-3 last:pr-0 font-semibold text-slate-500 text-right first:text-left first:pr-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(p => (
              <tr key={p.p1Age} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="py-1.5 pr-3 font-bold text-slate-800">
                  {p.p1Age}{p.p2Age !== null && <span className="text-slate-400 font-normal">/{p.p2Age}</span>}
                </td>
                <td className="py-1.5 pr-3 text-slate-400 text-xs">{p.lifeStage}</td>
                <td className="py-1.5 pr-3 text-right">{formatCurrency(p.spending, true)}</td>
                <td className="py-1.5 pr-3 text-right">{formatCurrency(p.totalIncome, true)}</td>
                <td className="py-1.5 pr-3 text-right text-blue-600">{formatCurrency(p.incomeTaxPaid, true)}</td>
                <td className="py-1.5 pr-3 text-right text-amber-600">{p.totalCgtPaid > 0 ? formatCurrency(p.totalCgtPaid, true) : '—'}</td>
                <td className="py-1.5 pr-3 text-right text-rose-600">{formatCurrency(p.totalTaxPaid, true)}</td>
                <td className="py-1.5 pr-3 text-right">{formatCurrency(p.netIncome, true)}</td>
                <td className={`py-1.5 text-right font-medium ${p.totalAssets <= 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {p.totalAssets <= 0 ? '—' : formatCurrency(p.totalAssets, true)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button onClick={() => setShowAll(!showAll)} className="mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium">
        {showAll ? 'Show fewer rows' : 'Show all years'}
      </button>
    </Card>
  );
}

// ─── Main dashboard ───────────────────────────────────────────────────────────

export default function Step4Dashboard({ onBack }: Props) {
  const state = usePlannerStore();
  const { mode, person1, person2, updateSpendingAmount, lifeStages, spendingCategories, rlssStandard } = state;

  const projections = useMemo(() => calculateProjections(state), [state]);
  const firstYear   = projections[0];
  const depletionAge = getAssetDepletionAge(projections);
  const firstStageId = lifeStages[0]?.id ?? 'active';
  const annualSpend  = getStageTotalSpending(state, firstStageId);
  const lastPositive = [...projections].reverse().find(p => p.totalAssets > 0);
  const surplus      = depletionAge === null;
  const unrealisedGain = getTotalUnrealisedGain(state);

  const [showAdjust, setShowAdjust] = useState(false);

  const p1Name = person1.name || (mode === 'couple' ? 'Partner 1' : 'You');
  const p2Name = person2.name || 'Partner 2';

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-1">Your lifetime dashboard</h2>
          <p className="text-slate-500">
            Age {person1.currentAge}{mode === 'couple' ? ` / ${person2.currentAge}` : ''} → {state.assumptions.lifeExpectancy} · nominal £
          </p>
        </div>
        <button onClick={() => window.print()} className="btn-secondary text-sm no-print">Export / Print</button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Household spending"
          value={formatCurrency(annualSpend)}
          sub={rlssStandard
            ? `${RLSS_STANDARDS[mode][rlssStandard].label} standard · today's £`
            : "today's £ per year"}
          color="slate"
        />
        <KpiCard label="Year 1 income" value={formatCurrency(firstYear?.totalIncome ?? 0)}
          sub={`${formatCurrency(firstYear?.netIncome ?? 0)} after all tax`} color="blue" />
        <KpiCard label="Total assets today" value={formatCurrency(firstYear?.totalAssets ?? 0)}
          sub={unrealisedGain > 0 ? `${formatCurrency(unrealisedGain)} unrealised gain` : 'ISA + GIA + cash + pensions'} color="emerald" />
        <KpiCard label={surplus ? 'Assets at 95' : 'Assets depleted'}
          value={surplus ? formatCurrency(lastPositive?.totalAssets ?? 0) : `Age ${depletionAge}`}
          sub={surplus ? 'on track' : 'review your plan'} color={surplus ? 'emerald' : 'rose'} />
      </div>

      {/* Gap alert */}
      {!surplus && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex gap-3">
          <span className="text-lg flex-shrink-0">⚠️</span>
          <div>
            <p className="font-semibold text-rose-800">Potential funding gap</p>
            <p className="text-sm text-rose-600 mt-0.5">
              At current spending levels, assets could be depleted by age {depletionAge}.
              Consider increasing income sources, adjusting spending, or extending part-time work.
            </p>
          </div>
        </div>
      )}

      {/* Lifetime chart */}
      <Card>
        <h3 className="section-heading">Income vs Spending — Lifetime View</h3>
        <p className="text-sm text-slate-500 mb-4">Stacked bars = income sources. Dashed line = desired spending.</p>
        <LifetimeChart projections={projections} mode={mode} p1Name={p1Name} p2Name={p2Name} />
      </Card>

      {/* Asset chart */}
      <Card>
        <h3 className="section-heading">Asset Balance Over Time</h3>
        <p className="text-sm text-slate-500 mb-4">Combined ISA, GIA, cash and pension balances as you draw from them.</p>
        <AssetChart projections={projections} />
      </Card>

      {/* Per-person breakdown (couples) */}
      {mode === 'couple' && (
        <HouseholdBreakdown projections={projections} p1Name={p1Name} p2Name={p2Name} />
      )}

      {/* Tax strategy */}
      <TaxStrategy projections={projections} />

      {/* CGT section */}
      <CGTSummary projections={projections} p1Name={p1Name} p2Name={p2Name} />

      {/* Quick adjust */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="section-heading">Quick-adjust spending</h3>
            <p className="text-sm text-slate-500">Tweak key categories and see charts update instantly.</p>
          </div>
          <button onClick={() => setShowAdjust(!showAdjust)} className="text-blue-600 text-sm font-medium hover:text-blue-700">
            {showAdjust ? 'Hide' : 'Show'}
          </button>
        </div>
        {showAdjust && (
          <div className="border-t border-slate-100 pt-2">
            {spendingCategories.slice(0, 8).map(cat => (
              <SliderInput key={cat.id} label={cat.name} icon={cat.icon}
                value={cat.amounts[firstStageId] ?? 0}
                onChange={(v) => updateSpendingAmount(cat.id, firstStageId, v)}
                min={0} max={cat.maxValue} step={100} />
            ))}
            <p className="text-xs text-slate-400 pt-2">Go to Step 2 to adjust all categories and life stages.</p>
          </div>
        )}
      </Card>

      {/* Projection table */}
      <ProjectionTable projections={projections} />

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-between pt-2 no-print">
        <button onClick={onBack} className="btn-secondary">Edit income &amp; assets</button>
        <div className="flex gap-3">
          <button
            onClick={() => {
              const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = 'lifeplan-scenario.json'; a.click();
              URL.revokeObjectURL(url);
            }}
            className="btn-secondary text-sm"
          >Save scenario</button>
          <button
            onClick={() => {
              try {
                navigator.clipboard.writeText(`${window.location.origin}?plan=${btoa(JSON.stringify(state))}`).then(() => alert('Link copied!'));
              } catch { alert('Could not generate share link.'); }
            }}
            className="btn-secondary text-sm"
          >Share with adviser</button>
          <button onClick={() => window.print()} className="btn-primary text-sm">Export PDF</button>
        </div>
      </div>
    </div>
  );
}
