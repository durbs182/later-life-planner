'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  PlannerState, PlanningMode, LifeStage, GIAAsset, CareReserve,
  PersonIncomeSources, PersonAssets, Assumptions, AspirationTag, RlssStandard,
} from '@/models/types';
import {
  createDefaultState, createMockDemoState, buildDefaultLifeStages,
  buildCategoriesForRlss, ageFromDOB,
} from '@/lib/mockData';
import { STATE_PENSION } from '@/config/financialConstants';

type Actions = {
  setCurrentStep: (step: number) => void;
  setMode: (mode: PlanningMode) => void;

  setFiAge: (age: number) => void;

  setP1Name:  (name: string) => void;
  setP1Dob:   (dob: string)  => void;
  setP1Age:   (age: number)  => void;
  setP1Income: (key: keyof PersonIncomeSources, updates: Record<string, unknown>) => void;
  setP1Asset:  (key: keyof PersonAssets,        updates: Record<string, unknown>) => void;

  setP2Name:  (name: string) => void;
  setP2Dob:   (dob: string)  => void;
  setP2Age:   (age: number)  => void;
  setP2Income: (key: keyof PersonIncomeSources, updates: Record<string, unknown>) => void;
  setP2Asset:  (key: keyof PersonAssets,        updates: Record<string, unknown>) => void;

  setJointGia: (updates: Partial<GIAAsset>) => void;
  setCareReserve: (updates: Partial<CareReserve>) => void;

  setLifeVision: (vision: string) => void;
  toggleAspiration: (tag: AspirationTag) => void;
  updateLifeStage: (id: string, updates: Partial<LifeStage>) => void;
  updateSpendingAmount: (categoryId: string, stageId: string, amount: number) => void;
  updateAssumptions: (updates: Partial<Assumptions>) => void;

  applyRlssTemplate: (standard: RlssStandard) => void;
  setRlssStandard: (standard: RlssStandard | null) => void;

  loadDemo: () => void;
  resetPlan: () => void;
};

