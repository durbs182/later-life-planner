'use client';

import { usePlannerStore } from '@/store/plannerStore';

export default function Header() {
  const { loadDemo, resetPlan } = usePlannerStore();

  return (
    <header className="bg-white/80 backdrop-blur-sm border-b border-orange-100/60 no-print sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-hero rounded-2xl flex items-center justify-center shadow-sm">
            <span className="text-lg">🌅</span>
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 leading-tight tracking-tight">LifePlan</h1>
            <p className="text-xs text-slate-400 leading-tight hidden sm:block">Design the life you want</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={loadDemo}
            className="btn-ghost text-orange-600 hover:text-orange-700 hover:bg-orange-50"
            title="Load a sample scenario to explore"
          >
            ✨ Demo
          </button>
          <button
            onClick={() => { if (confirm('Reset your plan and start fresh?')) resetPlan(); }}
            className="btn-ghost text-slate-400 hover:text-rose-500"
          >
            Reset
          </button>
        </div>
      </div>
    </header>
  );
}
