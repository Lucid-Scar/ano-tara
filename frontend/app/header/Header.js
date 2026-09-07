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
  showBackLink = false,
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
          <img src="/ano_tara_logo.svg" alt="Ano Tara Logo" className={fixed ? "h-12 w-auto object-contain" : "h-10 w-auto object-contain cursor-pointer"} />
        </Link>
      </div>

      <div className="hidden items-center justify-center lg:flex">
        <div className={`flex items-center rounded-full border border-gray-200 bg-white py-1.5 pl-6 pr-2 shadow-sm ${fixed ? "py-2 border-gray-300 shadow-[0_2px_8px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-md" : "transition-shadow hover:shadow-md"}`}>
          <div className="flex cursor-pointer items-center gap-3 pr-4 text-sm font-medium text-slate-700">
            <CalendarIcon />
            <span>{dateLabel}</span>
          </div>

          <div className="mx-2 h-6 w-px bg-gray-200"></div>

          <div className="flex items-center gap-3 pl-4 pr-2">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <GuestIcon />
              <span className="w-[64px]">{guests} Guests</span>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={onGuestDecrease} aria-label="Decrease guests" className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 text-gray-500 transition-colors hover:bg-gray-100">-</button>
              <button type="button" onClick={onGuestIncrease} aria-label="Increase guests" className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 text-gray-500 transition-colors hover:bg-gray-100">+</button>
            </div>
          </div>

          {searchHref ? (
            <Link href={searchHref} aria-label="Search destinations" className="ml-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#fcedec] text-[#d96a6a] transition-colors hover:bg-[#fadbd8]">
              <SearchIcon />
            </Link>
          ) : (
            <button type="button" aria-label="Search destinations" className="ml-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#fcedec] text-[#d96a6a] transition-colors hover:bg-[#fadbd8]">
              <SearchIcon />
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-end gap-3">
        {showBackLink ? (
          <Link href="/destinations" className="mr-2 hidden text-sm font-semibold text-slate-500 transition-colors hover:text-slate-900 sm:block">
            Back to destinations
          </Link>
        ) : (
          <Link href="/" className="rounded-md border border-gray-300 px-5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-gray-50">
            Log in
          </Link>
        )}
        <Link href="/" className="flex items-center gap-2 rounded-md border border-[#d96a6a] px-5 py-2 text-sm font-semibold text-[#d96a6a] transition hover:bg-red-50">
          <UserIcon />
          Sign up
        </Link>
      </div>
    </header>
  );
}
