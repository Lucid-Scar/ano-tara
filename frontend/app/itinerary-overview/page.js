import ItineraryOverview from "../../components/ItineraryOverview";
import Link from "next/link";

export const metadata = {
  title: "Itinerary Overview | Ano Tara",
  description: "Travel brochure style itinerary overview with Polaroid card layout",
};

export default function ItineraryOverviewPage() {
  return (
    <main className="min-h-screen bg-[#fcfbf8] py-8 px-4 sm:px-6">
      <div className="mx-auto max-w-4xl mb-4">
        <Link
          href="/final-planner"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          ← Back to Final Planner
        </Link>
      </div>

      <ItineraryOverview />
    </main>
  );
}
