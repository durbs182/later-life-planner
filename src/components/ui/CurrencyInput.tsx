'use client';

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  compact?: boolean;
}

export default function CurrencyInput({
  value,
  onChange,
  min = 0,
  max = 999999,
  step = 100,
  className = '',
  compact = false,
}: CurrencyInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    const num = parseInt(raw, 10);
    if (!isNaN(num)) {
      onChange(Math.min(max, Math.max(min, num)));
    } else if (raw === '') {
      onChange(0);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium text-sm pointer-events-none">
        £
      </span>
      <input
        type="text"
        inputMode="numeric"
        value={value === 0 ? '' : value.toLocaleString('en-GB')}
        onChange={handleChange}
        placeholder="0"
        className={`input-base pl-7 ${compact ? 'py-1.5 text-sm w-28' : 'w-36'}`}
      />
    </div>
  );
}
