import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'Grepolis Toolkit',
  description: 'Premium personal tools for Grepolis players',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <nav className="navbar">
          <div className="container flex justify-between items-center" style={{ padding: 0 }}>
            <h1 className="gradient-text" style={{ margin: 0, fontSize: '1.5rem' }}>GrepoTools</h1>
            <div className="nav-links">
              <Link href="/" className="nav-link">Dashboard</Link>
              <Link href="/reports" className="nav-link">Reports</Link>
              <Link href="/planner" className="nav-link">Planner</Link>
              <Link href="/snipe" className="nav-link">Snipe Timer</Link>
              <Link href="/world" className="nav-link">World Data</Link>
              <Link href="/map" className="nav-link">World Map</Link>
            </div>
          </div>
        </nav>
        <main className="container">
          {children}
        </main>
      </body>
    </html>
  );
}
