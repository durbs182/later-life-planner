'use client';

import { useState } from 'react';
import Image from 'next/image';
import { usePlannerStore } from '@/store/plannerStore';
import ConfirmModal from '@/components/ui/ConfirmModal';

type PendingAction = 'reset' | 'demo' | null;

interface Props { onReset: () => void }

export default function Header({ onReset }: Props) {
  const { loadDemo } = usePlannerStore();
  const [pending, setPending] = useState<PendingAction>(null);

  function handleConfirm() {
    if (pending === 'reset') onReset();
    if (pending === 'demo') loadDemo();
    setPending(null);
  }

  return (
    <>
      <header className="bg-white/80 backdrop-blur-sm border-b border-orange-100/60 no-print sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-hero shadow-inner-soft flex items-center justify-center">
              <Image src="/images/victorylap_icon.svg" alt="LifePlan icon" width={40} height={40} className="rounded-[14px]" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 leading-tight tracking-tight">LifePlan</h1>
              <p className="text-xs text-slate-400 leading-tight hidden sm:block">Design the life you want</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setPending('demo')}
              className="btn-ghost text-orange-600 hover:text-orange-700 hover:bg-orange-50"
              title="Load a sample scenario to explore"
            >
              ✨ Demo
            </button>
            <button
              onClick={() => setPending('reset')}
              className="btn-ghost text-slate-400 hover:text-rose-500"
            >
              Reset
            </button>
          </div>
        </div>
      </header>

      {pending === 'reset' && (
        <ConfirmModal
          title="Reset your plan?"
          message="This will clear all your data and start fresh. This cannot be undone."
          confirmLabel="Reset plan"
          onConfirm={handleConfirm}
          onCancel={() => setPending(null)}
        />
      )}

      {pending === 'demo' && (
        <ConfirmModal
          title="Load the demo scenario?"
          message="This will replace your current plan with sample data. Any data you've entered will be lost."
          confirmLabel="Load demo"
          onConfirm={handleConfirm}
          onCancel={() => setPending(null)}
        />
      )}
    </>
  );
}
