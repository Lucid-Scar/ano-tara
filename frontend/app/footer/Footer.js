import Link from "next/link";

export default function Footer() {
  return (
    <footer className="site-footer relative mt-auto w-full border-t border-slate-800 bg-slate-950 pt-16 pb-8 text-slate-300">
      <div className="mx-auto max-w-6xl px-6 sm:px-12">
        <div className="mb-12 grid grid-cols-1 gap-12 md:grid-cols-4">
          
          {/* Brand Column */}
          <div className="md:col-span-1">
            <div className="mb-4 flex items-center gap-2">
              <img src="/LOGO-WHITE.svg" alt="Ano Tara Logo" className="h-9 w-auto" />
            </div>
            <p className="text-sm leading-relaxed text-slate-400">
              Kung saan maganda, mahal! We help you discover the perfect destinations tailored for your budget and style. Start your next great adventure with us.
            </p>
          </div>

          {/* Explore Links */}
          <div>
            <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-white">Explore</h4>
            <ul className="space-y-3 text-sm text-slate-400">
              <li><Link href="/destinations" className="transition-colors hover:text-white">Destinations</Link></li>
              <li><Link href="/destinations" className="transition-colors hover:text-white">Experiences</Link></li>
              <li><Link href="/predict-outfit" className="transition-colors hover:text-white">Outfit Tool</Link></li>
              <li><Link href="/about" className="transition-colors hover:text-white">About Us</Link></li>
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-white">Support</h4>
            <ul className="space-y-3 text-sm text-slate-400">
              <li><Link href="/faq" className="transition-colors hover:text-white">FAQ</Link></li>
              <li><Link href="/contact" className="transition-colors hover:text-white">Contact Us</Link></li>
              <li><Link href="/privacy" className="transition-colors hover:text-white">Privacy Policy</Link></li>
              <li><Link href="/terms" className="transition-colors hover:text-white">Terms of Service</Link></li>
            </ul>
          </div>

          {/* Socials & Contact */}
          <div>
            <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-white">Follow Us</h4>
            <div className="mb-6 flex gap-3">
              <a href="#" aria-label="Facebook" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-all hover:bg-white/20 hover:text-white hover:-translate-y-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
              </a>
              <a href="#" aria-label="Instagram" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-all hover:bg-white/20 hover:text-white hover:-translate-y-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
              </a>
              <a href="#" aria-label="Twitter" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-all hover:bg-white/20 hover:text-white hover:-translate-y-0.5">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path></svg>
              </a>
            </div>
            <p className="text-sm font-medium text-slate-400">Email: <span className="text-slate-200">hello@anotara.com</span></p>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col items-center justify-between border-t border-slate-800 pt-8 md:flex-row">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} Ano Tara. All rights reserved.
          </p>
          <div className="mt-4 flex gap-6 md:mt-0">
            <Link href="#" className="text-xs text-slate-500 transition-colors hover:text-slate-300">Privacy</Link>
            <Link href="#" className="text-xs text-slate-500 transition-colors hover:text-slate-300">Terms</Link>
            <Link href="#" className="text-xs text-slate-500 transition-colors hover:text-slate-300">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
