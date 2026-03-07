'use client';

import { usePlannerStore } from '@/store/plannerStore';
import Card from '@/components/ui/Card';
import type { AspirationTag } from '@/lib/types';
import clsx from 'clsx';

const ASPIRATIONS: { tag: AspirationTag; label: string; icon: string; description: string }[] = [
  { tag: 'travel',       label: 'Travel',          icon: '✈️',   description: 'Explore the world' },
  { tag: 'hobbies',      label: 'Hobbies',          icon: '🎨',   description: 'Pursue your passions' },
  { tag: 'learning',     label: 'Learning',         icon: '📚',   description: 'Keep growing' },
  { tag: 'family',       label: 'Family',           icon: '👨‍👩‍👧‍👦',  description: 'Time with loved ones' },
  { tag: 'volunteering', label: 'Volunteering',     icon: '🤝',   description: 'Give back' },
  { tag: 'property',     label: 'Property',         icon: '🏡',   description: 'Your home & garden' },
  { tag: 'health',       label: 'Health & Wellness',icon: '💪',   description: 'Wellbeing first' },
  { tag: 'fitness',      label: 'Fitness',          icon: '🏃',   description: 'Stay active' },
];

interface Props {
  onNext: () => void;
}

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
      <div className="text-center py-8">
        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
          What does your ideal life look like?
        </h2>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto">
          Start by picturing the life you want — then we&apos;ll help you see how to fund it.
        </p>
      </div>

      {/* Single / Couple toggle */}
      <Card>
        <h3 className="section-heading">Planning for…</h3>
        <p className="section-subheading">Choose whether you&apos;re planning for yourself or together with a partner.</p>

        <div className="flex gap-3 mb-6">
          {(['single', 'couple'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={clsx(
                'flex-1 py-3 rounded-xl border-2 font-semibold text-base transition-all',
                mode === m
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              )}
            >
              {m === 'single' ? '🙋 Just me' : '👫 My partner and me'}
            </button>
          ))}
        </div>

        {/* People inputs */}
        <div className={`grid gap-6 ${mode === 'couple' ? 'sm:grid-cols-2' : ''}`}>
          {/* Person 1 */}
          <div className="space-y-4">
            {mode === 'couple' && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Your name
                </label>
                <input
                  type="text"
                  value={person1.name}
                  onChange={(e) => setP1Name(e.target.value)}
                  placeholder="e.g. Alex"
                  className="input-base"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                {mode === 'couple' ? 'Your age' : 'Your current age'}
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range" min={45} max={80} step={1}
                  value={person1.currentAge}
                  onChange={(e) => setP1Age(parseInt(e.target.value))}
                  className="flex-1"
                  style={{
                    background: `linear-gradient(to right, #2563eb ${((person1.currentAge - 45) / 35) * 100}%, #e2e8f0 ${((person1.currentAge - 45) / 35) * 100}%)`,
                  }}
                />
                <div className="w-16 text-center bg-blue-600 text-white font-bold text-xl rounded-xl py-2">
                  {person1.currentAge}
                </div>
              </div>
            </div>
          </div>

          {/* Person 2 */}
          {mode === 'couple' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Partner&apos;s name
                </label>
                <input
                  type="text"
                  value={person2.name}
                  onChange={(e) => setP2Name(e.target.value)}
                  placeholder="e.g. Sam"
                  className="input-base"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Partner&apos;s age
                </label>
                <div className="flex items-center gap-4">
                  <input
                    type="range" min={45} max={80} step={1}
                    value={person2.currentAge}
                    onChange={(e) => setP2Age(parseInt(e.target.value))}
                    className="flex-1"
                    style={{
                      background: `linear-gradient(to right, #059669 ${((person2.currentAge - 45) / 35) * 100}%, #e2e8f0 ${((person2.currentAge - 45) / 35) * 100}%)`,
                    }}
                  />
                  <div className="w-16 text-center bg-emerald-600 text-white font-bold text-xl rounded-xl py-2">
                    {person2.currentAge}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Planning horizon */}
        <div className="mt-6 pt-6 border-t border-slate-100">
          <label className="block text-sm font-semibold text-slate-700 mb-2">
            Planning to age
          </label>
          <div className="flex items-center gap-4 max-w-sm">
            <input
              type="range" min={80} max={105} step={1}
              value={assumptions.lifeExpectancy}
              onChange={(e) => updateAssumptions({ lifeExpectancy: parseInt(e.target.value) })}
              className="flex-1"
              style={{
                background: `linear-gradient(to right, #7c3aed ${((assumptions.lifeExpectancy - 80) / 25) * 100}%, #e2e8f0 ${((assumptions.lifeExpectancy - 80) / 25) * 100}%)`,
              }}
            />
            <div className="w-16 text-center bg-purple-600 text-white font-bold text-xl rounded-xl py-2">
              {assumptions.lifeExpectancy}
            </div>
          </div>
        </div>
      </Card>

      {/* Life vision */}
      <Card>
        <h3 className="section-heading">
          {mode === 'couple' ? 'Your shared life vision' : 'Your life vision'}
        </h3>
        <p className="section-subheading">
          In your own words, describe the life you want. What does a great day, week or year look like?
        </p>
        <textarea
          value={lifeVision}
          onChange={(e) => setLifeVision(e.target.value)}
          placeholder={
            mode === 'couple'
              ? 'e.g. We want to travel widely while we have the energy, spend time with grandchildren, and pursue photography and sailing together…'
              : 'e.g. I want to travel to Southeast Asia every winter, spend summers in my garden, help my grandchildren with their education…'
          }
          rows={5}
          className="input-base resize-none leading-relaxed"
        />
        <p className="text-xs text-slate-400 mt-2">
          {lifeVision.length > 0 ? `${lifeVision.length} characters` : 'Optional — but powerful for clarity'}
        </p>
      </Card>

      {/* Aspirations */}
      <Card>
        <h3 className="section-heading">What matters most to you?</h3>
        <p className="section-subheading">Select everything you want your later life to include.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {ASPIRATIONS.map(({ tag, label, icon, description }) => {
            const selected = aspirations.includes(tag);
            return (
              <button
                key={tag}
                onClick={() => toggleAspiration(tag)}
                className={clsx(
                  'flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all text-center',
                  selected
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                )}
              >
                <span className="text-2xl">{icon}</span>
                <span className="font-semibold text-sm">{label}</span>
                <span className="text-xs text-slate-400">{description}</span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Life stages */}
      <Card>
        <h3 className="section-heading">Your life stages</h3>
        <p className="section-subheading">
          We split your later life into stages — adjust the boundaries to match your plans.
          {mode === 'couple' && ' Stages are based on the older partner\'s age.'}
        </p>
        <div className="space-y-4">
          {lifeStages.map((stage, i) => (
            <div
              key={stage.id}
              className="flex flex-wrap items-center gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50"
            >
              <div className="w-3 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={stage.label}
                  onChange={(e) => updateLifeStage(stage.id, { label: e.target.value })}
                  className="font-semibold text-slate-800 text-base bg-transparent border-0 border-b border-dashed border-slate-300 focus:outline-none focus:border-blue-500 w-full"
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span>Age</span>
                <span className="font-bold text-slate-800">{stage.startAge}</span>
                <span>to</span>
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
              <span className="text-sm text-slate-400">({stage.endAge - stage.startAge + 1} years)</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex justify-end pt-4">
        <button onClick={onNext} className="btn-primary px-10">
          Set my spending goals →
        </button>
      </div>
    </div>
  );
}
