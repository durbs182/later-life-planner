# Auth & Multi-User Implementation Prompt

> Superseded: use [auth-plan.md](/Users/pauldurbin/later-life-planner/docs/auth-plan.md), [storage-plan.md](/Users/pauldurbin/later-life-planner/docs/storage-plan.md), and [security-decisions.md](/Users/pauldurbin/later-life-planner/docs/security-decisions.md) for current implementation.
>
> This file is retained for historical context only. Its Clerk direction remains relevant, but its Supabase storage plan is no longer current.

Use this document as the prompt for implementing auth and multi-user support in the later-life-planner app.

---

## Context

- Stack: Next.js 14 (App Router), TypeScript, TailwindCSS, Zustand, Recharts
- Local path: `/Users/pauldurbin/later-life-planner`
- GitHub: https://github.com/durbs182/later-life-planner
- Current state persistence: Zustand `persist` middleware writing to `localStorage` under key `life-planner-v6`
- Git workflow: create branch `prompt/auth-supabase-clerk`, commit and push when done, do not merge

## Chosen approach: Clerk (auth) + Supabase (database)

- Clerk handles all auth UI, sessions, and JWTs — no custom login pages needed
- Supabase provides a free Postgres database for storing user plans
- Zustand store architecture stays intact; a sync layer is added on top
- Plan is stored as a single JSON blob per user (one row per user in `plans` table)

---

## Implementation plan

### Phase 1 — Clerk auth setup

1. Install dependencies:
   ```
   npm install @clerk/nextjs
   ```

2. Create a Clerk app at https://clerk.com, get `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.

3. Add to `.env.local`:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
   CLERK_SECRET_KEY=sk_...
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
   NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
   NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
   ```

4. Wrap the app in `<ClerkProvider>` in `src/app/layout.tsx`.

5. Add Clerk middleware in `src/middleware.ts` to protect the app routes (allow `/sign-in` and `/sign-up` public, protect everything else).

6. Add sign-in and sign-up route pages using Clerk's `<SignIn />` and `<SignUp />` components at:
   - `src/app/sign-in/[[...sign-in]]/page.tsx`
   - `src/app/sign-up/[[...sign-up]]/page.tsx`

7. Add a minimal header/nav bar component with Clerk's `<UserButton />` so users can sign out. Place this in the main layout above the planner.

---

### Phase 2 — Supabase database setup

1. Install dependencies:
   ```
   npm install @supabase/supabase-js
   ```

2. Create a Supabase project at https://supabase.com. Get `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (and `SUPABASE_SERVICE_ROLE_KEY` for server-side).

3. Add to `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```

4. Create the `plans` table in Supabase SQL editor:
   ```sql
   create table plans (
     id uuid primary key default gen_random_uuid(),
     user_id text not null unique,
     state_json jsonb not null,
     updated_at timestamptz not null default now()
   );

   -- Only allow users to read/write their own row
   alter table plans enable row level security;

   create policy "Users can manage their own plan"
     on plans for all
     using (user_id = requesting_user_id())
     with check (user_id = requesting_user_id());
   ```
   Note: `requesting_user_id()` must be set from Clerk's JWT. See Phase 3.

5. Create a Supabase client helper at `src/lib/supabase.ts` that initialises the client with the anon key.

---

### Phase 3 — Wire Clerk JWT into Supabase RLS

Supabase RLS needs to know who the current user is. Clerk can issue a JWT that Supabase trusts.

1. In Clerk dashboard → JWT Templates → create a new template named `supabase`. Set the `role` claim to `authenticated` and add a custom claim `sub` mapped to `user.id`.

2. In Supabase dashboard → Authentication → JWT Settings → paste the Clerk JWT public key (JWKS URL from Clerk).

3. In the Supabase client helper, pass the Clerk session token as the `Authorization: Bearer` header on each request. Use Clerk's `getToken({ template: 'supabase' })` from `useAuth()` on the client side.

---

### Phase 4 — Sync layer over Zustand

The Zustand store does not change. A React hook handles loading and saving.

1. Create `src/hooks/usePlanSync.ts`:
   - On mount (after auth): fetch the user's plan row from Supabase `plans` table
   - If a row exists: call Zustand's `setState` (or a new `loadState` action) to hydrate the store from `state_json`
   - If no row exists: user is new, use the default state already in the store
   - Subscribe to Zustand store changes with a debounce (1–2 seconds) and upsert the full state JSON to Supabase on every change

2. Add a `loadState` action to `src/store/plannerStore.ts`:
   ```typescript
   loadState: (state: Partial<PlannerState>) => set({ ...state }),
   ```

3. Call `usePlanSync()` once in the top-level planner page/layout component so it is always active when the user is signed in.

4. Remove or disable the Zustand `persist` middleware (or keep it as an offline fallback — decide during implementation).

---

### Phase 5 — UX details

1. **Loading state**: Show a spinner or skeleton while the plan is being fetched from Supabase on first load.

2. **New user onboarding**: If no plan exists in DB, start on Step 1 as normal. The plan will be saved automatically when they begin entering data.

3. **Save indicator**: Add a small "Saved" / "Saving…" status indicator in the header so users know their data is persisted.

4. **Sign-out behaviour**: Clear the Zustand store on sign-out (reset to default state) so a second user on the same device starts fresh.

5. **Existing localStorage users**: On first sign-in, detect if `localStorage` has a `life-planner-v6` key. If so, offer to migrate that data to their new account (optional but good UX).

---

## File summary — what changes

| File | Change |
|---|---|
| `src/app/layout.tsx` | Wrap in `<ClerkProvider>`, add nav with `<UserButton />` |
| `src/middleware.ts` | New file — Clerk route protection |
| `src/app/sign-in/[[...sign-in]]/page.tsx` | New file — Clerk sign-in page |
| `src/app/sign-up/[[...sign-up]]/page.tsx` | New file — Clerk sign-up page |
| `src/lib/supabase.ts` | New file — Supabase client |
| `src/hooks/usePlanSync.ts` | New file — load/save sync hook |
| `src/store/plannerStore.ts` | Add `loadState` action, optionally remove `persist` |
| `.env.local` | New keys for Clerk and Supabase |

---

## What NOT to change

- The Zustand store shape and all existing actions
- All step components (Step1–Step4)
- The financial engine (`src/financialEngine/`)
- The chart components
- TailwindCSS styles and design system
