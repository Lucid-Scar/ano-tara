import Link from "next/link";

function CalendarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
      <line x1="16" y1="2" x2="16" y2="6"></line>
      <line x1="8" y1="2" x2="8" y2="6"></line>
      <line x1="3" y1="10" x2="21" y2="10"></line>
    </svg>
  );
}

function GuestIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"></circle>
      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
  );
}

function UserIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  );
}

export default function Header({
  guests,
  onGuestDecrease,
  onGuestIncrease,
  selectedDate,
  dateLabel = selectedDate,
  searchHref,
  isVisible = true,
  fixed = false,
}) {
  const headerClassName = fixed
    ? `fixed inset-x-0 top-0 z-50 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4 shadow-sm transition-transform duration-300 ease-in-out ${isVisible ? "translate-y-0" : "-translate-y-full"}`
    : "sticky top-0 z-50 flex h-20 items-center justify-between border-b border-gray-100 bg-white px-6 shadow-sm lg:px-12";

  return (
    <header className={headerClassName}>
      <div className="flex flex-1 items-center">
        <Link href="/">
          <img src="/LOGO-BLACK.svg" alt="Ano Tara Logo" className={fixed ? "h-12 w-auto object-contain" : "h-10 w-auto object-contain cursor-pointer"} />
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-end gap-3">
        <Link href="/predict-outfit" className="text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900">Outfit planner</Link>
        <Link href="/final-planner" className="rounded-md border border-[#4a8b8b] px-4 py-2 text-sm font-semibold text-[#4a8b8b] transition hover:bg-teal-50">Final planner</Link>
      </div>
    </header>
  );
}
