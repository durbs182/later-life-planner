'use client';

import { usePlannerStore } from '@/store/plannerStore';
import clsx from 'clsx';

interface Props { onNext: () => void }

export default function Step1HouseholdSetup({ onNext }: Props) {
  const {
    mode, setMode,
    person1, setP1Name, setP1Dob,
    person2, setP2Name, setP2Dob,
    fiAge, setFiAge,
    assumptions, updateAssumptions,
  } = usePlannerStore();

  // Format a date value for display (age label)
  const ageLabel = (age: number) => `${age} years old`;

  return (
    <div className="space-y-6 pb-24">

      {/* Hero */}
      <div className="text-center py-10">
        <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 text-xs font-bold px-4 py-1.5 rounded-full mb-4">
          👋 Step 1 of 5 — Household Setup
        </div>
        <h2 className="text-4xl sm:text-5xl font-black text-slate-900 mb-4 leading-tight tracking-tight">
          Who are we<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-amber-400">
            planning for?
          </span>
        </h2>
        <p className="text-lg text-slate-500 max-w-xl mx-auto">
          Tell us about your household so we can build a plan around your life stages.
        </p>
      </div>

      {/* Planning mode */}
      <div className="game-card">
        <h3 className="section-heading">Household type</h3>
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
      </div>

      {/* Person details */}
      <div className={`grid gap-4 ${mode === 'couple' ? 'sm:grid-cols-2' : ''}`}>

        {/* Person 1 */}
        <div className="game-card space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-black text-sm">
              {mode === 'couple' ? '1' : 'Me'}
            </div>
            <h3 className="font-black text-slate-800">{person1.name || (mode === 'couple' ? 'Person 1' : 'Your details')}</h3>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-2">
              {mode === 'couple' ? 'Your name' : 'Your name'} <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={person1.name}
              onChange={(e) => setP1Name(e.target.value)}
              placeholder={mode === 'couple' ? 'e.g. Alex' : 'e.g. Alex'}
              className="input-base"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-2">
              Date of birth
            </label>
            <input
              type="date"
              value={person1.dateOfBirth}
              onChange={(e) => setP1Dob(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="input-base"
            />
            {person1.currentAge > 0 && (
              <p className="text-xs text-orange-600 font-semibold mt-1.5">{ageLabel(person1.currentAge)}</p>
            )}
          </div>
        </div>

        {/* Person 2 */}
        {mode === 'couple' && (
          <div className="game-card space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black text-sm">
                2
              </div>
              <h3 className="font-black text-slate-800">{person2.name || 'Person 2'}</h3>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-600 mb-2">
                Partner&apos;s name <span className="text-slate-400 font-normal">(optional)</span>
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
              <label className="block text-sm font-semibold text-slate-600 mb-2">
                Date of birth
              </label>
              <input
                type="date"
                value={person2.dateOfBirth}
                onChange={(e) => setP2Dob(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="input-base"
              />
              {person2.currentAge > 0 && (
                <p className="text-xs text-emerald-600 font-semibold mt-1.5">{ageLabel(person2.currentAge)}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Financial independence age */}
      <div className="game-card">
        <h3 className="section-heading">Financial independence age</h3>
        <p className="section-subheading">
          When do you plan to stop working? Life stages — Go-Go Years, Slo-Go Years, No-Go Years — begin from this age.
          The projection still models income and assets from today.
        </p>
        <div className="flex items-center gap-4">
          <input
            type="range" min={person1.currentAge + 1} max={assumptions.lifeExpectancy - 1} step={1}
            value={fiAge}
            onChange={(e) => setFiAge(parseInt(e.target.value))}
            className="flex-1"
            style={{ background: `linear-gradient(to right, #f97316 ${((fiAge - (person1.currentAge + 1)) / (assumptions.lifeExpectancy - 2 - person1.currentAge)) * 100}%, #e2e8f0 ${((fiAge - (person1.currentAge + 1)) / (assumptions.lifeExpectancy - 2 - person1.currentAge)) * 100}%)` }}
          />
          <div className="w-16 h-14 bg-orange-500 text-white font-black text-xl rounded-2xl flex items-center justify-center flex-shrink-0">
            {fiAge}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
          <span>Working years: {person1.currentAge} → {fiAge - 1}</span>
          <span>Life stages start: age {fiAge}</span>
        </div>
      </div>

      {/* Planning horizon */}
      <div className="game-card">
        <h3 className="section-heading">Planning horizon</h3>
        <p className="section-subheading">We&apos;ll model your plan to this age. Being optimistic is wise.</p>
        <div className="flex items-center gap-4">
          <input
            type="range" min={80} max={105} step={1}
            value={assumptions.lifeExpectancy}
            onChange={(e) => updateAssumptions({ lifeExpectancy: parseInt(e.target.value) })}
            className="flex-1"
            style={{ background: `linear-gradient(to right, #8b5cf6 ${((assumptions.lifeExpectancy - 80) / 25) * 100}%, #e2e8f0 ${((assumptions.lifeExpectancy - 80) / 25) * 100}%)` }}
          />
          <div className="w-16 h-14 bg-violet-500 text-white font-black text-xl rounded-2xl flex items-center justify-center flex-shrink-0">
            {assumptions.lifeExpectancy}
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button onClick={onNext} className="btn-primary px-12 text-lg">
          Set your life vision →
        </button>
      </div>
    </div>
  );
}
