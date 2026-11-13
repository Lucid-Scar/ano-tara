import DestinationGridSkeleton from "../../components/DestinationGridSkeleton";

export default function Loading() {
  return <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6 lg:px-8"><div className="mb-8 h-12 w-64 rounded bg-slate-200 motion-safe:animate-pulse" /><DestinationGridSkeleton /></main>;
}
