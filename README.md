# Later Life Planner

A UK later-life financial planning tool for people aged 50–75. Aspiration-first: define the life you want, then see how your income and assets can fund it.

Built with Next.js 14, TypeScript, TailwindCSS, and Recharts. Deployable to Vercel with no backend or authentication required.

---

## What it does

A four-step wizard that takes you from life vision to a full lifetime financial dashboard:

**Step 1 — Life Vision**
Define your aspirations, life stages (Active / Gradual / Later), and planning horizon. Works for individuals or couples, with each person's details captured separately.

**Step 2 — Spending Goals**
Set your target annual spending in today's £. Choose a starting point from UK Retirement Living Standards (PLSA 2024), then refine by category:

| Household | Minimum | Moderate | Comfortable |
|-----------|---------|----------|-------------|
| Single | £13,400 | £31,700 | £43,900 |
| Couple | £21,600 | £43,900 | £60,600 |

21 spending categories across four tiers: Essential, Enjoyment, Aspirational, and Life-Stage/Variable.

**Step 3 — Income & Assets**
Capture all income streams and assets individually per person, grouped by priority:

1. **Guaranteed income** — DB pension, annuity, State Pension (fills personal allowance first)
2. **Property income** — rental income, property value and base cost for CGT
3. **Flexible sources** — DC pension, part-time work, other income

Assets include Cash, ISA, General Investments (GIA with base cost for CGT), and Property.

**Step 4 — Lifetime Dashboard**
A full projection from today to age 95 showing:
- Income vs spending chart (stacked bars + spending line)
- Asset balance trajectory
- Year-by-year projection table with income tax and CGT columns
- CGT summary (lifetime total, peak year, per-year breakdown)
- Tax-efficient withdrawal strategy panel

---

## Tax modelling

- **Income tax** — UK 2024/25 rates; personal allowance £12,570; basic rate 20% to £50,270; higher rate 40% above. Modelled per person.
- **CGT** — proportional disposal method on GIA drawdowns; £3,000 annual exempt amount; 10%/20% rates. Base cost tracked and reduced proportionally on each withdrawal.
- **DC pension** — UFPLS model: 25% of each drawdown is tax-free, 75% taxed as income.
- **Property CGT** — base cost captured for future planning; not modelled on sale in Phase 1.

**Withdrawal order (tax-efficient):**
1. Personal allowance — guaranteed income fills this first
2. CGT allowance — GIA disposals up to £3,000 exempt
3. PCLS — 25% tax-free pension commencement lump sum
4. ISA — completely tax-free
5. Taxable pension income — 75% of DC drawdown

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | TailwindCSS |
| Charts | Recharts |
| State | Zustand with localStorage persistence |
| Deployment | Vercel |

---

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build   # production build
```

---

## Project structure

```
src/
  app/                  # Next.js app router (layout, page, globals.css)
  components/
    steps/              # Step1–Step4 wizard screens
    charts/             # LifetimeChart, AssetChart (Recharts)
    ui/                 # Card, Toggle, CurrencyInput, SliderInput
    Header.tsx
    StepIndicator.tsx
    SummaryBar.tsx      # Sticky bottom bar with live spend/income/gap
  lib/
    types.ts            # All TypeScript interfaces
    calculations.ts     # Projection engine, tax calculations, CGT
    mockData.ts         # Default state, RLSS standards, demo data
  store/
    plannerStore.ts     # Zustand store with persist middleware
```

---

## Demo

Click **Load demo** in the header to populate a realistic couple scenario: Alex (57) and Sam (55) with a mix of DC pensions, ISA, GIA investments, DB pension, and part-time work.

---

## Deployment

Deploy to Vercel in one step:

```bash
npx vercel
```

No environment variables or database setup required.
