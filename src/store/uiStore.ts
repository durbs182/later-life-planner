import { create } from 'zustand';

export type Step3Person = 'person1' | 'person2';
export type Step3Tab = 'income' | 'assets';
export type DashboardTab = 'overview' | 'strategy' | 'goals' | 'iht' | 'care';

interface UiState {
  step3Person: Step3Person;
  step3Tab: Step3Tab;
  dashboardTab: DashboardTab;
  setStep3Person: (person: Step3Person) => void;
  setStep3Tab: (tab: Step3Tab) => void;
  setDashboardTab: (tab: DashboardTab) => void;
}

/**
 * View selections that should survive moving between wizard steps, which
 * unmounts each step. Kept in memory only: they aren't part of the plan, so
 * they are not persisted or synced.
 */
export const useUiStore = create<UiState>()((set) => ({
  step3Person: 'person1',
  step3Tab: 'income',
  dashboardTab: 'overview',
  setStep3Person: (step3Person) => set({ step3Person }),
  setStep3Tab: (step3Tab) => set({ step3Tab }),
  setDashboardTab: (dashboardTab) => set({ dashboardTab }),
}));
