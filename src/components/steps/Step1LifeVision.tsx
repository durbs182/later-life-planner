'use client';

import { usePlannerStore } from '@/store/plannerStore';
import type { AspirationTag } from '@/models/types';
import clsx from 'clsx';

const ASPIRATIONS: { tag: AspirationTag; label: string; icon: string }[] = [
  { tag: 'travel',       label: 'Travel',       icon: '✈️'  },
  { tag: 'hobbies',      label: 'Hobbies',       icon: '🎨'  },
  { tag: 'learning',     label: 'Learning',      icon: '📚'  },
  { tag: 'family',       label: 'Family',        icon: '👨‍👩‍👧‍👦' },
  { tag: 'giving',       label: 'Giving',        icon: '💝'  },
  { tag: 'volunteering', label: 'Volunteering',  icon: '🤝'  },
  { tag: 'property',     label: 'Home & Garden', icon: '🏡'  },
  { tag: 'health',       label: 'Wellbeing',     icon: '💚'  },
  { tag: 'fitness',      label: 'Fitness',       icon: '🏃'  },
];

const STAGE_COLORS = { active: '#f97316', gradual: '#10b981', later: '#8b5cf6' } as const;

interface Props { onNext: () => void; onBack: () => void }

export default function Step2LifeVision({ onNext, onBack }: Props) {
  const {
    mode,
    person1,
    lifeVision, setLifeVision,
    aspirations, toggleAspiration,
    lifeStages, updateLifeStage,
    assumptions,
  } = usePlannerStore();

  return (
    <div className="space-y-6 pb-24">

      {/* Hero */}
      <div className="text-center py-10">
        <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 text-xs font-bold px-4 py-1.5 rounded-full mb-4">
          ✨ Step 2 of 5 — Life Vision
        </div>
        <h2 className="text-4xl sm:text-5xl font-black text-slate-900 mb-4 leading-tight tracking-tight">
          What does your<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-400">
            ideal life look like?
          </span>
        </h2>
        <p className="text-lg text-slate-500 max-w-xl mx-auto">
          The best plan starts with knowing what you want. Design your life first — then figure out how to fund it.
        </p>
      </div>

      {/* Life stage visual timeline */}
      <div className="game-card">
        <h3 className="section-heading">Your life stages</h3>
        <p className="section-subheading">
          We divide your plan into three stages. Adjust the boundaries to match your vision.
        </p>

        {/* Visual timeline bar */}
        <div className="flex rounded-2xl overflow-hidden mb-5 h-12 shadow-inner-soft">
          {lifeStages.map((stage) => {
            const span  = stage.endAge - stage.startAge + 1;
            const total = assumptions.lifeExpectancy - person1.currentAge + 1;
            const pct   = (span / total) * 100;
            return (
              <div
                key={stage.id}
                className="flex items-center justify-center text-white text-xs font-bold gap-1 transition-all"
                style={{ width: `${pct}%`, backgroundColor: stage.color }}
              >
                <span>{stage.startAge}</span>
                <span className="hidden sm:inline">— {stage.label}</span>
              </div>
            );
          })}
        </div>

        <div className="space-y-3">
          {lifeStages.map((stage, i) => (
            <div key={stage.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="w-3 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
              <input
                type="text"
                value={stage.label}
                onChange={(e) => updateLifeStage(stage.id, { label: e.target.value })}
                className="flex-1 font-semibold text-slate-800 bg-transparent border-0 border-b border-dashed border-slate-300 focus:outline-none focus:border-orange-400 text-sm"
              />
              <div className="flex items-center gap-1.5 text-sm text-slate-600 flex-shrink-0">
                <span className="font-bold text-slate-800">{stage.startAge}</span>
                <span className="text-slate-400">–</span>
                {i < lifeStages.length - 1 ? (
                  <input
                    type="number"
                    min={stage.startAge + 1}
                    max={lifeStages[i + 1]?.endAge ?? 95}
                    value={stage.endAge}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (!isNaN(v)) {
                        updateLifeStage(stage.id, { endAge: v });
                        updateLifeStage(lifeStages[i + 1].id, { startAge: v + 1 });
                      }
                    }}
                    className="w-16 input-base text-center py-1 text-sm"
                  />
                ) : (
                  <span className="font-bold text-slate-800">{stage.endAge}</span>
                )}
              </div>
              <span className="text-xs text-slate-400 hidden sm:block">
                {stage.endAge - stage.startAge + 1}yr
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Life goals */}
      <div className="game-card">
        <h3 className="section-heading">What matters most to you?</h3>
        <p className="section-subheading">Pick everything you want your later life to include.</p>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
          {ASPIRATIONS.map(({ tag, label, icon }) => {
            const on = aspirations.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleAspiration(tag)}
                className={clsx(
                  'flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all text-center',
                  on
                    ? 'border-orange-400 bg-orange-50 text-orange-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:bg-orange-50/50'
                )}
              >
                <span className="text-2xl">{icon}</span>
                <span className="font-semibold text-xs leading-tight">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Life vision text */}
      <div className="game-card">
        <h3 className="section-heading">
          {mode === 'couple' ? '💬 Your shared life vision' : '💬 Your life vision'}
        </h3>
        <p className="section-subheading">
          In your own words — what does a great week, month or year look like?
        </p>
        <textarea
          value={lifeVision}
          onChange={(e) => setLifeVision(e.target.value)}
          placeholder={mode === 'couple'
            ? 'e.g. We want to travel widely while we have the energy, spend time with grandchildren, pursue photography and sailing…'
            : 'e.g. I want to winter in Southeast Asia, spend summers in my garden, help my grandchildren with their education…'}
          rows={4}
          className="input-base resize-none leading-relaxed text-base"
        />
        <p className="text-xs text-slate-400 mt-2 text-right">
          {lifeVision.length > 0 ? `${lifeVision.length} characters` : 'Optional — but powerful for clarity'}
        </p>
      </div>

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="btn-secondary">← Back</button>
        <button onClick={onNext} className="btn-primary px-10 text-base">
          Set spending goals →
        </button>
      </div>
    </div>
  );
}
