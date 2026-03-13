import { auth } from '@clerk/nextjs/server';

export class UnauthorizedError extends Error {
  constructor(message = 'Authentication required.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export async function requireUser() {
  const { userId } = await auth();

  if (!userId) {
    throw new UnauthorizedError();
  }

  return { userId };
}
