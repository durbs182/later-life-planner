import { describe, expect, test } from 'vitest';
import { createDefaultState } from '@/lib/mockData';
import { extractPersistedPlannerState, hydratePlannerState } from '@/lib/persistedPlan';
import { MAX_PLANNING_HORIZON, MAX_SUPPORTED_CURRENT_AGE } from '@/lib/planningBounds';

describe('extractPersistedPlannerState', () => {
  test('omits wizard UI state from the canonical persisted payload', () => {
    const state = createDefaultState(57);
    state.currentStep = 3;
    state.maxVisitedStep = 4;

    const persistedState = extractPersistedPlannerState(state);

    expect(persistedState).not.toHaveProperty('currentStep');
    expect(persistedState).not.toHaveProperty('maxVisitedStep');
    expect(persistedState.fiAge).toBe(state.fiAge);
    expect(persistedState.lifeVision).toBe(state.lifeVision);
  });
});

describe('hydratePlannerState', () => {
  test('hydrates canonical planner data without letting persisted UI state overwrite the current session', () => {
    const currentState = createDefaultState(57);
    currentState.currentStep = 4;
    currentState.maxVisitedStep = 4;

    const hydratedState = hydratePlannerState(
      currentState,
      {
        ...extractPersistedPlannerState(currentState),
        lifeVision: 'Spend more time travelling across the UK',
        currentStep: 0,
        maxVisitedStep: 0,
      } as unknown as ReturnType<typeof extractPersistedPlannerState>,
    );

    expect(hydratedState.lifeVision).toBe('Spend more time travelling across the UK');
    expect(hydratedState.currentStep).toBe(4);
    expect(hydratedState.maxVisitedStep).toBe(4);
  });

  test('normalizes invalid persisted planning values during hydration', () => {
    const currentState = createDefaultState(57);

    const hydratedState = hydratePlannerState(currentState, {
      ...extractPersistedPlannerState(currentState),
      person1: {
        ...currentState.person1,
        currentAge: 125,
        dateOfBirth: '1900-01-01',
      },
      fiAge: 120,
      assumptions: {
        ...currentState.assumptions,
        lifeExpectancy: 95,
      },
    });

    expect(hydratedState.person1.currentAge).toBe(MAX_SUPPORTED_CURRENT_AGE);
    expect(hydratedState.fiAge).toBe(MAX_SUPPORTED_CURRENT_AGE);
    expect(hydratedState.assumptions.lifeExpectancy).toBe(MAX_PLANNING_HORIZON);
  });
});
