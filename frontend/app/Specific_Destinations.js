import React from 'react';
import { Search, Send } from 'lucide-react';

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

export default function Specific_Destinations() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Header />
      
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-grow">
            <Search size={20} className="text-[#76B3DD]" />
            <input 
              type="text" 
              placeholder="search a destination" 
              className="outline-none border-b border-gray-400 focus:border-[#76B3DD] pb-1 text-gray-700 w-64 bg-transparent transition-colors"
            />
          </div>
          <div className="flex gap-8 border-l-2 border-gray-300 pl-8">
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-semibold">Date</p>
              <p className="text-sm text-gray-800 font-medium border-b border-gray-800 pb-0.5">Feb. 14, 2027</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-semibold">No. of guests</p>
              <p className="text-sm text-gray-800 font-medium border-b border-gray-800 pb-0.5">1001</p>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-grow max-w-6xl mx-auto px-6 py-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <div className="rounded-xl overflow-hidden h-80 shadow-md">
            <img 
              src="/api/placeholder/800/600" 
              alt="El Nido Panaginip" 
              className="w-full h-full object-cover grayscale"
            />
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-1">El Nido Panaginip</h1>
            <p className="text-gray-600 mb-6">Wowowin dito yon</p>
            
            <p className="text-gray-700 text-sm mb-8 leading-relaxed">
              Hahgdhssabdhasgd ahsdugasudhasjdahsd hasjd ajsdsahdasdashdga ahsgdashgdhg ajsdhjashdjashdas
            </p>
            
            <div className="mt-auto">
              <h3 className="text-3xl font-bold text-[#860001]">PHP 2 999</h3>
              <a href="#" className="text-sm italic underline text-gray-500 hover:text-[#76B3DD] transition-colors">look more here! Bookingsite.com</a>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-8 max-w-3xl mx-auto mb-16 flex flex-col items-center border border-gray-100">
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="space-y-6">
              <div>
                <p className="text-gray-800 font-medium mb-1">When are you going?</p>
                <button className="text-[#AEA434] hover:text-[#860001] underline underline-offset-4 text-lg transition-colors font-medium">Add Dates</button>
              </div>
              <div>
                <p className="text-gray-800 font-medium mb-1">How many guests?</p>
                <div className="flex gap-8">
                  <button className="text-[#AEA434] hover:text-[#860001] underline underline-offset-4 text-lg transition-colors font-medium">ADULT</button>
                  <button className="text-[#AEA434] hover:text-[#860001] underline underline-offset-4 text-lg transition-colors font-medium">CHILDREN</button>
                </div>
              </div>
            </div>
            
            <div>
              <p className="text-gray-800 font-medium mb-1">Estimate time?</p>
              <button className="text-[#AEA434] hover:text-[#860001] underline underline-offset-4 text-lg transition-colors font-medium">Add time</button>
            </div>
          </div>
          
          <button className="bg-[#AEA434] hover:bg-[#AEA434]/80 text-white font-medium px-8 py-3 rounded-full flex items-center gap-2 transition-all shadow-md">
            Add to itinerary <Send size={18} className="transform -rotate-45" />
          </button>
        </div>

        <div className="relative">
          <h2 className="text-2xl font-bold italic text-gray-900 mb-6">Destinations around it!</h2>
          
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none mt-4">
             <div className="bg-[#FF6C1F]/70 px-4 py-1 rounded font-bold tracking-wider text-white text-sm backdrop-blur-sm whitespace-nowrap shadow-md">
                #PAPUNTA SEARCH OF DESTINATIONS
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <DestinationCard key={i} />
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}