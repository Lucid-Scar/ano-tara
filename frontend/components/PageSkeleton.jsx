export default function PageSkeleton() {
  return (
    <main className="min-h-screen bg-[#fcfcfd] px-6 py-6 lg:px-12" aria-busy="true" aria-live="polite">
      <div className="mx-auto max-w-[1400px] animate-pulse">
        <div className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4">
          <div className="h-8 w-32 rounded bg-slate-200" />
          <div className="hidden h-8 w-72 rounded-full bg-slate-200 sm:block" />
          <div className="h-8 w-36 rounded bg-slate-200" />
        </div>
        <div className="mt-6 h-10 w-48 rounded bg-slate-200" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="space-y-4">
            <div className="h-72 rounded-3xl bg-slate-200" />
            <div className="h-8 w-3/4 rounded bg-slate-200" />
            <div className="h-24 rounded-2xl bg-slate-200" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="h-28 rounded-2xl bg-slate-200" />
              <div className="h-28 rounded-2xl bg-slate-200" />
            </div>
          </div>
          <div className="h-[32rem] rounded-3xl bg-slate-200" />
        </div>
      </div>
      <span className="sr-only">Loading page content...</span>
    </main>
  );
}
