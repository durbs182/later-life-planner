'use client';

import CurrencyInput from './CurrencyInput';

interface SliderInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  icon?: string;
  description?: string;
}

export default function SliderInput({
  value,
  onChange,
  min = 0,
  max = 10000,
  step = 100,
  label,
  icon,
  description,
}: SliderInputProps) {
  const pct = max > 0 ? (value / max) * 100 : 0;

  return (
    <div className="py-3">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {icon && <span className="text-lg leading-none">{icon}</span>}
            <span className="font-medium text-slate-800 text-base">{label}</span>
          </div>
          {description && <p className="text-xs text-slate-400 mt-0.5 ml-7">{description}</p>}
        </div>
        <CurrencyInput value={value} onChange={onChange} min={min} max={max} step={step} compact />
      </div>

      <div className="relative ml-7">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="w-full"
          style={{
            background: `linear-gradient(to right, #2563eb ${pct}%, #e2e8f0 ${pct}%)`,
          }}
        />
        <div className="flex justify-between text-xs text-slate-400 mt-1">
          <span>£0</span>
          <span>£{(max / 1000).toFixed(0)}k</span>
        </div>
      </div>
    </div>
  );
}
