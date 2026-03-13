'use client';

import { useState } from 'react';
import Image from 'next/image';

interface Props { onAccept: () => void }

export default function DisclaimerGate({ onAccept }: Props) {
  const [agreed, setAgreed] = useState(false);

  return (
    <div className="min-h-screen relative overflow-hidden bg-cream-100 px-4 py-5 sm:px-6 sm:py-8">
      <div className="absolute inset-x-0 top-0 h-[320px] bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.22),transparent_58%)] pointer-events-none" />
      <div className="absolute left-1/2 top-8 h-48 w-48 -translate-x-1/2 rounded-full bg-orange-200/25 blur-3xl pointer-events-none" />
      <div className="relative mx-auto flex min-h-screen max-w-5xl items-center justify-center">
        <div className="w-full space-y-4 sm:space-y-5">

          {/* Logo / brand mark */}
          <div className="text-center">
            <div className="mx-auto mb-3 flex w-full max-w-[290px] justify-center sm:max-w-[330px]">
              <div className="relative aspect-[300/78] w-full">
                <Image
                  src="/images/victorylap_logo.svg"
                  alt="Later Life Planner"
                  fill
                  sizes="(max-width: 640px) 290px, 330px"
                  className="object-contain"
                  priority
                />
              </div>
            </div>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500 sm:text-xs">
              Later Life Planner
            </p>
            <h1 className="mx-auto max-w-[11ch] text-[2.55rem] font-black tracking-[-0.045em] leading-[0.98] text-slate-950 sm:max-w-none sm:text-[4.35rem] sm:leading-[0.95]">
              <span className="block">What this planner</span>
              <span className="mt-1 block text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-500 sm:mt-1.5">
                does
              </span>
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-500">
                and doesn&apos;t do
              </span>
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-[17px] sm:leading-7">
              A quick guide before you begin, so the numbers are useful in the right way.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/70 bg-white/95 p-5 text-[15px] leading-relaxed text-slate-700 shadow-[0_24px_80px_rgba(15,23,42,0.09)] backdrop-blur sm:p-7">
            <div className="mb-5 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-orange-50 to-white p-4 sm:p-5">
              <p className="text-sm font-bold text-amber-900 sm:text-[17px]">
                This planner does not give personal financial advice.
              </p>
              <p className="mt-1 text-sm leading-6 text-amber-950/80 sm:text-[15px]">
                This is not regulated financial advice.
              </p>
              <p className="mt-1 text-sm leading-6 text-amber-950/80 sm:text-[15px]">
                If you need advice tailored to your circumstances, speak to a qualified professional.
              </p>
            </div>

            <div className="gap-4 lg:flex lg:items-start">
              <div className="space-y-4 lg:min-w-0 lg:flex-[1.05]">
                <p className="text-[15px] leading-7 text-slate-700 sm:text-base">
                  This planner is designed to help with one specific task:{' '}
                  <strong className="font-semibold text-slate-950">
                    comparing how different ways of drawing from pensions, ISAs, savings and other assets could affect your income over time
                  </strong>
                  .
                </p>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/90 p-4 sm:p-5">
                  <p className="mb-2 text-sm font-bold text-slate-900 sm:text-[15px]">Use it to explore:</p>
                  <ul className="space-y-2 pl-1 text-sm leading-6 text-slate-700 sm:text-[15px]">
                    <li className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-orange-500" />
                      <span>which pots you might draw from first</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-orange-500" />
                      <span>how spending choices could affect your income over time</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-orange-500" />
                      <span>where you may want a professional second opinion</span>
                    </li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 sm:p-5">
                  <p className="mb-1 font-bold text-amber-900">A note on the numbers</p>
                  <p className="text-sm leading-6 text-amber-950/85 sm:text-[15px]">
                    The projections use fixed assumptions for growth, inflation and tax rules. Real life will be different, and rules can change, so treat these results as examples, not forecasts.
                  </p>
                </div>

                <p className="text-sm leading-6 text-slate-600 sm:text-[15px]">
                  If you need advice tailored to your circumstances, speak to a qualified financial adviser. Try{' '}
                  <a href="https://www.unbiased.co.uk" target="_blank" rel="noopener noreferrer" className="font-medium text-orange-600 underline decoration-orange-300 underline-offset-2 hover:text-orange-800">
                    unbiased.co.uk
                  </a>{' '}
                  or{' '}
                  <a href="https://www.vouchedfor.co.uk" target="_blank" rel="noopener noreferrer" className="font-medium text-orange-600 underline decoration-orange-300 underline-offset-2 hover:text-orange-800">
                    vouchedfor.co.uk
                  </a>.
                </p>
              </div>

              <div className="mt-4 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.05)] sm:p-5 lg:mt-0 lg:flex-[0.95]">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">
                  Best for
                </p>
                <div className="mt-3 grid gap-3">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                    <p className="mb-2 font-bold text-emerald-900">What it helps with</p>
                    <ul className="space-y-2 text-sm leading-6 text-emerald-950/90 sm:text-[15px]">
                      <li className="flex gap-2"><span>✓</span><span>Comparing different ways to draw from your assets</span></li>
                      <li className="flex gap-2"><span>✓</span><span>Seeing how spending choices affect your plan over time</span></li>
                      <li className="flex gap-2"><span>✓</span><span>Preparing for a conversation with a financial adviser</span></li>
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <p className="mb-2 font-bold text-stone-900">What it won&apos;t cover</p>
                    <ul className="space-y-2 text-sm leading-6 text-stone-700 sm:text-[15px]">
                      <li className="flex gap-2"><span>✕</span><span>Telling you what you personally should do</span></li>
                      <li className="flex gap-2"><span>✕</span><span>Assessing whether a strategy is suitable for you</span></li>
                      <li className="flex gap-2"><span>✕</span><span>Complex cases such as trusts, business assets or inheritance tax planning</span></li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 border-t border-slate-100 pt-5">
              <label className="group flex cursor-pointer items-start gap-3">
                <div className="relative mt-0.5 flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={(e) => setAgreed(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all ${agreed ? 'border-orange-500 bg-orange-500' : 'border-slate-300 group-hover:border-orange-300'}`}>
                    {agreed ? (
                      <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </div>
                </div>
                <span className="text-sm leading-6 text-slate-700">
                  I understand this planner is for guidance only and does not give personal financial advice.
                </span>
              </label>

              {/* CTA */}
              <div className="mt-5 text-center sm:text-right">
                <button
                  onClick={onAccept}
                  disabled={!agreed}
                  className={`rounded-2xl border px-10 py-3.5 text-base font-black transition-all ${
                    agreed
                      ? 'border-orange-400 bg-gradient-to-r from-orange-500 to-amber-400 text-white shadow-game hover:-translate-y-0.5 hover:shadow-game-lg'
                      : 'cursor-not-allowed border-slate-200 bg-slate-200 text-slate-500 shadow-inner'
                  }`}
                >
                  Get started →
                </button>
                <p className="mt-2 text-xs text-slate-500">
                  You can review the assumptions and reset the plan at any time.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
