import React from 'react';
import { ChevronDown } from 'lucide-react';

const Header = () => (
  <header className="h-32 bg-gray-500 relative flex items-start p-6 w-full object-cover bg-[url('/api/placeholder/1200/200')] bg-center bg-no-repeat">
    <div className="text-white font-black text-3xl tracking-tighter drop-shadow-md flex items-center">
      <span className="text-2xl mr-1">☂</span> Ano Tara?
    </div>
  </header>
);

const Footer = () => (
  <footer className="mt-12 py-8 flex justify-center border-t border-gray-300 w-[80%] mx-auto">
    <div className="bg-[#FEBAED]/80 text-gray-900 px-6 py-2 rounded-md font-medium tracking-wider shadow-sm">
      #FOOTER
    </div>
  </footer>
);

const DestinationCard = () => (
  <div className="relative h-56 rounded-2xl overflow-hidden shadow-sm group cursor-pointer">
    <img 
      src="/api/placeholder/400/300" 
      alt="Destination" 
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 grayscale"
    />
    <div className="absolute bottom-4 left-4 flex items-center gap-2">
      <div className="w-6 h-6 bg-[#FDB52A] rounded-sm shadow-sm" />
      <span className="text-gray-800 font-medium text-sm drop-shadow-md">Destinasyon</span>
    </div>
  </div>
);

export default function Destinations() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Header />
      
      <div className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Filter/Categories</h2>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex gap-4">
              {['Categ 1', 'Categ 2', 'Categ 3'].map((categ, idx) => (
                <button key={idx} className="flex items-center gap-2 bg-[#76B3DD]/30 hover:bg-[#76B3DD]/50 text-gray-900 px-6 py-2 rounded-full font-medium transition-colors border border-[#76B3DD]/20">
                  {categ} <ChevronDown size={18} />
                </button>
              ))}
            </div>
            
            <div className="flex gap-8 border-l-2 border-gray-300 pl-8">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">Date</p>
                <p className="text-gray-800 font-medium border-b border-gray-800">Feb. 14, 2027</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">No. of guests</p>
                <p className="text-gray-800 font-medium border-b border-gray-800">1001</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-grow max-w-6xl mx-auto px-6 py-10 w-full relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
           <div className="bg-[#FF6C1F]/70 px-6 py-2 rounded font-bold tracking-widest text-white text-xl backdrop-blur-sm shadow-md">
              #DESTINATION PLACES
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[...Array(9)].map((_, i) => (
            <DestinationCard key={i} />
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}