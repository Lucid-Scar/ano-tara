import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-white px-3 pb-12 pt-3 sm:px-6 sm:pt-6">
      <section
        className="relative mx-auto min-h-[58vh] w-full max-w-6xl overflow-hidden rounded-none text-white sm:rounded-[0.35rem]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(52,73,87,0.58), rgba(52,73,87,0.58)), url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1800&q=80')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(255,255,255,0.12),transparent_36%)]" />

        <nav className="relative z-10 mx-auto flex w-full max-w-6xl items-start justify-between px-6 pt-6 sm:px-8">
          <p className="rounded-full bg-white/92 px-4 py-1 text-2xl font-black italic text-slate-900">ano tara?</p>
          <div className="flex items-center gap-6 text-3xl sm:text-2xl">
            <Link href="/" className="font-semibold text-white/95 hover:text-white">
              Login
            </Link>
            <Link href="/" className="font-semibold italic text-white/95 hover:text-white">
              Sign-up
            </Link>
          </div>
        </nav>

        <div className="relative z-10 mx-auto flex min-h-[44vh] max-w-5xl flex-col items-center justify-center px-5 pb-24 pt-8 text-center sm:pt-12">
          <h1 className="text-6xl font-black tracking-tight sm:text-8xl">Travel, ano tara?</h1>
          <p className="mt-5 text-4xl font-medium sm:text-6xl">kung saan masarap, mahal!</p>
        </div>

        <div className="relative z-10 mx-auto -mt-12 w-[92%] max-w-3xl rounded-[1.4rem] border border-white/80 bg-white p-3 text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.24)] sm:p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-center">
            <label className="rounded-xl px-3 py-2 sm:border-r sm:border-slate-300">
              <p className="text-xs text-slate-700">When are you going?</p>
              <input type="date" className="mt-1 w-full border-0 bg-transparent p-0 text-4xl font-medium outline-none sm:text-3xl" defaultValue="" />
            </label>

            <label className="rounded-xl px-3 py-2 sm:border-r sm:border-slate-300">
              <p className="text-xs text-slate-700">How many guests?</p>
              <input
                type="number"
                min="1"
                className="mt-1 w-full border-0 bg-transparent p-0 text-4xl font-medium outline-none sm:text-3xl"
                defaultValue="1001"
              />
            </label>

            <Link
              href="/destinations"
              className="inline-flex items-center justify-center gap-3 rounded-[1.1rem] bg-[#b9f0c8] px-8 py-4 text-4xl font-black text-slate-900 shadow-sm transition hover:brightness-95 sm:text-5xl"
            >
              Humanap!
              <span className="-rotate-12 text-4xl">o</span>
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto mt-20 h-px w-[36%] bg-slate-500" />
      <div className="h-12" />
      <section className="mx-auto max-w-6xl px-2 pb-8 sm:px-0">
        <p className="text-center text-sm text-slate-500">Browse destinations from the homepage, or open the outfit tool at /predict-outfit</p>
      </section>
    </main>
  );
}