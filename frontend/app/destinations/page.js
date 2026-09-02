import Link from "next/link";

const heroImage =
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1400&q=80";

const destinationImages = [
  "https://images.unsplash.com/photo-1526778548025-fa2f459cd5ce?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1518544866330-95a85b8f8f6f?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1505881502353-a1986add3762?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1465311440653-ba9b1d9b0f5b?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1483683804023-6ccdb62f86ef?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1500835556837-99ac94a94552?auto=format&fit=crop&w=900&q=80",
];

function Header() {
  return (
    <header
      className="relative h-40 bg-slate-600"
      style={{
        backgroundImage: `linear-gradient(rgba(30,41,59,0.4), rgba(30,41,59,0.4)), url('${heroImage}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="mx-auto flex h-full w-full max-w-6xl items-start justify-between px-6 py-6 text-white">
        <p className="rounded-full bg-white/85 px-4 py-1 text-lg font-black italic text-slate-900">ano tara?</p>
        <Link href="/" className="text-sm font-semibold hover:underline">
          Back to home
        </Link>
      </div>
    </header>
  );
}

function DestinationCard({ image, name }) {
  return (
    <Link href="/specific-destinations" className="group relative block h-56 overflow-hidden rounded-2xl shadow-sm">
      <img src={image} alt={name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent" />
      <div className="absolute bottom-4 left-4 flex items-center gap-2">
        <div className="h-5 w-5 rounded-sm bg-[#fdb52a] shadow-sm" />
        <span className="text-sm font-medium text-white drop-shadow-sm">{name}</span>
      </div>
    </Link>
  );
}

export default function DestinationsPage() {
  return (
    <div className="min-h-screen bg-[#f5f7fa] text-slate-900">
      <Header />

      <div className="sticky top-0 z-10 border-b bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <h2 className="text-xl font-semibold">Filter / Categories</h2>
          <div className="flex flex-wrap items-center gap-3">
            {["Beach", "City", "Food"].map((categ) => (
              <button
                key={categ}
                className="inline-flex items-center gap-2 rounded-full border border-[#76B3DD]/25 bg-[#76B3DD]/25 px-5 py-2 font-medium transition hover:bg-[#76B3DD]/40"
              >
                {categ}
                <span aria-hidden="true">v</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-black">Destination places</h1>
          <Link href="/specific-destinations" className="text-sm font-semibold text-sky-800 hover:underline">
            See sample details page
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {destinationImages.map((image, index) => (
            <DestinationCard key={image} image={image} name={`Destinasyon ${index + 1}`} />
          ))}
        </div>
      </main>
    </div>
  );
}
