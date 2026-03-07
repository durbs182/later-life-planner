'use client';

import clsx from 'clsx';

interface Step {
  label: string;
  description: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  onStepClick: (step: number) => void;
}

export default function StepIndicator({ steps, currentStep, onStepClick }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
      {steps.map((step, i) => {
        const isComplete = i < currentStep;
        const isActive = i === currentStep;
        return (
          <button
            key={i}
            onClick={() => onStepClick(i)}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-sm font-medium whitespace-nowrap',
              isActive && 'bg-blue-600 text-white shadow-sm',
              isComplete && 'text-emerald-700 hover:bg-emerald-50',
              !isActive && !isComplete && 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            )}
          >
            <span
              className={clsx(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                isActive && 'bg-white text-blue-600',
                isComplete && 'bg-emerald-100 text-emerald-700',
                !isActive && !isComplete && 'bg-slate-100 text-slate-400'
              )}
            >
              {isComplete ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </span>
            <span className="hidden sm:block">{step.label}</span>
          </button>
        );
      })}
    </div>
  );
}
