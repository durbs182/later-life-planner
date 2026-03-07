# Product Prompt — Later-Life Planner

> Stored as required by engineering standards. This is the source specification for the build.

## Overview

You are an expert fintech software engineer and product designer.

You are building a Phase 1 MVP web application for a UK later-life lifestyle planning platform.

**Goal:** help users plan the life they want, define desired spending, and generate a tax-efficient income plan from their assets.

Avoid the term "retirement".

**User journey:** Life Vision → Spending Goals → Income Sources → Assets → Tax-Efficient Income Plan

Support single users or couples. Capture all income streams individually per person. For taxable assets, capture base cost for CGT calculation.

---

## UI / Design

- Modern, clean, friendly, slightly gamified UI
- Inspiration: life simulation dashboards, modern fintech dashboards
- Reference images are in /docs/ui-reference-images/ (do NOT copy exactly, just inspiration)
- Layout: card-based panels, visual controls, timeline views, interactive sliders, progress bars
- Avoid outdated 2000s Sims-style graphics

---

## Tech Stack

- **Frontend:** Next.js + React + TypeScript
- **Styling:** TailwindCSS
- **Charts:** Recharts or Chart.js
- **Icons:** Lucide or Heroicons
- **Backend:** Node.js API routes
- **Deployment:** Vercel compatible

---

## Engineering Standards

- No hardcoded financial values (tax allowances, thresholds, inflation, growth, RLSS values)
- Use central configuration system (e.g., /config/financialConstants.ts)
- Allow environment-driven configuration (NEXT_PUBLIC_DEFAULT_INFLATION, NEXT_PUBLIC_INVESTMENT_RETURN)
- Strong TypeScript typing for User, Person, IncomeSource, Asset, Property, SpendingCategory, LifeStage, ProjectionResult
- Modular architecture: /components, /charts, /config, /models, /services, /utils, /financialEngine, /tests, /docs
- Financial logic in /financialEngine only
- Reusable helpers for tax calculations, withdrawal sequencing, income aggregation, asset projections, inflation adjustments
- Inline documentation for all formulas, assumptions, purpose

---

## Unit Tests

- Use Jest or Vitest
- Test: tax calculations, withdrawal ordering, projection engine, CGT calculations, joint GIA drawdown
- Validate edge cases and calculation accuracy
- Tests stored in /tests/financialEngine.test.ts

---

## Git Workflow

- Use feature branch (e.g., feature/life-planning-mvp)
- Meaningful commit messages
- No direct commits to main

---

## Documentation

- Maintain README.md with project overview, architecture, configuration, calculation engine, setup instructions
- Store original build prompt in /docs/product_prompt.md
- UI reference images stored in /docs/ui-reference-images/

---

## Product Features

### Step 1 — Household Setup
- Single or Couple
- Each person captured individually (name, date of birth)
- **Financial independence age** (FI age): when person 1 plans to stop working.
  Life stages (Go-Go Years, Slo-Go Years, No-Go Years) are anchored to this age —
  they do NOT start from current age. The working period (current age → FI age - 1) is
  still fully modelled in projections (income, asset growth) using Go-Go Years spending
  as a baseline. Default FI age: 65. FI age must be > current age and < life expectancy.

### Step 2 — Life Vision
- Capture life goals: travel, family, hobbies, learning, giving, property changes
- Represent visually using cards or tiles

### Step 3 — Spending Goals (today's money)
- Option A: Simplified Retirement Living Standards template (Minimum / Moderate / Comfortable, single or couple)
- Option B: Custom categories:
  - Essential (housing, food, utilities, transport, insurance, healthcare)
  - Lifestyle (travel, dining, hobbies)
  - Family & Giving (family support, charity, gifts)
  - Other (home improvements, major purchases, buffer)
- Total spending updates dynamically

### Step 4 — Income Sources
- Individual capture per person
- Guaranteed income: State Pension, Defined Benefit Pension, Annuities
- Property income (owner: A/B/Joint)
- Investment assets:
  - Pension (DC): owner, current value, growth. PCLS is fixed at 25% (HMRC maximum) — NOT user-configurable. PCLS is entirely tax-free and has no bearing on income tax bands, so offering a variable % would be misleading.
  - ISA: owner, value, growth
  - GIA: owner (A/B/Joint), current value, base cost, growth. If joint, allow drawdown individually to optimise CGT per person
  - Cash savings: owner, balance

### Step 5 — Tax-Efficient Income Strategy
- Withdrawal order:
  1. Personal allowance
  2. CGT allowance (GIA disposals)
  3. Pension tax-free cash (PCLS)
  4. ISA withdrawals
  5. Taxable pension withdrawals
- Optimised for couples: use both personal allowances and CGT allowances before taxable income
- Allowances sourced from configuration, not hardcoded

### Step 6 — Dashboard / Lifetime Timeline
- Visualisation of income sources, spending, assets by age
- Life stage timeline, spending bars, income stacks, asset projections, lifestyle indicators
- Gamified progress bars and interactive UI elements
- Timeline sliders to adjust spending/income dynamically

### Step 7 — Gamification
- Life goal progress bars
- Income stability meter
- Spending confidence indicator
- Timeline life stages

---

## Output Requirements

- Full project folder structure
- All code files
- Example mock data
- Clear setup instructions
- Maintainable, modular, and testable code
- Inline documentation for all financial calculations
- Unit tests for all core engines
- README with project overview, setup, architecture, assumptions
- Original prompt stored in /docs/product_prompt.md
- UI reference images in /docs/ui-reference-images/
