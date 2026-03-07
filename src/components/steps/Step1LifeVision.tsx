'use client';

import { usePlannerStore } from '@/store/plannerStore';
import type { AspirationTag } from '@/models/types';
import clsx from 'clsx';

const ASPIRATIONS: { tag: AspirationTag; label: string; icon: string; color: string }[] = [
  { tag: 'travel',       label: 'Travel',          icon: '✈️',  color: 'bg-sky-50 border-sky-200 text-sky-700 data-[on]:bg-sky-500 data-[on]:text-white data-[on]:border-sky-500' },
  { tag: 'hobbies',      label: 'Hobbies',          icon: '🎨',  color: 'bg-purple-50 border-purple-200 text-purple-700 data-[on]:bg-purple-500 data-[on]:text-white data-[on]:border-purple-500' },
  { tag: 'learning',     label: 'Learning',         icon: '📚',  color: 'bg-amber-50 border-amber-200 text-amber-700 data-[on]:bg-amber-500 data-[on]:text-white data-[on]:border-amber-500' },
  { tag: 'family',       label: 'Family',           icon: '👨‍👩‍👧‍👦', color: 'bg-rose-50 border-rose-200 text-rose-700 data-[on]:bg-rose-500 data-[on]:text-white data-[on]:border-rose-500' },
  { tag: 'volunteering', label: 'Volunteering',     icon: '🤝',  color: 'bg-teal-50 border-teal-200 text-teal-700 data-[on]:bg-teal-500 data-[on]:text-white data-[on]:border-teal-500' },
  { tag: 'property',     label: 'Home & Garden',    icon: '🏡',  color: 'bg-lime-50 border-lime-200 text-lime-700 data-[on]:bg-lime-500 data-[on]:text-white data-[on]:border-lime-500' },
  { tag: 'health',       label: 'Wellbeing',        icon: '💚',  color: 'bg-green-50 border-green-200 text-green-700 data-[on]:bg-green-500 data-[on]:text-white data-[on]:border-green-500' },
  { tag: 'fitness',      label: 'Fitness',          icon: '🏃',  color: 'bg-orange-50 border-orange-200 text-orange-700 data-[on]:bg-orange-500 data-[on]:text-white data-[on]:border-orange-500' },
];

const STAGE_COLORS = { active: '#f97316', gradual: '#10b981', later: '#8b5cf6' } as const;

interface Props { onNext: () => void }

