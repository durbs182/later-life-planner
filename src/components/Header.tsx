'use client';

import { usePlannerStore } from '@/store/plannerStore';

export default function Header() {
  const { loadDemo, resetPlan } = usePlannerStore();

  return (
    <header className="bg-white border-b border-slate-100 no-print">
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">LifePlan</h1>
              <p className="text-xs text-slate-500 leading-tight hidden sm:block">
                Plan the life you want and see how your income and assets support it
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadDemo}
            className="btn-ghost text-sm"
            title="Load a sample scenario to explore the tool"
          >
            Load Demo
          </button>
          <button
            onClick={() => {
              if (confirm('Reset your plan and start fresh?')) resetPlan();
            }}
            className="btn-ghost text-sm text-slate-400 hover:text-rose-500"
          >
            Reset
          </button>
        </div>
      </div>
    </header>
  );
}
