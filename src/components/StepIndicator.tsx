'use client';

import clsx from 'clsx';

interface Step { label: string; description: string }

interface Props {
  steps: Step[];
  currentStep: number;
  onStepClick: (i: number) => void;
}

export default function StepIndicator({ steps, currentStep, onStepClick }: Props) {
  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
      {steps.map((step, i) => {
        const done   = i < currentStep;
        const active = i === currentStep;
        const locked = i > currentStep;
        return (
          <button
            key={i}
            onClick={() => !locked && onStepClick(i)}
            disabled={locked}
            aria-disabled={locked}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold transition-all duration-200 flex-shrink-0',
              active  && 'bg-orange-500 text-white shadow-sm',
              done    && 'bg-orange-100 text-orange-700 hover:bg-orange-200',
              locked  && 'bg-slate-100 text-slate-400 cursor-not-allowed opacity-60',
            )}
          >
            <span className={clsx(
              'w-5 h-5 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0',
              active && 'bg-white/30 text-white',
              done   && 'bg-orange-500 text-white',
              locked && 'bg-slate-200 text-slate-400',
            )}>
              {done ? '✓' : i + 1}
            </span>
            <span className="hidden sm:inline">{step.label}</span>
          </button>
        );
      })}

      {/* Progress bar */}
      <div className="flex-1 min-w-8 mx-1 hidden md:block">
        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-400 rounded-full transition-all duration-500"
            style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
