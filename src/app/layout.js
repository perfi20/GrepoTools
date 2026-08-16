import './globals.css';
import { AppContextProvider } from '@/context/AppContext';
import Navigation from '@/components/Navigation';

export const metadata = {
  title: 'Grepolis Toolkit - Tactical Command Center & Intelligence',
  description: 'Military-grade tactical tool suite for Grepolis: multi-world maps, scoreboards, precision recall sniping, and empire optimization.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppContextProvider>
          <Navigation />
          <main className="container">
            {children}
          </main>
        </AppContextProvider>
      </body>
    </html>
  );
}