export default function Step1LifeVision({ onNext }: Props) {
  const {
    mode, setMode,
    person1, setP1Name, setP1Age,
    person2, setP2Name, setP2Age,
    lifeVision, setLifeVision,
    aspirations, toggleAspiration,
    lifeStages, updateLifeStage,
    assumptions, updateAssumptions,
  } = usePlannerStore();

  return (
    <div className="space-y-6 pb-24">

      {/* Hero */}
      <div className="text-center py-10">
        <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 text-xs font-bold px-4 py-1.5 rounded-full mb-4">
          ✨ Step 1 of 4 — Life Vision
        </div>
        <h2 className="text-4xl sm:text-5xl font-black text-slate-900 mb-4 leading-tight tracking-tight">
          What does your<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-400">
            ideal life look like?
          </span>
        </h2>
        <p className="text-lg text-slate-500 max-w-xl mx-auto">
          The best plan starts with knowing what you want. Let&apos;s design your life first — then figure out how to fund it.
        </p>
      </div>

      {/* Planning mode */}
      <div className="game-card">
        <h3 className="section-heading">Who are you planning for?</h3>
        <div className="grid grid-cols-2 gap-3">
          {(['single', 'couple'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={clsx(
                'flex flex-col items-center gap-2 p-5 rounded-2xl border-2 font-semibold transition-all',
                mode === m
                  ? 'border-orange-400 bg-orange-50 text-orange-700 shadow-sm'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
              )}
            >
              <span className="text-3xl">{m === 'single' ? '🙋' : '👫'}</span>
              <span className="text-base">{m === 'single' ? 'Just me' : 'Me & my partner'}</span>
            </button>
          ))}
        </div>

        {/* Name & age inputs */}
        <div className={`grid gap-4 mt-5 ${mode === 'couple' ? 'sm:grid-cols-2' : ''}`}>
          {/* Person 1 */}
          <div className="space-y-3">
            {mode === 'couple' && (
              <input type="text" value={person1.name} onChange={(e) => setP1Name(e.target.value)}
                placeholder="Your name" className="input-base" />
            )}
            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-2">
                {mode === 'couple' ? 'Your age' : 'Your current age'}
              </label>
              <div className="flex items-center gap-3">
                <input type="range" min={45} max={80} step={1} value={person1.currentAge}
                  onChange={(e) => setP1Age(parseInt(e.target.value))}
                  className="flex-1"
                  style={{ background: `linear-gradient(to right, #f97316 ${((person1.currentAge - 45) / 35) * 100}%, #e2e8f0 ${((person1.currentAge - 45) / 35) * 100}%)` }}
                />
                <div className="w-14 h-12 bg-orange-500 text-white font-black text-xl rounded-2xl flex items-center justify-center flex-shrink-0">
                  {person1.currentAge}
                </div>
              </div>
            </div>
          </div>

          {/* Person 2 */}
          {mode === 'couple' && (
            <div className="space-y-3">
              <input type="text" value={person2.name} onChange={(e) => setP2Name(e.target.value)}
                placeholder="Partner's name" className="input-base" />
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-2">Partner&apos;s age</label>
                <div className="flex items-center gap-3">
                  <input type="range" min={45} max={80} step={1} value={person2.currentAge}
                    onChange={(e) => setP2Age(parseInt(e.target.value))}
                    className="flex-1"
                    style={{ background: `linear-gradient(to right, #10b981 ${((person2.currentAge - 45) / 35) * 100}%, #e2e8f0 ${((person2.currentAge - 45) / 35) * 100}%)` }}
                  />
                  <div className="w-14 h-12 bg-emerald-500 text-white font-black text-xl rounded-2xl flex items-center justify-center flex-shrink-0">
                    {person2.currentAge}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Planning horizon */}
        <div className="mt-5 pt-5 border-t border-slate-100">
          <label className="block text-sm font-semibold text-slate-600 mb-2">
            Planning to age <span className="text-violet-600 font-black">{assumptions.lifeExpectancy}</span>
          </label>
          <div className="flex items-center gap-3 max-w-xs">
            <input type="range" min={80} max={105} step={1} value={assumptions.lifeExpectancy}
              onChange={(e) => updateAssumptions({ lifeExpectancy: parseInt(e.target.value) })}
              className="flex-1"
              style={{ background: `linear-gradient(to right, #8b5cf6 ${((assumptions.lifeExpectancy - 80) / 25) * 100}%, #e2e8f0 ${((assumptions.lifeExpectancy - 80) / 25) * 100}%)` }}
            />
          </div>
        </div>
      </div>

      {/* Life stage visual timeline */}
      <div className="game-card">
        <h3 className="section-heading">Your life stages</h3>
        <p className="section-subheading">
          We divide your plan into three stages. Adjust the boundaries to match your vision.
        </p>

        {/* Visual timeline bar */}
        <div className="flex rounded-2xl overflow-hidden mb-5 h-12 shadow-inner-soft">
          {lifeStages.map((stage, i) => {
            const span = stage.endAge - stage.startAge + 1;
            const total = assumptions.lifeExpectancy - person1.currentAge + 1;
            const pct = (span / total) * 100;
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
                    className="w-14 input-base text-center py-1 text-sm"
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

      {/* Aspirations */}
      <div className="game-card">
        <h3 className="section-heading">What matters most to you?</h3>
        <p className="section-subheading">Pick everything you want your later life to include.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {ASPIRATIONS.map(({ tag, label, icon }) => {
            const on = aspirations.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleAspiration(tag)}
                data-on={on || undefined}
                className={clsx(
                  'flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all text-center',
                  on
                    ? 'border-orange-400 bg-orange-50 text-orange-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:bg-orange-50/50'
                )}
              >
                <span className="text-2xl">{icon}</span>
                <span className="font-semibold text-xs">{label}</span>
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

      <div className="flex justify-end pt-2">
        <button onClick={onNext} className="btn-primary px-12 text-lg">
          Set spending goals →
        </button>
      </div>
    </div>
  );
}
