'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useRef } from 'react';
import { usePlannerStore } from '@/store/plannerStore';

export default function AuthStateSync() {
  const { isLoaded, userId } = useAuth();
  const resetPlan = usePlannerStore((state) => state.resetPlan);
  const hasSeenSignedInState = useRef(false);

  useEffect(() => {
    if (!isLoaded) return;

    if (userId) {
      hasSeenSignedInState.current = true;
      return;
    }

    if (!hasSeenSignedInState.current) return;

    resetPlan();
    usePlannerStore.persist.clearStorage();
    hasSeenSignedInState.current = false;
  }, [isLoaded, userId, resetPlan]);

  return null;
}
