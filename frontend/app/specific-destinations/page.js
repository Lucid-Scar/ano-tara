import Link from "next/link";

const mainImage =
  "https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=1400&q=80";

const nearbyImages = [
  "https://images.unsplash.com/photo-1470214304380-aadaedcfff0b?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1500835556837-99ac94a94552?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=80",
];

function NearbyCard({ image, name }) {
  return (
    <Link href="/destinations" className="group relative block h-52 overflow-hidden rounded-2xl shadow-sm">
      <img src={image} alt={name} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent" />
      <p className="absolute bottom-4 left-4 text-sm font-medium text-white">{name}</p>
    </Link>
  );
}

export default function SpecificDestinationsPage() {
  return (
    <div className="min-h-screen bg-[#f7f8fb] text-slate-900">
      <header className="border-b bg-white/95">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
          <p className="rounded-full bg-slate-900 px-4 py-1 text-lg font-black italic text-white">ano tara?</p>
          <Link href="/destinations" className="text-sm font-semibold hover:underline">
            Back to destinations
          </Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 border-b bg-white px-6 py-4 shadow-sm">
        <label className="flex items-center gap-3">
          <span className="text-lg text-[#76B3DD]" aria-hidden="true">
            o
          </span>
          <input
            type="text"
            placeholder="search a destination"
            className="w-64 border-b border-gray-400 bg-transparent pb-1 outline-none transition-colors focus:border-[#76B3DD]"
          />
        </label>
        <div className="flex gap-8 border-l-2 border-gray-300 pl-8">
          <div>
            <p className="text-[10px] font-semibold uppercase text-gray-500">Date</p>
            <p className="border-b border-gray-800 pb-0.5 text-sm font-medium">Feb. 14, 2027</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase text-gray-500">No. of guests</p>
            <p className="border-b border-gray-800 pb-0.5 text-sm font-medium">1001</p>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-12 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="h-80 overflow-hidden rounded-xl shadow-md">
            <img src={mainImage} alt="El Nido Panaginip" className="h-full w-full object-cover" />
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="mb-1 text-4xl font-bold">El Nido Panaginip</h1>
            <p className="mb-6 text-gray-600">Wowowin dito yon</p>

            <p className="mb-8 text-sm leading-relaxed text-gray-700">
              Crystal-clear water, limestone cliffs, and island-hopping routes make this a perfect stop for barkada and family trips.
            </p>

            <div className="mt-auto">
              <h3 className="text-3xl font-bold text-[#860001]">PHP 2,999</h3>
              <a href="#" className="text-sm italic text-gray-500 underline transition-colors hover:text-[#76B3DD]">
                look more here! Bookingsite.com
              </a>
            </div>
          </div>
        </div>

        <div className="mx-auto mb-16 flex max-w-3xl flex-col items-center rounded-3xl border border-gray-100 bg-white p-8 shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
          <div className="mb-8 grid w-full grid-cols-1 gap-8 md:grid-cols-2">
            <div className="space-y-6">
              <div>
                <p className="mb-1 font-medium text-gray-800">When are you going?</p>
                <button className="text-lg font-medium text-[#AEA434] underline underline-offset-4 transition-colors hover:text-[#860001]">
                  Add Dates
                </button>
              </div>
              <div>
                <p className="mb-1 font-medium text-gray-800">How many guests?</p>
                <div className="flex gap-8">
                  <button className="text-lg font-medium text-[#AEA434] underline underline-offset-4 transition-colors hover:text-[#860001]">
                    ADULT
                  </button>
                  <button className="text-lg font-medium text-[#AEA434] underline underline-offset-4 transition-colors hover:text-[#860001]">
                    CHILDREN
                  </button>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-1 font-medium text-gray-800">Estimate time?</p>
              <button className="text-lg font-medium text-[#AEA434] underline underline-offset-4 transition-colors hover:text-[#860001]">
                Add time
              </button>
            </div>
          </div>

          <button className="flex items-center gap-2 rounded-full bg-[#AEA434] px-8 py-3 font-medium text-white shadow-md transition-all hover:bg-[#96902d]">
            Add to itinerary
            <span className="-rotate-45 transform" aria-hidden="true">
              ^
            </span>
          </button>
        </div>

        <div className="relative">
          <h2 className="mb-6 text-2xl font-bold italic">Destinations around it!</h2>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {nearbyImages.map((image, index) => (
              <NearbyCard key={image} image={image} name={`Nearby place ${index + 1}`} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
