'use client';

import { useState } from 'react';

interface Props { onAccept: () => void }

export default function DisclaimerGate({ onAccept }: Props) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-cream-100 px-4 py-12">
      <div className="max-w-2xl w-full space-y-6">

        {/* Logo / brand mark */}
        <div className="text-center mb-2">
          <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 text-xs font-bold px-4 py-1.5 rounded-full mb-4">
            🌅 Later Life Planner
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            Before you start —<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-400">
              what this tool is (and isn&apos;t)
            </span>
          </h1>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 sm:p-8 space-y-5 text-sm text-slate-700 leading-relaxed">

          <p>
            This planner is designed to help you think through one specific question:{' '}
            <strong className="text-slate-900">
              how to structure withdrawals from your pension, ISA, savings and other assets
              in a tax-efficient way
            </strong>{' '}
            during your later life.
          </p>

          <p>
            It&apos;s a planning aid — not regulated financial advice. It doesn&apos;t account for your
            full financial picture, and it won&apos;t replace a conversation with a qualified professional.
            The tax rules and thresholds used are based on current UK legislation and are subject to change.
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
              <p className="font-bold text-emerald-800 mb-2">What it does well</p>
              <ul className="space-y-1.5 text-emerald-900">
                <li className="flex gap-2"><span>✓</span><span>Helps you model a tax-efficient order for drawing from different asset types</span></li>
                <li className="flex gap-2"><span>✓</span><span>Shows how different spending levels affect your plan over time</span></li>
                <li className="flex gap-2"><span>✓</span><span>Gives you a starting point for thinking about your later-life income</span></li>
              </ul>
            </div>
            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
              <p className="font-bold text-slate-700 mb-2">What it doesn&apos;t do</p>
              <ul className="space-y-1.5 text-slate-600">
                <li className="flex gap-2"><span>✗</span><span>Give regulated financial advice</span></li>
                <li className="flex gap-2"><span>✗</span><span>Account for complex situations (business assets, trusts, inheritance tax planning, etc.)</span></li>
                <li className="flex gap-2"><span>✗</span><span>Replace a financial adviser</span></li>
              </ul>
            </div>
          </div>

          <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4">
            <p className="font-bold text-amber-800 mb-1">A note on the numbers</p>
            <p className="text-amber-900">
              Asset growth in this tool uses a simplified model — a fixed annual return applied
              consistently over time. Real investment returns vary year to year and are never
              guaranteed. The projections here are illustrative, not a forecast.
            </p>
          </div>

          <p>
            If your situation is complex or you want personalised advice, please speak to a
            qualified financial adviser. You can find one at{' '}
            <a href="https://www.unbiased.co.uk" target="_blank" rel="noopener noreferrer" className="underline text-orange-600 hover:text-orange-800">unbiased.co.uk</a>
            {' '}or{' '}
            <a href="https://www.vouchedfor.co.uk" target="_blank" rel="noopener noreferrer" className="underline text-orange-600 hover:text-orange-800">vouchedfor.co.uk</a>.
          </p>

          {/* Checkbox */}
          <label className="flex items-start gap-3 cursor-pointer group pt-2 border-t border-slate-100">
            <div className="relative flex-shrink-0 mt-0.5">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="sr-only"
              />
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${agreed ? 'bg-orange-500 border-orange-500' : 'border-slate-300 group-hover:border-orange-300'}`}>
                {agreed && <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
            </div>
            <span className="text-slate-600 text-sm leading-snug">
              I understand this tool is for planning guidance only and is not regulated financial advice.
            </span>
          </label>
        </div>

        {/* CTA */}
        <div className="text-center">
          <button
            onClick={onAccept}
            disabled={!agreed}
            className={`px-10 py-3.5 rounded-2xl font-black text-base transition-all ${
              agreed
                ? 'bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-game hover:shadow-game-lg hover:-translate-y-0.5'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            Get started →
          </button>
        </div>

      </div>
    </div>
  );
}
