'use client';

import dynamic from 'next/dynamic';
import { usePlannerStore } from '@/store/plannerStore';
import Header from '@/components/Header';
import StepIndicator from '@/components/StepIndicator';
import SummaryBar from '@/components/SummaryBar';
import Step1LifeVision from '@/components/steps/Step1LifeVision';
import Step2SpendingGoals from '@/components/steps/Step2SpendingGoals';
import Step3IncomeSources from '@/components/steps/Step3IncomeSources';

const Step4Dashboard = dynamic(() => import('@/components/steps/Step4Dashboard'), { ssr: false });

const STEPS = [
  { label: 'Life Vision',    description: 'Design your aspirations' },
  { label: 'Spending Goals', description: 'Set your lifestyle budget' },
  { label: 'Income & Assets',description: 'Map your financial picture' },
  { label: 'Your Dashboard', description: 'See your lifetime plan' },
];

export default function Home() {
  const { currentStep, setCurrentStep } = usePlannerStore();
  const goNext = () => setCurrentStep(Math.min(currentStep + 1, STEPS.length - 1));
  const goBack = () => setCurrentStep(Math.max(currentStep - 1, 0));

  return (
    <div className="min-h-screen flex flex-col bg-cream-100">
      <Header />

      {/* Step navigation bar */}
      <div className="sticky top-[56px] z-10 bg-white/80 backdrop-blur-sm border-b border-orange-100/60 no-print">
        <div className="max-w-5xl mx-auto px-4 py-2.5">
          <StepIndicator steps={STEPS} currentStep={currentStep} onStepClick={setCurrentStep} />
        </div>
      </div>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        <div className="fade-in">
          {currentStep === 0 && <Step1LifeVision onNext={goNext} />}
          {currentStep === 1 && <Step2SpendingGoals onNext={goNext} onBack={goBack} />}
          {currentStep === 2 && <Step3IncomeSources onNext={goNext} onBack={goBack} />}
          {currentStep === 3 && <Step4Dashboard onBack={goBack} />}
        </div>
      </main>

      {/* Live summary bar */}
      {currentStep < 3 && (
        <div className="sticky bottom-0 bg-white/90 backdrop-blur-sm border-t border-orange-100/60 shadow-game no-print">
          <SummaryBar />
        </div>
      )}
    </div>
  );
}
