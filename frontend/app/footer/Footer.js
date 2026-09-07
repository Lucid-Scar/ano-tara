import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white pt-16 pb-8">
      <div className="mx-auto max-w-6xl px-6 sm:px-12">
        <div className="mb-12 grid grid-cols-1 gap-12 md:grid-cols-4">
          <div className="md:col-span-1">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-xl font-black tracking-tighter text-slate-900 italic">ano tara?</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-500">
              Kung saan maganda, mahal! We help you discover the perfect destinations tailored for your budget and style. Start your next great adventure with us.
            </p>
          </div>


          <div>
            <h4 className="mb-4 font-bold text-slate-900">Explore</h4>
            <ul className="space-y-3 text-sm text-slate-500">
              <li><Link href="/destinations" className="transition-colors hover:text-slate-900">Destinations</Link></li>
              <li><Link href="/all-experiences" className="transition-colors hover:text-slate-900">Experiences</Link></li>
              <li><Link href="/predict-outfit" className="transition-colors hover:text-slate-900">Outfit Tool</Link></li>
              <li><Link href="/about" className="transition-colors hover:text-slate-900">About Us</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-bold text-slate-900">Support</h4>
            <ul className="space-y-3 text-sm text-slate-500">
              <li><Link href="/faq" className="transition-colors hover:text-slate-900">FAQ</Link></li>
              <li><Link href="/contact" className="transition-colors hover:text-slate-900">Contact Us</Link></li>
              <li><Link href="/privacy" className="transition-colors hover:text-slate-900">Privacy Policy</Link></li>
              <li><Link href="/terms" className="transition-colors hover:text-slate-900">Terms of Service</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-bold text-slate-900">Follow Us</h4>
            <div className="mb-6 flex gap-4">
              <a href="#" aria-label="Facebook" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
              </a>
              <a href="#" aria-label="Instagram" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
              </a>
              <a href="#" aria-label="Twitter" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 hover:text-slate-900">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path></svg>
              </a>
            </div>
            <p className="text-sm text-slate-500">Email: hello@anotara.com</p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between border-t border-slate-200 pt-8 md:flex-row">
          <p className="text-sm text-slate-400">
            © {new Date().getFullYear()} Ano Tara. All rights reserved.
          </p>
          <div className="mt-4 flex gap-6 md:mt-0">
            <Link href="#" className="text-sm text-slate-400 hover:text-slate-600">Privacy</Link>
            <Link href="#" className="text-sm text-slate-400 hover:text-slate-600">Terms</Link>
            <Link href="#" className="text-sm text-slate-400 hover:text-slate-600">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
