import { SignUp } from '@clerk/nextjs';
import ClerkSetupNotice from '@/components/ClerkSetupNotice';

export default function SignUpPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <ClerkSetupNotice
        title="Sign-up is not configured yet"
        body="This app now expects Clerk for account access, but the local environment is missing the Clerk publishable key."
      />
    );
  }

  return (
    <main className="min-h-screen bg-cream-100 px-4 py-12">
      <div className="mx-auto flex min-h-[70vh] max-w-5xl items-center justify-center">
        <SignUp />
      </div>
    </main>
  );
}
