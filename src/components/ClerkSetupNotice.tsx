interface Props {
  title: string;
  body: string;
}

export default function ClerkSetupNotice({ title, body }: Props) {
  return (
    <main className="min-h-screen bg-cream-100 px-4 py-12">
      <div className="mx-auto flex min-h-[70vh] max-w-5xl items-center justify-center">
        <section className="max-w-lg rounded-[28px] border border-orange-100 bg-white p-8 shadow-game">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-orange-500">Auth setup needed</p>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-900">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{body}</p>
          <p className="mt-4 text-xs leading-5 text-slate-400">
            Set <code>NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> and <code>CLERK_SECRET_KEY</code> to enable Clerk.
          </p>
        </section>
      </div>
    </main>
  );
}
