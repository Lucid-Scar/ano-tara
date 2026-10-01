export const metadata = {
  title: 'Ano Tara',
  description: 'Travel planning and outfit coordination for your next trip',
};

import './globals.css';
import { TravelProvider } from './TravelContext';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased text-slate-950">
        <TravelProvider>{children}</TravelProvider>
      </body>
    </html>
  );
}
