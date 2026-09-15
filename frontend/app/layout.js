export const metadata = {
  title: 'Ano Tara',
  description: 'Frontend for CNN, MLR, and Decision Trees workflows',
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
