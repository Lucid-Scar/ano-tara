export default function DestinationGridSkeleton({ count = 8 }) {
  return <div role="status" aria-live="polite" aria-busy="true">
    <span className="sr-only">Loading activities and destinations...</span>
    <div aria-hidden="true" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => <div key={index} className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm motion-safe:animate-pulse">
        <div className="h-56 bg-slate-200" />
        <div className="space-y-3 p-5"><div className="h-5 w-3/4 rounded bg-slate-200" /><div className="h-4 w-1/2 rounded bg-slate-100" /><div className="h-8 rounded bg-slate-100" /></div>
      </div>)}
    </div>
  </div>;
}
