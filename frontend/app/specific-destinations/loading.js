export default function Loading() {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#4a8b8b]" />
        <p className="mt-4 text-sm font-bold text-slate-700">Loading destination details...</p>
      </div>
    </div>
  );
}