export const usePlannerStore = create<PlannerState & Actions>()(
  persist(
    (set) => ({
      ...createDefaultState(STATE_PENSION.DEFAULT_AGE),

      setCurrentStep: (step) => set((s) => ({
        currentStep: step,
        maxVisitedStep: Math.max(s.maxVisitedStep, step),
      })),
      setMode: (mode) => set((s) => ({
        mode,
        spendingCategories: buildCategoriesForRlss(s.rlssStandard ?? 'minimum', mode),
      })),

      // FI age setter — rebuilds life stages anchored to new FI age
      setFiAge: (fiAge) =>
        set((s) => ({
          fiAge,
          lifeStages: buildDefaultLifeStages(fiAge, s.assumptions.lifeExpectancy),
        })),

      setP1Name: (name) => set((s) => ({ person1: { ...s.person1, name } })),

      // DOB setter — recomputes age and rebuilds life stages (preserving endAge from lifeExpectancy)
      // Also clamps fiAge to currentAge if the person is already at or past their freedom phase.
      setP1Dob: (dateOfBirth) =>
        set((s) => {
          const age = ageFromDOB(dateOfBirth, s.person1.currentAge);
          const maxFiAge = s.assumptions.lifeExpectancy - 1;
          const fiAge = Math.min(age >= s.fiAge ? age : s.fiAge, maxFiAge);
          return {
            person1: { ...s.person1, dateOfBirth, currentAge: age },
            fiAge,
            lifeStages: buildDefaultLifeStages(fiAge, s.assumptions.lifeExpectancy).map((ns) => {
              const ex = s.lifeStages.find((ls) => ls.id === ns.id);
              return ex ? { ...ex, startAge: ns.startAge, endAge: ns.endAge } : ns;
            }),
          };
        }),

      // Legacy age setter (used by slider fallback)
      setP1Age: (age) =>
        set((s) => {
          const maxFiAge = s.assumptions.lifeExpectancy - 1;
          const fiAge = Math.min(age >= s.fiAge ? age : s.fiAge, maxFiAge);
          return {
            person1: { ...s.person1, currentAge: age },
            fiAge,
            lifeStages: buildDefaultLifeStages(fiAge, s.assumptions.lifeExpectancy).map((ns) => {
              const ex = s.lifeStages.find((ls) => ls.id === ns.id);
              return ex ? { ...ex, startAge: ns.startAge, endAge: ns.endAge } : ns;
            }),
          };
        }),

      setP1Income: (key, updates) =>
        set((s) => ({
          person1: {
            ...s.person1,
            incomeSources: { ...s.person1.incomeSources, [key]: { ...s.person1.incomeSources[key], ...updates } },
          },
        })),
      setP1Asset: (key, updates) =>
        set((s) => ({
          person1: {
            ...s.person1,
            assets: { ...s.person1.assets, [key]: { ...s.person1.assets[key], ...updates } },
          },
        })),

      setP2Name: (name) => set((s) => ({ person2: { ...s.person2, name } })),

      setP2Dob: (dateOfBirth) =>
        set((s) => {
          const age = ageFromDOB(dateOfBirth, s.person2.currentAge);
          return { person2: { ...s.person2, dateOfBirth, currentAge: age } };
        }),

      setP2Age: (age) => set((s) => ({ person2: { ...s.person2, currentAge: age } })),

      setP2Income: (key, updates) =>
        set((s) => ({
          person2: {
            ...s.person2,
            incomeSources: { ...s.person2.incomeSources, [key]: { ...s.person2.incomeSources[key], ...updates } },
          },
        })),
      setP2Asset: (key, updates) =>
        set((s) => ({
          person2: {
            ...s.person2,
            assets: { ...s.person2.assets, [key]: { ...s.person2.assets[key], ...updates } },
          },
        })),

      setJointGia: (updates) =>
        set((s) => ({ jointGia: { ...s.jointGia, ...updates } })),

      setCareReserve: (updates) =>
        set((s) => ({ careReserve: { ...s.careReserve, ...updates } })),

      setLifeVision: (lifeVision) => set({ lifeVision }),
      toggleAspiration: (tag) =>
        set((s) => ({
          aspirations: s.aspirations.includes(tag)
            ? s.aspirations.filter((a) => a !== tag)
            : [...s.aspirations, tag],
        })),
      updateLifeStage: (id, updates) =>
        set((s) => ({ lifeStages: s.lifeStages.map((ls) => ls.id === id ? { ...ls, ...updates } : ls) })),
      updateSpendingAmount: (categoryId, stageId, amount) =>
        set((s) => ({
          spendingCategories: s.spendingCategories.map((cat) =>
            cat.id === categoryId
              ? { ...cat, amounts: { ...cat.amounts, [stageId]: Math.max(0, amount) } }
              : cat
          ),
        })),
      updateAssumptions: (updates) =>
        set((s) => {
          const newAssumptions = { ...s.assumptions, ...updates };
          // Keep the last life stage's endAge in sync with the planning horizon
          if (updates.lifeExpectancy !== undefined) {
            const lifeStages = s.lifeStages.map((ls, i, arr) =>
              i === arr.length - 1 ? { ...ls, endAge: updates.lifeExpectancy as number } : ls
            );
            return { assumptions: newAssumptions, lifeStages };
          }
          return { assumptions: newAssumptions };
        }),


      applyRlssTemplate: (standard) =>
        set((s) => ({
          rlssStandard: standard,
          spendingCategories: buildCategoriesForRlss(standard, s.mode),
        })),

      setRlssStandard: (rlssStandard) => set({ rlssStandard }),

      loadDemo: () => set(createMockDemoState()),
      resetPlan: () => set(createDefaultState(STATE_PENSION.DEFAULT_AGE)),
    }),
    { name: 'life-planner-v6' }
  )
);
