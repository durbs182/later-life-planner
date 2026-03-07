'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  PlannerState, PlanningMode, LifeStage,
  PersonIncomeSources, PersonAssets, Assumptions, AspirationTag, RlssStandard,
} from '@/lib/types';
import {
  createDefaultState, createMockDemoState, buildDefaultLifeStages,
  buildCategoriesForRlss,
} from '@/lib/mockData';

type Actions = {
  setCurrentStep: (step: number) => void;
  setMode: (mode: PlanningMode) => void;

  setP1Name: (name: string) => void;
  setP1Age: (age: number) => void;
  setP1Income: (key: keyof PersonIncomeSources, updates: Record<string, unknown>) => void;
  setP1Asset:  (key: keyof PersonAssets,        updates: Record<string, unknown>) => void;

  setP2Name: (name: string) => void;
  setP2Age: (age: number) => void;
  setP2Income: (key: keyof PersonIncomeSources, updates: Record<string, unknown>) => void;
  setP2Asset:  (key: keyof PersonAssets,        updates: Record<string, unknown>) => void;

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
      ...createDefaultState(57),

      setCurrentStep: (step) => set({ currentStep: step }),
      setMode: (mode) => set({ mode }),

      setP1Name: (name) => set((s) => ({ person1: { ...s.person1, name } })),
      setP1Age: (age) =>
        set((s) => ({
          person1: { ...s.person1, currentAge: age },
          lifeStages: buildDefaultLifeStages(age).map((ns) => {
            const ex = s.lifeStages.find((ls) => ls.id === ns.id);
            return ex ? { ...ex, startAge: ns.startAge } : ns;
          }),
        })),
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
        set((s) => ({ assumptions: { ...s.assumptions, ...updates } })),

      applyRlssTemplate: (standard) =>
        set((s) => ({
          rlssStandard: standard,
          spendingCategories: buildCategoriesForRlss(standard, s.mode),
        })),

      setRlssStandard: (rlssStandard) => set({ rlssStandard }),

      loadDemo: () => set(createMockDemoState()),
      resetPlan: () => set(createDefaultState(57)),
    }),
    { name: 'life-planner-v3' }
  )
);
